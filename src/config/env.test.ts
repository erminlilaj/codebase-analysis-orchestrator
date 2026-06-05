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
    expect(result.data.BOB_PROVIDER_ENABLED).toBe(false);
    expect(result.data.BOB_TIMEOUT_MS).toBe(180000);
    expect(result.data.BOB_MAX_BUFFER_MB).toBe(20);
    expect(result.data.BOB_MAX_INLINE_BYTES).toBe(51200);
    expect(result.data.OPENCODE_PROVIDER_ENABLED).toBe(true);
    expect(result.data.OPENCODE_COMMAND).toBe('opencode');
    expect(result.data.OPENCODE_AGENT).toBe('plan');
    expect(result.data.OPENCODE_TIMEOUT_MS).toBe(180000);
    expect(result.data.OPENCODE_MAX_BUFFER_MB).toBe(20);
    expect(result.data.OPENCODE_MAX_INLINE_BYTES).toBe(51200);
    expect(result.data.OLLAMA_PROVIDER_ENABLED).toBe(true);
    expect(result.data.OLLAMA_BASE_URL).toBe('http://127.0.0.1:11434');
    expect(result.data.OLLAMA_TIMEOUT_MS).toBe(180000);
    expect(result.data.OLLAMA_MAX_INLINE_BYTES).toBe(200000);
    expect(result.data.JOB_MAX_ATTEMPTS).toBe(3);
    expect(result.data.WORKER_CONCURRENCY).toBe(4);
    expect(result.data.WORKER_POLL_INTERVAL_MS).toBe(2000);
    expect(result.data.JOB_STALE_TIMEOUT_SECONDS).toBe(300);
  });

  it('coerces string numbers from process.env', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgresql://localhost/test',
      PORT: '8080',
      BOB_PROVIDER_ENABLED: 'true',
      BOB_TIMEOUT_MS: '90000',
      BOB_MAX_BUFFER_MB: '10',
      BOB_MAX_INLINE_BYTES: '2048',
      OPENCODE_PROVIDER_ENABLED: 'true',
      OPENCODE_TIMEOUT_MS: '120000',
      OPENCODE_MAX_BUFFER_MB: '30',
      OPENCODE_MAX_INLINE_BYTES: '4096',
      OLLAMA_PROVIDER_ENABLED: 'true',
      OLLAMA_TIMEOUT_MS: '150000',
      OLLAMA_MAX_INLINE_BYTES: '8192',
      JOB_MAX_ATTEMPTS: '5',
      WORKER_CONCURRENCY: '8',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.PORT).toBe(8080);
    expect(result.data.BOB_PROVIDER_ENABLED).toBe(true);
    expect(result.data.BOB_TIMEOUT_MS).toBe(90000);
    expect(result.data.BOB_MAX_BUFFER_MB).toBe(10);
    expect(result.data.BOB_MAX_INLINE_BYTES).toBe(2048);
    expect(result.data.OPENCODE_PROVIDER_ENABLED).toBe(true);
    expect(result.data.OPENCODE_TIMEOUT_MS).toBe(120000);
    expect(result.data.OPENCODE_MAX_BUFFER_MB).toBe(30);
    expect(result.data.OPENCODE_MAX_INLINE_BYTES).toBe(4096);
    expect(result.data.OLLAMA_PROVIDER_ENABLED).toBe(true);
    expect(result.data.OLLAMA_TIMEOUT_MS).toBe(150000);
    expect(result.data.OLLAMA_MAX_INLINE_BYTES).toBe(8192);
    expect(result.data.JOB_MAX_ATTEMPTS).toBe(5);
    expect(result.data.WORKER_CONCURRENCY).toBe(8);
  });

  it('coerces common false boolean strings', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgresql://localhost/test',
      BOB_PROVIDER_ENABLED: 'false',
      OPENCODE_PROVIDER_ENABLED: 'off',
      OLLAMA_PROVIDER_ENABLED: 'no',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.BOB_PROVIDER_ENABLED).toBe(false);
    expect(result.data.OPENCODE_PROVIDER_ENABLED).toBe(false);
    expect(result.data.OLLAMA_PROVIDER_ENABLED).toBe(false);
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
    expect(result.data.OPENCODE_MODEL).toBeUndefined();
    expect(result.data.OLLAMA_MODEL).toBeUndefined();
  });
});
