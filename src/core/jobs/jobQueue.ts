import { prisma } from '../../db/prisma';

/**
 * Atomically claims up to `limit` pending jobs and marks them as running.
 * Uses SELECT FOR UPDATE SKIP LOCKED so concurrent workers never claim the
 * same row.
 *
 * Returns the ids of the claimed jobs.
 */
export async function claimNextJobs(limit: number): Promise<string[]> {
  if (limit <= 0) return [];

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "AnalysisJob"
      WHERE status = 'pending'::"JobStatus"
      ORDER BY priority DESC, "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const now = new Date();

    await tx.analysisJob.updateMany({
      where: { id: { in: ids } },
      data: {
        status: 'running',
        claimedAt: now,
        startedAt: now,
      },
    });

    return ids;
  });
}
