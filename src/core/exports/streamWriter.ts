import type { Writable } from 'stream';

// Respects Writable backpressure: waits for `drain` when the buffer is full.
export function writeAsync(out: Writable, chunk: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => {
      out.off('drain', onDrain);
      reject(err);
    };
    const onDrain = () => {
      out.off('error', onError);
      resolve();
    };
    out.once('error', onError);

    if (out.write(chunk)) {
      out.off('error', onError);
      resolve();
    } else {
      out.once('drain', onDrain);
    }
  });
}

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
