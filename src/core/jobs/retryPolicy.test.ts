import { describe, it, expect } from 'vitest';
import { classifyError, isTransientError, shouldRetry } from './retryPolicy';

describe('classifyError', () => {
  it('returns transient for ECONNREFUSED', () => {
    expect(classifyError(new Error('connect ECONNREFUSED 127.0.0.1:5432'))).toBe('transient');
  });

  it('returns transient for ETIMEDOUT', () => {
    expect(classifyError(new Error('connect ETIMEDOUT'))).toBe('transient');
  });

  it('returns transient for socket hang up', () => {
    expect(classifyError(new Error('socket hang up'))).toBe('transient');
  });

  it('returns parse_error for parse error messages', () => {
    expect(classifyError(new Error('No valid JSON object or array found in Bob Shell output'))).toBe('parse_error');
    expect(classifyError(new Error('Unexpected token in JSON'))).toBe('parse_error');
    expect(classifyError(new Error('failed to parse response'))).toBe('parse_error');
    expect(classifyError(new Error('malformed output from provider'))).toBe('parse_error');
  });

  it('returns non_retryable for config/validation errors', () => {
    expect(classifyError(new Error('Invalid configuration: BOBSHELL_API_KEY missing'))).toBe('non_retryable');
    expect(classifyError(new Error('EACCES: permission denied'))).toBe('non_retryable');
    expect(classifyError(new Error('invalid API key'))).toBe('non_retryable');
    expect(classifyError(new Error('Provider disabled'))).toBe('non_retryable');
  });

  it('returns non_retryable for non-Error values', () => {
    expect(classifyError('string')).toBe('non_retryable');
    expect(classifyError(null)).toBe('non_retryable');
    expect(classifyError(undefined)).toBe('non_retryable');
    expect(classifyError(42)).toBe('non_retryable');
  });
});

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
  it('returns true for transient when attempts < maxAttempts', () => {
    expect(shouldRetry(0, 3, 'transient')).toBe(true);
    expect(shouldRetry(2, 3, 'transient')).toBe(true);
  });

  it('returns false for transient when attempts equals maxAttempts', () => {
    expect(shouldRetry(3, 3, 'transient')).toBe(false);
  });

  it('returns false for transient when attempts exceed maxAttempts', () => {
    expect(shouldRetry(5, 3, 'transient')).toBe(false);
  });

  it('returns false for non_retryable regardless of attempts', () => {
    expect(shouldRetry(0, 3, 'non_retryable')).toBe(false);
    expect(shouldRetry(3, 3, 'non_retryable')).toBe(false);
  });

  it('returns true for parse_error when attempts < 2', () => {
    expect(shouldRetry(0, 3, 'parse_error')).toBe(true);
    expect(shouldRetry(1, 3, 'parse_error')).toBe(true);
  });

  it('returns false for parse_error when attempts reaches 2 (lower cap than maxAttempts)', () => {
    expect(shouldRetry(2, 3, 'parse_error')).toBe(false);
    expect(shouldRetry(3, 3, 'parse_error')).toBe(false);
  });
});
