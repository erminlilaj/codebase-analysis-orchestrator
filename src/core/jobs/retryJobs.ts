import { prisma } from '../../db/prisma';

/**
 * Resets the given jobs back to a fresh `pending` state so the worker can
 * claim them again, and reopens the run if it had already finished
 * unsuccessfully (`failed` or `blocked`).
 *
 * Job IDs are expected to be pre-validated as `failed` jobs belonging to
 * `runId`; the job update is still scoped by `runId` as defence in depth.
 * Both updates run in a single transaction so a run is never reopened
 * without its jobs being requeued, and vice versa.
 */
export async function retryJobs(runId: string, jobIds: string[]): Promise<void> {
  await prisma.$transaction([
    prisma.analysisJob.updateMany({
      where: { id: { in: jobIds }, runId },
      data: {
        status: 'pending',
        attempts: 0,
        lastError: null,
        failureKind: null,
        claimedAt: null,
        startedAt: null,
        finishedAt: null,
      },
    }),
    prisma.analysisRun.updateMany({
      where: { id: runId, status: { in: ['failed', 'blocked'] } },
      data: { status: 'running', finishedAt: null },
    }),
  ]);
}
