import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    analysisJob: { updateMany: vi.fn() },
    analysisRun: { updateMany: vi.fn() },
  },
}));

import { retryJobs } from './retryJobs';
import { prisma } from '../../db/prisma';

const mockTransaction = vi.mocked(prisma.$transaction);
const mockJobUpdateMany = vi.mocked(prisma.analysisJob.updateMany);
const mockRunUpdateMany = vi.mocked(prisma.analysisRun.updateMany);

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction.mockResolvedValue(undefined as any);
});

describe('retryJobs', () => {
  it('resets the given jobs to a fresh pending state, scoped to the run', async () => {
    await retryJobs('run-1', ['job-1', 'job-2']);

    expect(mockJobUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['job-1', 'job-2'] }, runId: 'run-1' },
      data: {
        status: 'pending',
        attempts: 0,
        lastError: null,
        failureKind: null,
        claimedAt: null,
        startedAt: null,
        finishedAt: null,
      },
    });
  });

  it('reopens a run only when it finished as failed or blocked', async () => {
    await retryJobs('run-1', ['job-1']);

    expect(mockRunUpdateMany).toHaveBeenCalledWith({
      where: { id: 'run-1', status: { in: ['failed', 'blocked'] } },
      data: { status: 'running', finishedAt: null },
    });
  });

  it('runs the job reset and run reset inside a single transaction', async () => {
    await retryJobs('run-1', ['job-1']);

    expect(mockTransaction).toHaveBeenCalledOnce();
    const ops = mockTransaction.mock.calls[0]![0] as unknown as unknown[];
    expect(Array.isArray(ops)).toBe(true);
    expect(ops).toHaveLength(2);
  });
});
