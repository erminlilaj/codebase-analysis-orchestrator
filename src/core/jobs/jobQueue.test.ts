import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

import { claimNextJobs } from './jobQueue';
import { prisma } from '../../db/prisma';

const mockTransaction = vi.mocked(prisma.$transaction);

function makeTx(rows: Array<{ id: string }> = []) {
  return {
    $queryRaw: vi.fn().mockResolvedValue(rows),
    analysisJob: { updateMany: vi.fn().mockResolvedValue({ count: rows.length }) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('claimNextJobs', () => {
  it('returns empty array and skips transaction when limit is 0', async () => {
    const ids = await claimNextJobs(0);
    expect(ids).toEqual([]);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('returns empty array and skips transaction when limit is negative', async () => {
    const ids = await claimNextJobs(-5);
    expect(ids).toEqual([]);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('returns empty array and does not call updateMany when no pending jobs exist', async () => {
    const tx = makeTx([]);
    mockTransaction.mockImplementation(async (cb: any) => cb(tx));

    const ids = await claimNextJobs(5);
    expect(ids).toEqual([]);
    expect(tx.analysisJob.updateMany).not.toHaveBeenCalled();
  });

  it('returns claimed job ids', async () => {
    const tx = makeTx([{ id: 'job-1' }, { id: 'job-2' }]);
    mockTransaction.mockImplementation(async (cb: any) => cb(tx));

    const ids = await claimNextJobs(5);
    expect(ids).toEqual(['job-1', 'job-2']);
  });

  it('marks claimed jobs as running with claimedAt and startedAt set', async () => {
    const before = Date.now();
    const tx = makeTx([{ id: 'job-1' }]);
    mockTransaction.mockImplementation(async (cb: any) => cb(tx));

    await claimNextJobs(1);

    const call = tx.analysisJob.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: { in: ['job-1'] } });
    expect(call.data.status).toBe('running');
    expect(call.data.claimedAt).toBeInstanceOf(Date);
    expect(call.data.startedAt).toBeInstanceOf(Date);
    expect(call.data.claimedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('claims exactly the rows returned by the raw query', async () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const tx = makeTx(rows);
    mockTransaction.mockImplementation(async (cb: any) => cb(tx));

    const ids = await claimNextJobs(10);
    expect(ids).toHaveLength(3);
    expect(ids).toEqual(['a', 'b', 'c']);
  });
});
