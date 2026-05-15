export type FailureKind = 'transient' | 'parse_error' | 'non_retryable';

const TRANSIENT_PATTERNS = [
  'econnrefused',
  'etimedout',
  'enotfound',
  'timeout',
  'timed out',
  'socket hang up',
  'econnreset',
  'network',
];

const PARSE_ERROR_PATTERNS = [
  'parse error',
  'parse_error',
  'unexpected token',
  'invalid json',
  'no valid json',
  'failed to parse',
  'malformed output',
];

const PARSE_ERROR_MAX_ATTEMPTS = 2;

export function classifyError(error: unknown): FailureKind {
  if (!(error instanceof Error)) return 'non_retryable';
  const msg = error.message.toLowerCase();
  if (TRANSIENT_PATTERNS.some((p) => msg.includes(p))) return 'transient';
  if (PARSE_ERROR_PATTERNS.some((p) => msg.includes(p))) return 'parse_error';
  return 'non_retryable';
}

export function isTransientError(error: unknown): boolean {
  return classifyError(error) === 'transient';
}

/**
 * Returns true if the job should be retried.
 *
 * - transient: retry up to maxAttempts
 * - parse_error: retry up to PARSE_ERROR_MAX_ATTEMPTS (2), independent of maxAttempts
 * - non_retryable: never retry
 */
export function shouldRetry(
  attempts: number,
  maxAttempts: number,
  failureKind: FailureKind,
): boolean {
  if (failureKind === 'non_retryable') return false;
  if (failureKind === 'parse_error') return attempts < PARSE_ERROR_MAX_ATTEMPTS;
  return attempts < maxAttempts;
}
