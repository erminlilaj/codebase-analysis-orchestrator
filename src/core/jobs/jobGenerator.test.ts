import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/prisma', () => ({
  prisma: {
    analysisJob: {
      createMany: vi.fn(),
    },
    question: {
      findMany: vi.fn(),
    },
  },
}));

import { generateJobs } from './jobGenerator';
import { prisma } from '../../db/prisma';

const mockCreateMany = vi.mocked(prisma.analysisJob.createMany);
const mockQuestionFind = vi.mocked(prisma.question.findMany);

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateMany.mockResolvedValue({ count: 0 } as any);
  mockQuestionFind.mockResolvedValue([] as any);
});

describe('generateJobs', () => {
  it('returns 0 and makes no DB calls when bundleIds is empty', async () => {
    const count = await generateJobs({
      runId: 'r1', bundleIds: [], questionIds: ['q1'], providerId: 'bob',
    });
    expect(count).toBe(0);
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it('returns 0 and makes no DB calls when questionIds is empty', async () => {
    const count = await generateJobs({
      runId: 'r1', bundleIds: ['b1'], questionIds: [], providerId: 'bob',
    });
    expect(count).toBe(0);
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it('creates bundleIds.length × questionIds.length jobs', async () => {
    mockCreateMany.mockResolvedValue({ count: 6 } as any);

    const count = await generateJobs({
      runId: 'r1',
      bundleIds: ['b1', 'b2'],
      questionIds: ['q1', 'q2', 'q3'],
      providerId: 'bob',
    });

    expect(count).toBe(6);
    expect(mockCreateMany).toHaveBeenCalledTimes(1);

    const call = mockCreateMany.mock.calls[0][0] as { data: unknown[] };
    expect(call.data).toHaveLength(6);
  });

  it('sets all required fields on each job', async () => {
    mockCreateMany.mockResolvedValue({ count: 1 } as any);

    await generateJobs({
      runId: 'run-1',
      bundleIds: ['bundle-1'],
      questionIds: ['question-1'],
      providerId: 'bob',
      priority: 5,
    });

    const call = mockCreateMany.mock.calls[0][0] as { data: unknown[] };
    expect(call.data[0]).toEqual({
      runId: 'run-1',
      bundleId: 'bundle-1',
      questionId: 'question-1',
      questionVersion: 1,
      providerId: 'bob',
      priority: 5,
    });
  });

  it('records the current question version on each job', async () => {
    mockQuestionFind.mockResolvedValue([{ id: 'q1', version: 3 }] as any);
    mockCreateMany.mockResolvedValue({ count: 1 } as any);

    await generateJobs({
      runId: 'r1', bundleIds: ['b1'], questionIds: ['q1'], providerId: 'bob',
    });

    const call = mockCreateMany.mock.calls[0][0] as { data: Array<{ questionVersion: number }> };
    expect(call.data[0].questionVersion).toBe(3);
  });

  it('defaults questionVersion to 1 when the question lookup returns nothing', async () => {
    mockQuestionFind.mockResolvedValue([] as any);
    mockCreateMany.mockResolvedValue({ count: 1 } as any);

    await generateJobs({
      runId: 'r1', bundleIds: ['b1'], questionIds: ['q1'], providerId: 'bob',
    });

    const call = mockCreateMany.mock.calls[0][0] as { data: Array<{ questionVersion: number }> };
    expect(call.data[0].questionVersion).toBe(1);
  });

  it('defaults priority to 0', async () => {
    mockCreateMany.mockResolvedValue({ count: 1 } as any);

    await generateJobs({
      runId: 'r1', bundleIds: ['b1'], questionIds: ['q1'], providerId: 'bob',
    });

    const call = mockCreateMany.mock.calls[0][0] as { data: Array<{ priority: number }> };
    expect(call.data[0].priority).toBe(0);
  });

  it('splits into multiple batches when total exceeds 500', async () => {
    mockCreateMany.mockResolvedValue({ count: 500 } as any);

    // 501 bundles × 1 question = 501 jobs → 2 batches
    const bundleIds = Array.from({ length: 501 }, (_, i) => `b${i}`);

    await generateJobs({
      runId: 'r1', bundleIds, questionIds: ['q1'], providerId: 'bob',
    });

    expect(mockCreateMany).toHaveBeenCalledTimes(2);
    const first = mockCreateMany.mock.calls[0][0] as { data: unknown[] };
    const second = mockCreateMany.mock.calls[1][0] as { data: unknown[] };
    expect(first.data).toHaveLength(500);
    expect(second.data).toHaveLength(1);
  });
});
