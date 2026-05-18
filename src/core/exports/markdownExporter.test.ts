import { describe, it, expect } from 'vitest';
import { PassThrough } from 'stream';
import { writeMarkdown } from './markdownExporter';
import type { ExportRecord } from './recordIterator';

const project = {
  id: 'p1',
  name: 'Demo Project',
  repoPath: '/repos/demo',
  language: 'cobol',
};

function makeRecord(over: Partial<ExportRecord> = {}): ExportRecord {
  return {
    projectId: 'p1',
    projectName: 'Demo Project',
    runId: 'r1',
    runStatus: 'completed',
    jobId: 'j1',
    jobStatus: 'completed',
    bundleId: 'b1',
    mainFilePath: 'src/main.cob',
    mainFileLanguage: 'cobol',
    questionKey: 'purpose',
    questionText: 'What is the purpose?',
    questionLanguage: null,
    stale: false,
    providerId: 'bob',
    attempts: 1,
    lastError: null,
    failureKind: null,
    modelId: 'bob-v1',
    tokensUsed: 100,
    rawOutput: 'It does X.',
    parsedJson: { summary: 'X' },
    answeredAt: '2026-01-01T00:00:00.000Z',
    jobCreatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

async function collect(records: ExportRecord[]): Promise<string> {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (c) => chunks.push(Buffer.from(c)));

  async function* gen() {
    for (const r of records) yield r;
  }

  await writeMarkdown(stream, gen(), project);
  stream.end();

  await new Promise<void>((resolve) => stream.on('end', resolve));
  return Buffer.concat(chunks).toString('utf-8');
}

describe('writeMarkdown', () => {
  it('writes a project header with id, repoPath and language', async () => {
    const out = await collect([]);
    expect(out).toContain('# Analysis Results — Demo Project');
    expect(out).toContain('`p1`');
    expect(out).toContain('`/repos/demo`');
    expect(out).toContain('cobol');
  });

  it('emits a "no records" notice when there are no records', async () => {
    const out = await collect([]);
    expect(out).toContain('_No analysis records found._');
  });

  it('emits a run heading the first time a runId appears', async () => {
    const out = await collect([
      makeRecord({ runId: 'r1', jobId: 'a' }),
      makeRecord({ runId: 'r1', jobId: 'b' }),
      makeRecord({ runId: 'r2', jobId: 'c' }),
    ]);
    expect(out.match(/## Run `r1` — completed/g)).toHaveLength(1);
    expect(out.match(/## Run `r2` — completed/g)).toHaveLength(1);
  });

  it('includes traceability fields per record', async () => {
    const out = await collect([
      makeRecord({
        jobId: 'job-x',
        jobStatus: 'failed',
        providerId: 'bob',
        lastError: 'timeout',
        attempts: 3,
      }),
    ]);
    expect(out).toContain('`job-x`');
    expect(out).toContain('failed');
    expect(out).toContain('bob');
    expect(out).toContain('timeout');
    expect(out).toContain('**Attempts:** 3');
  });

  it('shows failureKind when present', async () => {
    const out = await collect([
      makeRecord({ failureKind: 'parse_error', lastError: 'No valid JSON found' }),
    ]);
    expect(out).toContain('**Failure kind:** parse_error');
    expect(out).toContain('**Error:** No valid JSON found');
  });

  it('omits the failureKind line when null', async () => {
    const out = await collect([makeRecord({ failureKind: null })]);
    expect(out).not.toContain('Failure kind');
  });

  it('marks a record stale when the question was updated after the answer', async () => {
    const out = await collect([makeRecord({ stale: true })]);
    expect(out).toContain('**Stale:** question was updated after this answer was produced');
  });

  it('omits the stale notice when the record is current', async () => {
    const out = await collect([makeRecord({ stale: false })]);
    expect(out).not.toContain('**Stale:**');
  });

  it('wraps rawOutput in a fenced code block', async () => {
    const out = await collect([makeRecord({ rawOutput: 'multi\nline\nanswer' })]);
    expect(out).toMatch(/```\nmulti\nline\nanswer\n```/);
  });

  it('shows a placeholder when no answer exists', async () => {
    const out = await collect([makeRecord({ rawOutput: null })]);
    expect(out).toContain('_No answer available._');
  });
});
