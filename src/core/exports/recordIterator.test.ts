import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/prisma', () => ({
  prisma: {
    project: { findUnique: vi.fn() },
    analysisJob: { findMany: vi.fn() },
  },
}));

import { streamRecords } from './recordIterator';
import { prisma } from '../../db/prisma';

const mockProjectFind = vi.mocked(prisma.project.findUnique);
const mockJobFind = vi.mocked(prisma.analysisJob.findMany);

async function collect(gen: ReturnType<typeof streamRecords>) {
  const out = [];
  for await (const r of gen) out.push(r);
  return out;
}

const project = { id: 'p1', name: 'Demo', repoPath: '/repos/demo', language: 'cobol' };

const makeJob = (overrides: Record<string, unknown> = {}) => ({
  id: 'job-1',
  runId: 'run-1',
  bundleId: 'bundle-1',
  questionVersion: 1,
  run: { status: 'completed' },
  status: 'completed',
  providerId: 'stub',
  attempts: 1,
  lastError: null,
  failureKind: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  metadata: {},
  question: { key: 'purpose', text: 'What is the purpose?', language: 'cobol', version: 1 },
  answer: {
    modelId: 'stub-v1',
    tokensUsed: 42,
    rawOutput: 'It processes payroll.',
    parsed: { summary: 'payroll' },
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
  },
  bundle: {
    files: [
      {
        role: 'main',
        file: { relativePath: 'src/MAIN.cob', language: 'cobol' },
      },
    ],
  },
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('streamRecords', () => {
  it('yields nothing when project is not found', async () => {
    mockProjectFind.mockResolvedValue(null);
    const records = await collect(streamRecords({ projectId: 'missing' }));
    expect(records).toHaveLength(0);
    expect(mockJobFind).not.toHaveBeenCalled();
  });

  it('yields nothing when there are no jobs', async () => {
    mockProjectFind.mockResolvedValue(project as any);
    mockJobFind.mockResolvedValue([]);
    const records = await collect(streamRecords({ projectId: 'p1' }));
    expect(records).toHaveLength(0);
  });

  it('yields a correctly shaped ExportRecord for a completed job', async () => {
    mockProjectFind.mockResolvedValue(project as any);
    mockJobFind.mockResolvedValueOnce([makeJob()] as any);

    const records = await collect(streamRecords({ projectId: 'p1' }));
    expect(records).toHaveLength(1);

    const r = records[0]!;
    expect(r.projectId).toBe('p1');
    expect(r.projectName).toBe('Demo');
    expect(r.runId).toBe('run-1');
    expect(r.runStatus).toBe('completed');
    expect(r.jobId).toBe('job-1');
    expect(r.jobStatus).toBe('completed');
    expect(r.bundleId).toBe('bundle-1');
    expect(r.mainFilePath).toBe('src/MAIN.cob');
    expect(r.mainFileLanguage).toBe('cobol');
    expect(r.questionKey).toBe('purpose');
    expect(r.questionText).toBe('What is the purpose?');
    expect(r.questionLanguage).toBe('cobol');
    expect(r.providerId).toBe('stub');
    expect(r.attempts).toBe(1);
    expect(r.lastError).toBeNull();
    expect(r.failureKind).toBeNull();
    expect(r.modelId).toBe('stub-v1');
    expect(r.tokensUsed).toBe(42);
    expect(r.rawOutput).toBe('It processes payroll.');
    expect(r.parsedJson).toEqual({ summary: 'payroll' });
    expect(r.answeredAt).toBe('2026-01-02T00:00:00.000Z');
    expect(r.jobCreatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('yields null answer fields when the job has no answer', async () => {
    mockProjectFind.mockResolvedValue(project as any);
    mockJobFind.mockResolvedValueOnce([makeJob({ answer: null })] as any);

    const records = await collect(streamRecords({ projectId: 'p1' }));
    const r = records[0]!;
    expect(r.modelId).toBeNull();
    expect(r.tokensUsed).toBeNull();
    expect(r.rawOutput).toBeNull();
    expect(r.parsedJson).toBeNull();
    expect(r.answeredAt).toBeNull();
  });

  it('yields null mainFilePath when the bundle has no main file', async () => {
    mockProjectFind.mockResolvedValue(project as any);
    mockJobFind.mockResolvedValueOnce([makeJob({ bundle: { files: [] } })] as any);

    const records = await collect(streamRecords({ projectId: 'p1' }));
    expect(records[0]!.mainFilePath).toBeNull();
    expect(records[0]!.mainFileLanguage).toBeNull();
  });

  it('yields failureKind when the job has one', async () => {
    mockProjectFind.mockResolvedValue(project as any);
    mockJobFind.mockResolvedValueOnce([makeJob({ failureKind: 'parse_error' })] as any);

    const records = await collect(streamRecords({ projectId: 'p1' }));
    expect(records[0]!.failureKind).toBe('parse_error');
  });

  it('yields stale=false when questionVersion matches the question version', async () => {
    mockProjectFind.mockResolvedValue(project as any);
    mockJobFind.mockResolvedValueOnce([makeJob()] as any);

    const records = await collect(streamRecords({ projectId: 'p1' }));
    expect(records[0]!.stale).toBe(false);
  });

  it('yields stale=true when the question version is ahead of questionVersion', async () => {
    mockProjectFind.mockResolvedValue(project as any);
    mockJobFind.mockResolvedValueOnce([
      makeJob({
        questionVersion: 1,
        question: {
          key: 'purpose',
          text: 'What is the purpose?',
          language: 'cobol',
          version: 2,
        },
      }),
    ] as any);

    const records = await collect(streamRecords({ projectId: 'p1' }));
    expect(records[0]!.stale).toBe(true);
  });

  it('passes the runId filter to the DB query', async () => {
    mockProjectFind.mockResolvedValue(project as any);
    mockJobFind.mockResolvedValue([]);

    await collect(streamRecords({ projectId: 'p1', runId: 'run-99' }));

    const callArgs = mockJobFind.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(callArgs.where).toMatchObject({ runId: 'run-99' });
  });

  it('does not include runId in the query when omitted', async () => {
    mockProjectFind.mockResolvedValue(project as any);
    mockJobFind.mockResolvedValue([]);

    await collect(streamRecords({ projectId: 'p1' }));

    const callArgs = mockJobFind.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(callArgs.where).not.toHaveProperty('runId');
  });

  it('paginates using offset when a full page is returned', async () => {
    mockProjectFind.mockResolvedValue(project as any);
    const page = Array.from({ length: 2 }, (_, i) =>
      makeJob({ id: `job-${i + 1}`, runId: 'run-1' }),
    );
    // First page full (pageSize=2), second page empty
    mockJobFind.mockResolvedValueOnce(page as any).mockResolvedValueOnce([]);

    const records = await collect(streamRecords({ projectId: 'p1', pageSize: 2 }));
    expect(records).toHaveLength(2);
    expect(mockJobFind).toHaveBeenCalledTimes(2);

    const secondCall = mockJobFind.mock.calls[1]![0] as { skip: number };
    expect(secondCall.skip).toBe(2);
  });

  it('stops paginating when a partial page is returned', async () => {
    mockProjectFind.mockResolvedValue(project as any);
    // Only 1 job returned when pageSize is 2 → stop immediately
    mockJobFind.mockResolvedValueOnce([makeJob()] as any);

    const records = await collect(streamRecords({ projectId: 'p1', pageSize: 2 }));
    expect(records).toHaveLength(1);
    expect(mockJobFind).toHaveBeenCalledTimes(1);
  });
});
