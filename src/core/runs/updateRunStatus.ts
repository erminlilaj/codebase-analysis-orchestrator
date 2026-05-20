import { prisma } from '../../db/prisma';

/** Recomputes and persists the run's terminal status.
 *  Returns the new status string if the run was updated, null otherwise.
 *  Does not overwrite a run that was already cancelled. */
export async function updateRunStatus(runId: string): Promise<string | null> {
  const run = await prisma.analysisRun.findUnique({ where: { id: runId }, select: { status: true } });
  if (!run || run.status === 'cancelled') return null;

  const [total, active, failed, nonRetryable] = await Promise.all([
    prisma.analysisJob.count({ where: { runId } }),
    prisma.analysisJob.count({
      where: { runId, status: { in: ['pending', 'claimed', 'running'] } },
    }),
    prisma.analysisJob.count({ where: { runId, status: 'failed' } }),
    prisma.analysisJob.count({
      where: { runId, status: 'failed', failureKind: 'non_retryable' },
    }),
  ]);

  if (total === 0 || active > 0) return null;

  const status = nonRetryable > 0 ? 'blocked' : failed > 0 ? 'failed' : 'completed';

  await prisma.analysisRun.update({
    where: { id: runId },
    data: { status, finishedAt: new Date() },
  });

  return status;
}
