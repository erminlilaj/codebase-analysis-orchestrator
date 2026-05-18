import type { Writable } from 'stream';
import type { ExportRecord } from './recordIterator';
import { writeAsync } from './streamWriter';

export async function writeJson(
  out: Writable,
  records: AsyncIterable<ExportRecord>,
): Promise<void> {
  await writeAsync(out, '[');
  let first = true;
  for await (const r of records) {
    await writeAsync(out, first ? '\n' : ',\n');
    await writeAsync(out, JSON.stringify(r));
    first = false;
  }
  await writeAsync(out, first ? ']\n' : '\n]\n');
}
