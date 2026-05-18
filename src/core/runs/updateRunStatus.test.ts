import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/prisma', () => ({
  prisma: {
    analysisJob: { count: vi.fn() },
    analysisRun: { update: vi.fn() },
  },
}));

import { updateRunStatus } from './updateRunStatus';
import { prisma } from '../../db/prisma';

const mockCount = vi.mocked(prisma.analysisJob.count);
const mockRunUpdate = vi.mocked(prisma.analysisRun.update);

beforeEach(() => {
  vi.resetAllMocks();
  mockRunUpdate.mockResolvedValue({} as any);
});

// Helper: mock the four counts in order (total, active, failed, nonRetryable)
function mockCounts(total: number, active: number, failed: number, nonRetryable: number) {
  mockCount
    .mockResolvedValueOnce(total)
    .mockResolvedValueOnce(active)
    .mockResolvedValueOnce(failed)
    .mockResolvedValueOnce(nonRetryable);
}

describe('updateRunStatus', () => {
  it('does not update the run when there are no jobs', async () => {
    mockCounts(0, 0, 0, 0);
    await updateRunStatus('run-1');
    expect(mockRunUpdate).not.toHaveBeenCalled();
  });

  it('does not update the run when active jobs remain', async () => {
    mockCounts(3, 1, 0, 0);
    await updateRunStatus('run-1');
    expect(mockRunUpdate).not.toHaveBeenCalled();
  });

  it('sets status to completed when all jobs succeeded', async () => {
    mockCounts(3, 0, 0, 0);
    await updateRunStatus('run-1');
    expect(mockRunUpdate).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({ status: 'completed' }),
    });
  });

  it('sets status to failed when some jobs failed but none are non_retryable', async () => {
    mockCounts(3, 0, 1, 0);
    await updateRunStatus('run-1');
    expect(mockRunUpdate).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({ status: 'failed' }),
    });
  });

  it('sets status to blocked when at least one job has a non_retryable failure', async () => {
    mockCounts(3, 0, 2, 1);
    await updateRunStatus('run-1');
    expect(mockRunUpdate).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({ status: 'blocked' }),
    });
  });

  it('sets finishedAt when the run reaches a terminal status', async () => {
    mockCounts(1, 0, 0, 0);
    await updateRunStatus('run-1');
    expect(mockRunUpdate).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({ finishedAt: expect.any(Date) }),
    });
  });

  it('does not call updateRunStatus when one job retries but another is still active', async () => {
    mockCounts(5, 2, 0, 0);
    await updateRunStatus('run-1');
    expect(mockRunUpdate).not.toHaveBeenCalled();
  });
});
