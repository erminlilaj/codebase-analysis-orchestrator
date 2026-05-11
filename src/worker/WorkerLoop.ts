import path from 'path';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import type { AnalysisProvider } from '../providers/common/AnalysisProvider';
import type { AnalysisBundle, SourceFile } from '../languages/common/types';
import { claimNextJobs } from '../core/jobs/jobQueue';
import { recoverStaleJobs } from './recoverStaleJobs';
import { shouldRetry } from '../core/jobs/retryPolicy';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkspaceBuilder = {
  build(jobId: string, bundle: AnalysisBundle): Promise<string>;
  cleanup(jobId: string): Promise<void>;
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

// ---------------------------------------------------------------------------
// WorkerLoop
// ---------------------------------------------------------------------------

export class WorkerLoop {
  private running = false;

  constructor(
    private readonly provider: AnalysisProvider,
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

    let bundle: AnalysisBundle;
    try {
      bundle = reconstructBundle(job);
    } catch (err) {
      await this.handleFailure(job, err);
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
      const result = await this.provider.analyze({
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

      await prisma.analysisAnswer.create({
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
    } catch (err) {
      await this.handleFailure(job, err);
    } finally {
      await this.workspace.cleanup(jobId).catch(() => {});
    }
  }

  private async handleFailure(job: LoadedJob, error: unknown): Promise<void> {
    const newAttempts = job.attempts + 1;
    const lastError = error instanceof Error ? error.message : String(error);

    if (shouldRetry(newAttempts, this.config.maxAttempts, error)) {
      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          status: 'pending' as any,
          attempts: newAttempts,
          lastError,
          claimedAt: null,
          startedAt: null,
        },
      });
    } else {
      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          status: 'failed' as any,
          attempts: newAttempts,
          lastError,
          finishedAt: new Date(),
        },
      });
    }
  }
}
