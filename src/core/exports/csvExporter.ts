import type { Writable } from 'stream';
import type { ExportRecord } from './recordIterator';
import { writeAsync, csvEscape } from './streamWriter';

export const CSV_HEADERS: ReadonlyArray<keyof ExportRecord> = [
  'projectId',
  'projectName',
  'runId',
  'runStatus',
  'jobId',
  'jobStatus',
  'bundleId',
  'mainFilePath',
  'mainFileLanguage',
  'questionKey',
  'questionText',
  'questionLanguage',
  'stale',
  'providerId',
  'attempts',
  'lastError',
  'failureKind',
  'modelId',
  'tokensUsed',
  'rawOutput',
  'parsedJson',
  'answeredAt',
  'jobCreatedAt',
];

export async function writeCsv(
  out: Writable,
  records: AsyncIterable<ExportRecord>,
): Promise<void> {
  await writeAsync(out, CSV_HEADERS.join(',') + '\n');
  for await (const r of records) {
    const row = CSV_HEADERS.map((h) => csvEscape(r[h])).join(',');
    await writeAsync(out, row + '\n');
  }
}
