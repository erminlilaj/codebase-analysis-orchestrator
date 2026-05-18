import { describe, it, expect } from 'vitest';
import { PassThrough } from 'stream';
import { writeJson } from './jsonExporter';
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

  await writeJson(stream, gen());
  stream.end();

  await new Promise<void>((resolve) => stream.on('end', resolve));
  return Buffer.concat(chunks).toString('utf-8');
}

describe('writeJson', () => {
  it('emits a valid empty JSON array when there are no records', async () => {
    const out = await collect([]);
    expect(out.trim()).toBe('[]');
    expect(JSON.parse(out)).toEqual([]);
  });

  it('emits a single record as a one-element array', async () => {
    const r = makeRecord();
    const out = await collect([r]);
    const parsed = JSON.parse(out);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual(r);
  });

  it('emits multiple records as a valid JSON array', async () => {
    const rs = [
      makeRecord({ jobId: 'a' }),
      makeRecord({ jobId: 'b' }),
      makeRecord({ jobId: 'c' }),
    ];
    const out = await collect(rs);
    const parsed = JSON.parse(out);
    expect(parsed.map((p: ExportRecord) => p.jobId)).toEqual(['a', 'b', 'c']);
  });

  it('preserves nullable traceability fields', async () => {
    const r = makeRecord({
      lastError: null,
      modelId: null,
      tokensUsed: null,
      rawOutput: null,
      answeredAt: null,
    });
    const out = await collect([r]);
    const parsed = JSON.parse(out);
    expect(parsed[0].lastError).toBeNull();
    expect(parsed[0].modelId).toBeNull();
    expect(parsed[0].rawOutput).toBeNull();
  });
});
