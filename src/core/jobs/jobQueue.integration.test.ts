import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../db/prisma';
import { claimNextJobs } from './jobQueue';
import { recoverStaleJobs } from '../../worker/recoverStaleJobs';

const describeLive = process.env.RUN_LIVE_DB_TESTS === '1' ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

async function createProjectFixtures(suffix: string) {
  const projectId = `${suffix}-project`;
  const sourceFileId = `${suffix}-file`;
  const bundleId = `${suffix}-bundle`;
  const questionId = `${suffix}-question`;
  const runId = `${suffix}-run`;

  await prisma.project.create({
    data: {
      id: projectId,
      name: `Integration test project ${suffix}`,
      repoPath: `/tmp/${suffix}`,
      language: 'cobol',
    },
  });
  await prisma.sourceFile.create({
    data: { id: sourceFileId, projectId, relativePath: 'MAIN.cob', language: 'cobol' },
  });
  await prisma.analysisBundle.create({
    data: {
      id: bundleId,
      projectId,
      files: { create: { fileId: sourceFileId, role: 'main' } },
    },
  });
  await prisma.question.create({
    data: { id: questionId, key: `${suffix}-purpose`, text: 'What does this file do?', language: 'cobol' },
  });
  await prisma.analysisRun.create({ data: { id: runId, projectId } });

  return { projectId, bundleId, questionId, runId };
}

async function cleanupProject(projectId: string, questionId: string) {
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.question.deleteMany({ where: { id: questionId } });
}

// ---------------------------------------------------------------------------
// Suite 1: concurrent job claiming
// ---------------------------------------------------------------------------

describeLive('claimNextJobs live Postgres concurrency', () => {
  const suffix = `claim-${Date.now()}`;
  let fixtures: Awaited<ReturnType<typeof createProjectFixtures>>;
  const jobIds = Array.from({ length: 4 }, (_, i) => `${suffix}-job-${i + 1}`);

  beforeAll(async () => {
    fixtures = await createProjectFixtures(suffix);
    await prisma.analysisJob.createMany({
      data: jobIds.map((id, index) => ({
        id,
        runId: fixtures.runId,
        bundleId: fixtures.bundleId,
        questionId: fixtures.questionId,
        providerId: 'stub',
        priority: 10 - index,
      })),
    });
  });

  afterAll(async () => {
    await cleanupProject(fixtures.projectId, fixtures.questionId);
    await prisma.$disconnect();
  });

  it('does not claim the same pending job from concurrent workers', async () => {
    const [first, second] = await Promise.all([claimNextJobs(3), claimNextJobs(3)]);
    const claimed = [...first, ...second];

    expect(claimed).toHaveLength(4);
    expect(new Set(claimed).size).toBe(4);
    expect(claimed.sort()).toEqual([...jobIds].sort());

    const rows = await prisma.analysisJob.findMany({
      where: { id: { in: jobIds } },
      select: { id: true, status: true, claimedAt: true, startedAt: true },
    });

    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.status).toBe('running');
      expect(row.claimedAt).toBeInstanceOf(Date);
      expect(row.startedAt).toBeInstanceOf(Date);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 2: stale job recovery
// ---------------------------------------------------------------------------

describeLive('recoverStaleJobs live Postgres', () => {
  const suffix = `stale-${Date.now()}`;
  let fixtures: Awaited<ReturnType<typeof createProjectFixtures>>;
  let freshJobId: string;
  let staleJobId: string;

  beforeAll(async () => {
    fixtures = await createProjectFixtures(suffix);
    freshJobId = `${suffix}-fresh`;
    staleJobId = `${suffix}-stale`;

    await prisma.analysisJob.createMany({
      data: [
        {
          id: freshJobId,
          runId: fixtures.runId,
          bundleId: fixtures.bundleId,
          questionId: fixtures.questionId,
          providerId: 'stub',
          status: 'running' as any,
        },
        {
          id: staleJobId,
          runId: fixtures.runId,
          bundleId: fixtures.bundleId,
          questionId: fixtures.questionId,
          providerId: 'stub',
          status: 'running' as any,
        },
      ],
    });

    // Back-date the stale job's updatedAt to 10 minutes ago via raw SQL so it
    // falls outside any reasonable staleTimeoutSeconds value used in tests.
    await prisma.$executeRawUnsafe(
      `UPDATE "AnalysisJob" SET "updatedAt" = NOW() - INTERVAL '10 minutes' WHERE id = $1`,
      staleJobId,
    );
  });

  afterAll(async () => {
    await cleanupProject(fixtures.projectId, fixtures.questionId);
  });

  it('resets only stale running jobs to pending', async () => {
    const staleTimeoutSeconds = 60; // 1 minute — stale job (10 min old) is recovered, fresh is not
    const count = await recoverStaleJobs(staleTimeoutSeconds);

    expect(count).toBeGreaterThanOrEqual(1);

    const stale = await prisma.analysisJob.findUnique({
      where: { id: staleJobId },
      select: { status: true, lastError: true, claimedAt: true },
    });
    expect(stale?.status).toBe('pending');
    expect(stale?.claimedAt).toBeNull();
    expect(stale?.lastError).toContain('stale');

    const fresh = await prisma.analysisJob.findUnique({
      where: { id: freshJobId },
      select: { status: true },
    });
    expect(fresh?.status).toBe('running');
  });

  it('returns 0 when no jobs are stale', async () => {
    // All running jobs are now either pending (the stale one) or fresh.
    // Use a 1-second timeout — fresh job is way newer than 1 second... wait,
    // that would recover the fresh one. Use a very short timeout only if we
    // first reset the stale job back to pending (already done above) and the
    // fresh one is still running. We want 0 stale with a generous timeout.
    const count = await recoverStaleJobs(600); // 10-minute window — fresh job is safe
    expect(count).toBe(0);
  });
});
