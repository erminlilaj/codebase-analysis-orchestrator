import { describe, it, expect } from 'vitest';
import { PassThrough } from 'stream';
import { writeCsv, CSV_HEADERS } from './csvExporter';
import type { ExportRecord } from './recordIterator';

function makeRecord(over: Partial<ExportRecord> = {}): ExportRecord {
  return {
    projectId: 'p1',
    projectName: 'Demo',
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
    rawOutput: 'simple answer',
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

  await writeCsv(stream, gen());
  stream.end();

  await new Promise<void>((resolve) => stream.on('end', resolve));
  return Buffer.concat(chunks).toString('utf-8');
}

describe('writeCsv', () => {
  it('emits a header row even when there are no records', async () => {
    const out = await collect([]);
    expect(out).toBe(CSV_HEADERS.join(',') + '\n');
  });

  it('emits header + one row per record', async () => {
    const out = await collect([makeRecord({ jobId: 'a' }), makeRecord({ jobId: 'b' })]);
    const lines = out.trimEnd().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(CSV_HEADERS.join(','));
  });

  it('escapes fields containing commas, quotes, and newlines', async () => {
    const out = await collect([
      makeRecord({
        rawOutput: 'line1\nline2,with comma',
        questionText: 'Contains "quotes" and, commas',
      }),
    ]);
    expect(out).toContain('"line1\nline2,with comma"');
    expect(out).toContain('"Contains ""quotes"" and, commas"');
  });

  it('serializes parsedJson as JSON string in CSV', async () => {
    const out = await collect([makeRecord({ parsedJson: { k: 'v', n: 1 } })]);
    expect(out).toContain('"{""k"":""v"",""n"":1}"');
  });

  it('renders null and undefined fields as empty strings', async () => {
    const out = await collect([
      makeRecord({
        lastError: null,
        modelId: null,
        tokensUsed: null,
        rawOutput: null,
        answeredAt: null,
      }),
    ]);
    const dataLine = out.trimEnd().split('\n')[1]!;
    const cells = dataLine.split(',');
    const errorIdx = CSV_HEADERS.indexOf('lastError');
    expect(cells[errorIdx]).toBe('');
  });

  it('writes columns in the declared CSV_HEADERS order', async () => {
    const out = await collect([makeRecord({ jobId: 'fixed-id', providerId: 'fixed-provider' })]);
    const headerLine = out.split('\n')[0]!.split(',');
    expect(headerLine).toEqual([...CSV_HEADERS]);
  });
});
