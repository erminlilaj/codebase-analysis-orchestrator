import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/prisma', () => ({
  prisma: {
    analysisJob: {
      updateMany: vi.fn(),
    },
  },
}));

import { recoverStaleJobs } from './recoverStaleJobs';
import { prisma } from '../db/prisma';

const mockUpdateMany = vi.mocked(prisma.analysisJob.updateMany);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('recoverStaleJobs', () => {
  it('returns 0 when no stale jobs are found', async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 } as any);
    const count = await recoverStaleJobs(300);
    expect(count).toBe(0);
  });

  it('returns the number of jobs recovered', async () => {
    mockUpdateMany.mockResolvedValue({ count: 4 } as any);
    const count = await recoverStaleJobs(300);
    expect(count).toBe(4);
  });

  it('targets running and claimed jobs', async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 } as any);
    await recoverStaleJobs(300);

    const call = mockUpdateMany.mock.calls[0][0] as any;
    expect(call.where.status).toEqual({ in: expect.arrayContaining(['running', 'claimed']) });
  });

  it('resets jobs to pending and clears claimedAt and startedAt', async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 } as any);
    await recoverStaleJobs(300);

    const call = mockUpdateMany.mock.calls[0][0];
    expect(call.data.status).toBe('pending');
    expect(call.data.claimedAt).toBeNull();
    expect(call.data.startedAt).toBeNull();
  });

  it('uses a cutoff derived from staleTimeoutSeconds', async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 } as any);

    const before = Date.now();
    await recoverStaleJobs(600);
    const after = Date.now();

    const call = mockUpdateMany.mock.calls[0][0] as any;
    const cutoff: Date = call.where.updatedAt.lt;
    expect(cutoff).toBeInstanceOf(Date);

    // cutoff should be roughly (now - 600s)
    const expectedMin = before - 600_000 - 50;
    const expectedMax = after - 600_000 + 50;
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(cutoff.getTime()).toBeLessThanOrEqual(expectedMax);
  });
});
