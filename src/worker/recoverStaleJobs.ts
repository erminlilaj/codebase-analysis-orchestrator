import { prisma } from '../db/prisma';

/**
 * Finds jobs stuck in `running` or `claimed` state longer than
 * `staleTimeoutSeconds` and resets them to `pending` so they can be
 * re-claimed by a healthy worker.
 *
 * Returns the number of jobs recovered.
 */
export async function recoverStaleJobs(staleTimeoutSeconds: number): Promise<number> {
  const cutoff = new Date(Date.now() - staleTimeoutSeconds * 1000);

  const { count } = await prisma.analysisJob.updateMany({
    where: {
      status: { in: ['running', 'claimed'] as any },
      updatedAt: { lt: cutoff },
    },
    data: {
      status: 'pending' as any,
      claimedAt: null,
      startedAt: null,
      lastError: 'recovered: stale job reset to pending',
    },
  });

  return count;
}
