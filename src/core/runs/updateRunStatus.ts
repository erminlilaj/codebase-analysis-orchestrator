import { prisma } from '../../db/prisma';

export async function updateRunStatus(runId: string): Promise<void> {
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

  if (total === 0 || active > 0) return;

  const status = nonRetryable > 0 ? 'blocked' : failed > 0 ? 'failed' : 'completed';

  await prisma.analysisRun.update({
    where: { id: runId },
    data: { status, finishedAt: new Date() },
  });
}
