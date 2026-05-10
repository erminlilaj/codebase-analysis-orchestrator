import { prisma } from '../../db/prisma';
import type { AnalysisQuestion } from '../../providers/common/types';

/**
 * Returns all questions that apply to the given language:
 * language-specific questions (language = X) plus universal ones (language = null).
 */
export async function getQuestionsForLanguage(language: string): Promise<AnalysisQuestion[]> {
  const rows = await prisma.question.findMany({
    where: { OR: [{ language }, { language: null }] },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map((r) => ({ id: r.id, key: r.key, text: r.text }));
}
