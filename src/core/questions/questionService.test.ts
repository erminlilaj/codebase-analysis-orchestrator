import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/prisma', () => ({
  prisma: {
    question: {
      findMany: vi.fn(),
    },
  },
}));

import { getQuestionsForLanguage } from './questionService';
import { prisma } from '../../db/prisma';

const mockFindMany = vi.mocked(prisma.question.findMany);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getQuestionsForLanguage', () => {
  it('returns language-specific and universal questions', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'q1', key: 'purpose', text: 'Purpose?', language: 'cobol', metadata: {}, createdAt: new Date() },
      { id: 'q2', key: 'complexity', text: 'How complex?', language: null, metadata: {}, createdAt: new Date() },
    ] as any);

    const result = await getQuestionsForLanguage('cobol');

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { OR: [{ language: 'cobol' }, { language: null }] },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 'q1', key: 'purpose', text: 'Purpose?' });
    expect(result[1]).toEqual({ id: 'q2', key: 'complexity', text: 'How complex?' });
  });

  it('returns empty array when no questions match', async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await getQuestionsForLanguage('java');
    expect(result).toHaveLength(0);
  });
});
