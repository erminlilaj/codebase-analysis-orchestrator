import { describe, it, expect } from 'vitest';
import { envSchema } from './envSchema';

describe('envSchema', () => {
  it('rejects missing DATABASE_URL', () => {
    const result = envSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts minimal valid input and applies defaults', () => {
    const result = envSchema.safeParse({ DATABASE_URL: 'postgresql://localhost/test' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.PORT).toBe(3000);
    expect(result.data.BOB_COMMAND).toBe('bob');
    expect(result.data.JOB_MAX_ATTEMPTS).toBe(3);
    expect(result.data.WORKER_CONCURRENCY).toBe(4);
    expect(result.data.WORKER_POLL_INTERVAL_MS).toBe(2000);
    expect(result.data.JOB_STALE_TIMEOUT_SECONDS).toBe(300);
  });

  it('coerces string numbers from process.env', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgresql://localhost/test',
      PORT: '8080',
      JOB_MAX_ATTEMPTS: '5',
      WORKER_CONCURRENCY: '8',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.PORT).toBe(8080);
    expect(result.data.JOB_MAX_ATTEMPTS).toBe(5);
    expect(result.data.WORKER_CONCURRENCY).toBe(8);
  });

  it('rejects non-positive numbers', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgresql://localhost/test',
      PORT: '0',
    });
    expect(result.success).toBe(false);
  });

  it('treats BOBSHELL_API_KEY as optional', () => {
    const result = envSchema.safeParse({ DATABASE_URL: 'postgresql://localhost/test' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.BOBSHELL_API_KEY).toBeUndefined();
  });
});
