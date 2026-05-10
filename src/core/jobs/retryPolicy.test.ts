import { describe, it, expect } from 'vitest';
import { isTransientError, shouldRetry } from './retryPolicy';

describe('isTransientError', () => {
  it('returns true for ECONNREFUSED', () => {
    expect(isTransientError(new Error('connect ECONNREFUSED 127.0.0.1:5432'))).toBe(true);
  });

  it('returns true for ETIMEDOUT', () => {
    expect(isTransientError(new Error('connect ETIMEDOUT'))).toBe(true);
  });

  it('returns true for ENOTFOUND', () => {
    expect(isTransientError(new Error('getaddrinfo ENOTFOUND db.example.com'))).toBe(true);
  });

  it('returns true for timeout (case-insensitive)', () => {
    expect(isTransientError(new Error('Request timed out after 30s'))).toBe(true);
  });

  it('returns true for socket hang up', () => {
    expect(isTransientError(new Error('socket hang up'))).toBe(true);
  });

  it('returns true for ECONNRESET', () => {
    expect(isTransientError(new Error('read ECONNRESET'))).toBe(true);
  });

  it('returns false for validation errors', () => {
    expect(isTransientError(new Error('Invalid configuration: BOBSHELL_API_KEY missing'))).toBe(false);
  });

  it('returns false for permission errors', () => {
    expect(isTransientError(new Error('EACCES: permission denied'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isTransientError('string')).toBe(false);
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
    expect(isTransientError(42)).toBe(false);
  });
});

describe('shouldRetry', () => {
  const transient = new Error('ECONNREFUSED');
  const deterministic = new Error('Invalid API key');

  it('returns true when attempts < maxAttempts and error is transient', () => {
    expect(shouldRetry(0, 3, transient)).toBe(true);
    expect(shouldRetry(2, 3, transient)).toBe(true);
  });

  it('returns false when attempts equals maxAttempts', () => {
    expect(shouldRetry(3, 3, transient)).toBe(false);
  });

  it('returns false when attempts exceed maxAttempts', () => {
    expect(shouldRetry(5, 3, transient)).toBe(false);
  });

  it('returns false when error is deterministic even if attempts remain', () => {
    expect(shouldRetry(0, 3, deterministic)).toBe(false);
  });

  it('returns false when error is deterministic and attempts are exhausted', () => {
    expect(shouldRetry(3, 3, deterministic)).toBe(false);
  });
});
