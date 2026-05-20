import path from 'path';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import type { AnalysisProvider } from '../providers/common/AnalysisProvider';
import type { AnalysisBundle, SourceFile } from '../languages/common/types';
import { claimNextJobs } from '../core/jobs/jobQueue';
import { recoverStaleJobs } from './recoverStaleJobs';
import { classifyError, shouldRetry, type FailureKind } from '../core/jobs/retryPolicy';
import { updateRunStatus } from '../core/runs/updateRunStatus';
import type { ProviderConfigOverrides } from '../providers/providerRegistry';
import { loadProviderCredentials } from '../core/settings/providerCredentials';
import {
  eventBus,
  type WorkerLogEvent,
  type WorkerJobEvent,
  type WorkerAnswerEvent,
  type WorkerRunEvent,
} from '../api/eventBus';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkspaceBuilder = {
  build(jobId: string, bundle: AnalysisBundle): Promise<string>;
  cleanup(jobId: string): Promise<void>;
};

export type AnalysisProviderResolver = {
  get(providerId: string, overrides?: ProviderConfigOverrides): AnalysisProvider | undefined;
};

export type WorkerConfig = {
  concurrency: number;
  pollIntervalMs: number;
  maxAttempts: number;
  staleTimeoutSeconds: number;
};

type LoadedJob = Prisma.AnalysisJobGetPayload<{
  include: {
    bundle: {
      include: {
        project: true;
        files: { include: { file: true } };
      };
    };
    question: true;
    run: true;
  };
}>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function reconstructBundle(job: LoadedJob): AnalysisBundle {
  const { bundle } = job;
  const repoPath = bundle.project.repoPath;

  function toSourceFile(
    dbFile: LoadedJob['bundle']['files'][number]['file'],
  ): SourceFile {
    const { id, projectId, relativePath, language, sizeBytes, metadata } = dbFile;
    const meta = metadata as Record<string, unknown>;
    return {
      id,
      projectId,
      path: path.join(repoPath, relativePath),
      relativePath,
      filename: path.basename(relativePath),
      extension: path.extname(relativePath),
      language,
      checksum: (meta?.checksum as string) ?? '',
      sizeBytes: sizeBytes ?? undefined,
    };
  }

  const mainBundleFile = bundle.files.find((bf) => bf.role === 'main');
  if (!mainBundleFile) throw new Error(`Bundle ${bundle.id} has no main file`);

  return {
    mainFile: toSourceFile(mainBundleFile.file),
    contextFiles: bundle.files
      .filter((bf) => bf.role === 'context')
      .map((bf) => toSourceFile(bf.file)),
    unresolvedDependencies:
      ((bundle.metadata as Record<string, unknown>)?.unresolvedDependencies as string[]) ?? [],
    metadata: bundle.metadata as Record<string, unknown>,
  };
}

// Extracts per-run provider overrides from AnalysisRun.metadata.
function readProviderSettings(metadata: unknown): ProviderConfigOverrides | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const settings = (metadata as Record<string, unknown>).providerSettings;
  if (!settings || typeof settings !== 'object') return undefined;
  const { model, agent } = settings as Record<string, unknown>;
  const overrides: ProviderConfigOverrides = {};
  if (typeof model === 'string' && model) overrides.model = model;
  if (typeof agent === 'string' && agent) overrides.agent = agent;
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

// Worker activity logging — silenced under NODE_ENV=test to keep tests quiet.
// When a runId is provided the event is also forwarded to SSE clients watching that run.
function logWorker(
  message: string,
  level: WorkerLogEvent['level'] = 'info',
  runId?: string,
): void {
  if (process.env.NODE_ENV === 'test') return;
  console.log(`[worker] ${message}`);
  if (runId) {
    eventBus.emit('worker', { type: 'log', runId, level, message, ts: Date.now() } satisfies WorkerLogEvent);
  }
}

// Formats the trailing "· N tokens · Nms · parse=…" suffix for a result log.
function formatResultInfo(metadata: Record<string, unknown> | undefined): string {
  if (!metadata) return '';
  const parts: string[] = [];
  if (typeof metadata.tokensUsed === 'number') parts.push(`${metadata.tokensUsed} tokens`);
  if (typeof metadata.durationMs === 'number') parts.push(`${metadata.durationMs}ms`);
  if (typeof metadata.parseStatus === 'string') parts.push(`parse=${metadata.parseStatus}`);
  return parts.length > 0 ? ` · ${parts.join(' · ')}` : '';
}

// ---------------------------------------------------------------------------
// WorkerLoop
// ---------------------------------------------------------------------------

export class WorkerLoop {
  private running = false;

  constructor(
    private readonly provider: AnalysisProvider | AnalysisProviderResolver,
    private readonly workspace: WorkspaceBuilder,
    private readonly config: WorkerConfig,
  ) {}

  async start(): Promise<void> {
    this.running = true;
    while (this.running) {
      await this.tick();
      if (this.running) await sleep(this.config.pollIntervalMs);
    }
  }

  stop(): void {
    this.running = false;
  }

  async tick(): Promise<void> {
    await recoverStaleJobs(this.config.staleTimeoutSeconds);
    const ids = await claimNextJobs(this.config.concurrency);
    if (ids.length > 0) {
      logWorker(`claimed ${ids.length} job(s)`);
      await Promise.allSettled(ids.map((id) => this.processJob(id)));
    }
  }

  async processJob(jobId: string): Promise<void> {
    const job = await prisma.analysisJob.findUnique({
      where: { id: jobId },
      include: {
        bundle: {
          include: {
            project: true,
            files: { include: { file: true } },
          },
        },
        question: true,
        run: true,
      },
    });

    if (!job) return;

    // Job is already 'running' in the DB (set by claimNextJobs); tell SSE clients.
    eventBus.emit('worker', {
      type: 'job_update',
      runId: job.runId,
      job: { id: job.id, status: 'running', attempts: job.attempts, lastError: null, failureKind: null },
    } satisfies WorkerJobEvent);

    const overrides = await this.buildProviderOverrides(job);
    logWorker(
      `job ${job.id} · ${job.providerId}` +
        (overrides?.model ? ` · ${overrides.model}` : '') +
        ` · q=${job.question.key}`,
      'info',
      job.run.id,
    );

    let bundle: AnalysisBundle;
    try {
      bundle = reconstructBundle(job);
    } catch (err) {
      await this.handleFailure(job, err);
      return;
    }

    const provider = this.resolveProvider(job.providerId, overrides);
    if (!provider) {
      await this.handleFailure(job, new Error(`Unknown provider: ${job.providerId}`), 'non_retryable');
      return;
    }

    let workspacePath: string;
    try {
      workspacePath = await this.workspace.build(jobId, bundle);
    } catch (err) {
      await this.handleFailure(job, err);
      return;
    }

    try {
      const result = await provider.analyze({
        jobId: job.id,
        projectId: job.run.projectId,
        bundle,
        question: {
          id: job.question.id,
          key: job.question.key,
          text: job.question.text,
        },
        workspacePath,
        metadata: job.metadata as Record<string, unknown>,
      });

      const softFailureKind = result.metadata?.failureKind as FailureKind | undefined;
      if (softFailureKind) {
        const reason = (result.metadata?.error as string) ?? `Provider returned failureKind: ${softFailureKind}`;
        await this.handleFailure(job, new Error(reason), softFailureKind);
        return;
      }

      const createdAnswer = await prisma.analysisAnswer.create({
        data: {
          jobId: job.id,
          rawOutput: result.rawOutput,
          parsed: (result.parsedAnswer ?? {}) as any,
          modelId: (result.metadata?.modelId as string) ?? null,
          tokensUsed: (result.metadata?.tokensUsed as number) ?? null,
        },
      });

      await prisma.analysisJob.update({
        where: { id: jobId },
        data: { status: 'completed' as any, finishedAt: new Date() },
      });

      eventBus.emit('worker', {
        type: 'job_update',
        runId: job.runId,
        job: { id: job.id, status: 'completed', attempts: job.attempts, lastError: null, failureKind: null },
      } satisfies WorkerJobEvent);

      eventBus.emit('worker', {
        type: 'answer_new',
        runId: job.runId,
        answer: {
          id: createdAnswer.id,
          jobId: createdAnswer.jobId,
          rawOutput: createdAnswer.rawOutput,
          parsed: createdAnswer.parsed,
          modelId: createdAnswer.modelId,
          tokensUsed: createdAnswer.tokensUsed,
          createdAt: createdAnswer.createdAt.toISOString(),
        },
      } satisfies WorkerAnswerEvent);

      logWorker(`job ${job.id} done${formatResultInfo(result.metadata)}`, 'info', job.runId);

      const newRunStatus = await updateRunStatus(job.runId);
      if (newRunStatus) {
        eventBus.emit('worker', {
          type: 'run_update',
          runId: job.runId,
          status: newRunStatus,
          finishedAt: new Date().toISOString(),
        } satisfies WorkerRunEvent);
      }
    } catch (err) {
      await this.handleFailure(job, err);
    } finally {
      await this.workspace.cleanup(jobId).catch(() => {});
    }
  }

  private async handleFailure(
    job: LoadedJob,
    error: unknown,
    failureKind?: FailureKind,
  ): Promise<void> {
    const newAttempts = job.attempts + 1;
    const lastError = error instanceof Error ? error.message : String(error);
    const kind = failureKind ?? classifyError(error);

    if (shouldRetry(newAttempts, this.config.maxAttempts, kind)) {
      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          status: 'pending' as any,
          attempts: newAttempts,
          lastError,
          failureKind: kind,
          claimedAt: null,
          startedAt: null,
        },
      });
      eventBus.emit('worker', {
        type: 'job_update',
        runId: job.runId,
        job: { id: job.id, status: 'pending', attempts: newAttempts, lastError, failureKind: kind },
      } satisfies WorkerJobEvent);
      logWorker(
        `job ${job.id} retry ${newAttempts}/${this.config.maxAttempts} (${kind}): ${lastError}`,
        'warn',
        job.runId,
      );
    } else {
      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          status: 'failed' as any,
          attempts: newAttempts,
          lastError,
          failureKind: kind,
          finishedAt: new Date(),
        },
      });
      eventBus.emit('worker', {
        type: 'job_update',
        runId: job.runId,
        job: { id: job.id, status: 'failed', attempts: newAttempts, lastError, failureKind: kind },
      } satisfies WorkerJobEvent);
      logWorker(`job ${job.id} FAILED (${kind}): ${lastError}`, 'error', job.runId);
      const newRunStatus = await updateRunStatus(job.runId);
      if (newRunStatus) {
        eventBus.emit('worker', {
          type: 'run_update',
          runId: job.runId,
          status: newRunStatus,
          finishedAt: new Date().toISOString(),
        } satisfies WorkerRunEvent);
      }
    }
  }

  // Assembles the provider runtime overrides for a job: per-run model/agent
  // from the run metadata, plus stored provider credentials for OpenCode.
  private async buildProviderOverrides(
    job: LoadedJob,
  ): Promise<ProviderConfigOverrides | undefined> {
    const settings = readProviderSettings(job.run.metadata);
    if (job.providerId !== 'opencode') return settings;
    const credentials = await loadProviderCredentials();
    if (Object.keys(credentials).length === 0) return settings;
    return { ...settings, credentials };
  }

  private resolveProvider(
    providerId: string,
    overrides?: ProviderConfigOverrides,
  ): AnalysisProvider | undefined {
    if ('analyze' in this.provider) return this.provider;
    return this.provider.get(providerId, overrides);
  }
}
