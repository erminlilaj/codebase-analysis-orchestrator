import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

vi.mock('../../db/prisma', () => ({
  prisma: {
    project: { findUnique: vi.fn() },
    analysisRun: { findUnique: vi.fn() },
    export: { create: vi.fn() },
  },
}));

vi.mock('./recordIterator', () => ({
  streamRecords: vi.fn(),
}));

vi.mock('../../config/env', () => ({
  env: { EXPORT_ROOT: '' }, // filled in per test via outputDir
}));

import { runExport } from './exportService';
import { prisma } from '../../db/prisma';
import { streamRecords } from './recordIterator';
import type { ExportRecord } from './recordIterator';

const mockProjectFind = vi.mocked(prisma.project.findUnique);
const mockRunFind = vi.mocked(prisma.analysisRun.findUnique);
const mockExportCreate = vi.mocked(prisma.export.create);
const mockStreamRecords = vi.mocked(streamRecords);

const project = {
  id: 'p1',
  name: 'Demo',
  repoPath: '/repos/demo',
  language: 'cobol',
};

const run = { id: 'run-1', projectId: 'p1' };

function makeRecord(over: Partial<ExportRecord> = {}): ExportRecord {
  return {
    projectId: 'p1',
    projectName: 'Demo',
    runId: 'run-1',
    runStatus: 'completed',
    jobId: 'job-1',
    jobStatus: 'completed',
    bundleId: 'bundle-1',
    mainFilePath: 'src/MAIN.cob',
    mainFileLanguage: 'cobol',
    questionKey: 'purpose',
    questionText: 'What is the purpose?',
    questionLanguage: null,
    stale: false,
    providerId: 'stub',
    attempts: 1,
    lastError: null,
    failureKind: null,
    modelId: 'stub-v1',
    tokensUsed: 42,
    rawOutput: 'It handles payroll.',
    parsedJson: { summary: 'payroll' },
    answeredAt: '2026-01-01T00:00:00.000Z',
    jobCreatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

async function* recordGen(records: ExportRecord[]) {
  for (const r of records) yield r;
}

let tmpDir: string;

beforeEach(async () => {
  vi.resetAllMocks();
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'export-svc-'));
  mockExportCreate.mockImplementation(
    ({ data }: any) => Promise.resolve({ ...data, id: 'exp-1' }) as any,
  );
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('runExport', () => {
  it('throws when project is not found', async () => {
    mockProjectFind.mockResolvedValue(null);
    await expect(runExport({ projectId: 'missing', format: 'json', outputDir: tmpDir }))
      .rejects.toThrow('Project not found: missing');
  });

  it('throws when runId does not exist', async () => {
    mockProjectFind.mockResolvedValue(project as any);
    mockRunFind.mockResolvedValue(null);
    await expect(
      runExport({ projectId: 'p1', format: 'json', runId: 'missing-run', outputDir: tmpDir }),
    ).rejects.toThrow('Run not found');
  });

  it('throws when runId belongs to a different project', async () => {
    mockProjectFind.mockResolvedValue(project as any);
    mockRunFind.mockResolvedValue({ id: 'run-1', projectId: 'other-project' } as any);
    await expect(
      runExport({ projectId: 'p1', format: 'json', runId: 'run-1', outputDir: tmpDir }),
    ).rejects.toThrow('Run not found');
  });

  it('creates a JSON file containing a valid array', async () => {
    mockProjectFind.mockResolvedValue(project as any);
    mockStreamRecords.mockReturnValue(recordGen([makeRecord()]) as any);

    const result = await runExport({ projectId: 'p1', format: 'json', outputDir: tmpDir });

    const content = await fs.readFile(result.filePath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].jobId).toBe('job-1');
  });

  it('creates a CSV file with a header row', async () => {
    mockProjectFind.mockResolvedValue(project as any);
    mockStreamRecords.mockReturnValue(recordGen([makeRecord()]) as any);

    const result = await runExport({ projectId: 'p1', format: 'csv', outputDir: tmpDir });

    const content = await fs.readFile(result.filePath, 'utf-8');
    const firstLine = content.split('\n')[0]!;
    expect(firstLine).toContain('jobId');
    expect(firstLine).toContain('rawOutput');
  });

  it('creates a Markdown file with a project heading', async () => {
    mockProjectFind.mockResolvedValue(project as any);
    mockStreamRecords.mockReturnValue(recordGen([makeRecord()]) as any);

    const result = await runExport({ projectId: 'p1', format: 'markdown', outputDir: tmpDir });

    const content = await fs.readFile(result.filePath, 'utf-8');
    expect(content).toContain('# Analysis Results');
    expect(content).toContain('Demo');
  });

  it('places the output file under outputDir/projectId/', async () => {
    mockProjectFind.mockResolvedValue(project as any);
    mockStreamRecords.mockReturnValue(recordGen([]) as any);

    const result = await runExport({ projectId: 'p1', format: 'json', outputDir: tmpDir });

    expect(result.filePath).toContain(path.join(tmpDir, 'p1'));
    expect(result.filePath).toMatch(/\.json$/);
  });

  it('persists an Export record with correct projectId, format, filePath, and sizeBytes', async () => {
    mockProjectFind.mockResolvedValue(project as any);
    mockStreamRecords.mockReturnValue(recordGen([makeRecord()]) as any);

    await runExport({ projectId: 'p1', format: 'csv', outputDir: tmpDir });

    expect(mockExportCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'p1',
          format: 'csv',
          filePath: expect.stringContaining('.csv'),
          sizeBytes: expect.any(Number),
        }),
      }),
    );
    const { data } = mockExportCreate.mock.calls[0]![0] as { data: { sizeBytes: number } };
    expect(data.sizeBytes).toBeGreaterThan(0);
  });

  it('scopes the export to the run when runId is provided', async () => {
    mockProjectFind.mockResolvedValue(project as any);
    mockRunFind.mockResolvedValue(run as any);
    mockStreamRecords.mockReturnValue(recordGen([makeRecord()]) as any);

    await runExport({ projectId: 'p1', format: 'json', runId: 'run-1', outputDir: tmpDir });

    expect(mockStreamRecords).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'p1', runId: 'run-1' }),
    );
    const { data } = mockExportCreate.mock.calls[0]![0] as unknown as {
      data: { metadata: { runId: string | null } };
    };
    expect(data.metadata.runId).toBe('run-1');
  });

  it('rethrows the error and does not persist the export record when the stream fails', async () => {
    mockProjectFind.mockResolvedValue(project as any);
    async function* boom() {
      yield makeRecord();
      throw new Error('stream error');
    }
    mockStreamRecords.mockReturnValue(boom() as any);

    await expect(
      runExport({ projectId: 'p1', format: 'json', outputDir: tmpDir }),
    ).rejects.toThrow('stream error');

    expect(mockExportCreate).not.toHaveBeenCalled();
  });
});
