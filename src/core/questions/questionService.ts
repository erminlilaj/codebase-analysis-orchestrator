import { prisma } from '../../db/prisma';
import type { AnalysisQuestion } from '../../providers/common/types';

/**
 * Returns all questions that apply to the given language:
 * shared language-specific questions (language = X), shared universal
 * questions (language = null), plus questions private to this project.
 */
export async function getQuestionsForLanguage(language: string): Promise<AnalysisQuestion[]> {
  return getQuestionsForProject(undefined, language);
}

export async function getQuestionsForProject(
  projectId: string | undefined,
  language: string,
): Promise<AnalysisQuestion[]> {
  const rows = await prisma.question.findMany({
    where: {
      OR: [
        { projectId: null, language },
        { projectId: null, language: null },
        ...(projectId ? [{ projectId }] : []),
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map((r) => ({ id: r.id, key: r.key, text: r.text }));
}
