import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/prisma', () => ({
  prisma: {
    analysisJob: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    analysisAnswer: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../core/jobs/jobQueue', () => ({
  claimNextJobs: vi.fn(),
}));

vi.mock('./recoverStaleJobs', () => ({
  recoverStaleJobs: vi.fn(),
}));

import { WorkerLoop } from './WorkerLoop';
import { prisma } from '../db/prisma';
import { claimNextJobs } from '../core/jobs/jobQueue';
import { recoverStaleJobs } from './recoverStaleJobs';

const mockFindUnique = vi.mocked(prisma.analysisJob.findUnique);
const mockJobUpdate = vi.mocked(prisma.analysisJob.update);
const mockAnswerCreate = vi.mocked(prisma.analysisAnswer.create);
const mockClaimNextJobs = vi.mocked(claimNextJobs);
const mockRecoverStaleJobs = vi.mocked(recoverStaleJobs);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeJob = (overrides: Record<string, unknown> = {}) => ({
  id: 'job-1',
  runId: 'run-1',
  attempts: 0,
  metadata: {},
  run: { projectId: 'project-1' },
  bundle: {
    id: 'bundle-1',
    metadata: {},
    project: { repoPath: '/repo' },
    files: [
      {
        role: 'main',
        file: {
          id: 'file-1',
          projectId: 'project-1',
          relativePath: 'src/main.cob',
          language: 'cobol',
          sizeBytes: 1024,
          metadata: { checksum: 'abc123' },
        },
      },
    ],
  },
  question: {
    id: 'question-1',
    key: 'purpose',
    text: 'What is the purpose of this file?',
  },
  ...overrides,
});

const makeProvider = () => ({
  id: 'mock',
  displayName: 'Mock Provider',
  analyze: vi.fn().mockResolvedValue({
    rawOutput: 'This file handles payroll.',
    parsedAnswer: { summary: 'payroll processing' },
    metadata: { modelId: 'mock-v1', tokensUsed: 42 },
  }),
});

const makeWorkspace = () => ({
  build: vi.fn().mockResolvedValue('/tmp/workspaces/job-1'),
  cleanup: vi.fn().mockResolvedValue(undefined),
});

const config = {
  concurrency: 4,
  pollIntervalMs: 1000,
  maxAttempts: 3,
  staleTimeoutSeconds: 300,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockJobUpdate.mockResolvedValue({} as any);
  mockAnswerCreate.mockResolvedValue({} as any);
  mockClaimNextJobs.mockResolvedValue([]);
  mockRecoverStaleJobs.mockResolvedValue(0);
});

describe('WorkerLoop.processJob', () => {
  it('returns early when job is not found in DB', async () => {
    mockFindUnique.mockResolvedValue(null);
    const worker = new WorkerLoop(makeProvider(), makeWorkspace(), config);

    await worker.processJob('nonexistent-job');

    expect(mockAnswerCreate).not.toHaveBeenCalled();
    expect(mockJobUpdate).not.toHaveBeenCalled();
  });

  it('persists the answer and marks job completed on success', async () => {
    mockFindUnique.mockResolvedValue(makeJob() as any);
    const provider = makeProvider();
    const workspace = makeWorkspace();
    const worker = new WorkerLoop(provider, workspace, config);

    await worker.processJob('job-1');

    expect(mockAnswerCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jobId: 'job-1',
        rawOutput: 'This file handles payroll.',
        modelId: 'mock-v1',
        tokensUsed: 42,
      }),
    });
    expect(mockJobUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({ status: 'completed' }),
    });
  });

  it('always calls workspace.cleanup even on success', async () => {
    mockFindUnique.mockResolvedValue(makeJob() as any);
    const workspace = makeWorkspace();
    const worker = new WorkerLoop(makeProvider(), workspace, config);

    await worker.processJob('job-1');

    expect(workspace.cleanup).toHaveBeenCalledWith('job-1');
  });

  it('always calls workspace.cleanup even on provider failure', async () => {
    mockFindUnique.mockResolvedValue(makeJob() as any);
    const workspace = makeWorkspace();
    const provider = makeProvider();
    provider.analyze.mockRejectedValue(new Error('validation error'));

    const worker = new WorkerLoop(provider, workspace, config);
    await worker.processJob('job-1');

    expect(workspace.cleanup).toHaveBeenCalledWith('job-1');
  });

  it('resets to pending on transient error when attempts < maxAttempts', async () => {
    mockFindUnique.mockResolvedValue(makeJob({ attempts: 0 }) as any);
    const provider = makeProvider();
    provider.analyze.mockRejectedValue(new Error('ECONNREFUSED'));

    const worker = new WorkerLoop(provider, workspace, config);
    await worker.processJob('job-1');

    expect(mockJobUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({
        status: 'pending',
        attempts: 1,
        claimedAt: null,
        startedAt: null,
      }),
    });
  });

  it('marks as failed on deterministic error regardless of attempts left', async () => {
    mockFindUnique.mockResolvedValue(makeJob({ attempts: 0 }) as any);
    const provider = makeProvider();
    provider.analyze.mockRejectedValue(new Error('invalid API key'));

    const worker = new WorkerLoop(provider, makeWorkspace(), config);
    await worker.processJob('job-1');

    expect(mockJobUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({ status: 'failed' }),
    });
  });

  it('marks as failed when max attempts exhausted even for transient error', async () => {
    mockFindUnique.mockResolvedValue(makeJob({ attempts: 2 }) as any); // attempts=2, max=3 → newAttempts=3, 3<3=false
    const provider = makeProvider();
    provider.analyze.mockRejectedValue(new Error('ECONNREFUSED'));

    const worker = new WorkerLoop(provider, makeWorkspace(), config);
    await worker.processJob('job-1');

    expect(mockJobUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({ status: 'failed', attempts: 3 }),
    });
  });

  it('marks as failed on workspace build error (non-retryable message)', async () => {
    mockFindUnique.mockResolvedValue(makeJob() as any);
    const workspace = makeWorkspace();
    workspace.build.mockRejectedValue(new Error('invalid workspace path'));

    const worker = new WorkerLoop(makeProvider(), workspace, config);
    await worker.processJob('job-1');

    expect(mockJobUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({ status: 'failed' }),
    });
    expect(mockAnswerCreate).not.toHaveBeenCalled();
  });

  it('records the error message in lastError', async () => {
    mockFindUnique.mockResolvedValue(makeJob() as any);
    const provider = makeProvider();
    provider.analyze.mockRejectedValue(new Error('something bad happened'));

    const worker = new WorkerLoop(provider, makeWorkspace(), config);
    await worker.processJob('job-1');

    const updateCall = mockJobUpdate.mock.calls[0][0] as any;
    expect(updateCall.data.lastError).toBe('something bad happened');
  });
});

describe('WorkerLoop.tick', () => {
  it('calls recoverStaleJobs with configured timeout', async () => {
    const worker = new WorkerLoop(makeProvider(), makeWorkspace(), config);
    await worker.tick();
    expect(mockRecoverStaleJobs).toHaveBeenCalledWith(config.staleTimeoutSeconds);
  });

  it('calls claimNextJobs with configured concurrency', async () => {
    const worker = new WorkerLoop(makeProvider(), makeWorkspace(), config);
    await worker.tick();
    expect(mockClaimNextJobs).toHaveBeenCalledWith(config.concurrency);
  });

  it('calls processJob for each claimed job id', async () => {
    mockClaimNextJobs.mockResolvedValue(['j1', 'j2', 'j3']);
    mockFindUnique.mockResolvedValue(null); // processJob returns early

    const worker = new WorkerLoop(makeProvider(), makeWorkspace(), config);
    const spy = vi.spyOn(worker, 'processJob').mockResolvedValue();

    await worker.tick();

    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy).toHaveBeenCalledWith('j1');
    expect(spy).toHaveBeenCalledWith('j2');
    expect(spy).toHaveBeenCalledWith('j3');
  });

  it('does not call processJob when no jobs are claimed', async () => {
    mockClaimNextJobs.mockResolvedValue([]);
    const worker = new WorkerLoop(makeProvider(), makeWorkspace(), config);
    const spy = vi.spyOn(worker, 'processJob').mockResolvedValue();

    await worker.tick();

    expect(spy).not.toHaveBeenCalled();
  });
});

// Inline workspace fixture used in some tests above
const workspace = makeWorkspace();
