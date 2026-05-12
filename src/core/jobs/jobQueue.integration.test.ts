import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../db/prisma';
import { claimNextJobs } from './jobQueue';

const describeLive = process.env.RUN_LIVE_DB_TESTS === '1' ? describe : describe.skip;

describeLive('claimNextJobs live Postgres concurrency', () => {
  const suffix = `phase15-${Date.now()}`;
  const projectId = `${suffix}-project`;
  const sourceFileId = `${suffix}-file`;
  const bundleId = `${suffix}-bundle`;
  const questionId = `${suffix}-question`;
  const runId = `${suffix}-run`;
  const jobIds = Array.from({ length: 4 }, (_, i) => `${suffix}-job-${i + 1}`);

  beforeAll(async () => {
    await prisma.project.create({
      data: {
        id: projectId,
        name: 'Phase 15 queue integration',
        repoPath: '/tmp/phase15',
        language: 'cobol',
      },
    });
    await prisma.sourceFile.create({
      data: {
        id: sourceFileId,
        projectId,
        relativePath: 'MAIN.cob',
        language: 'cobol',
      },
    });
    await prisma.analysisBundle.create({
      data: {
        id: bundleId,
        projectId,
        files: {
          create: {
            fileId: sourceFileId,
            role: 'main',
          },
        },
      },
    });
    await prisma.question.create({
      data: {
        id: questionId,
        key: `${suffix}-purpose`,
        text: 'What does this file do?',
        language: 'cobol',
      },
    });
    await prisma.analysisRun.create({
      data: {
        id: runId,
        projectId,
      },
    });
    await prisma.analysisJob.createMany({
      data: jobIds.map((id, index) => ({
        id,
        runId,
        bundleId,
        questionId,
        providerId: 'stub',
        priority: 10 - index,
      })),
    });
  });

  afterAll(async () => {
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.question.deleteMany({ where: { id: questionId } });
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
