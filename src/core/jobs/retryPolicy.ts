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

export function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return TRANSIENT_PATTERNS.some((p) => msg.includes(p));
}

/**
 * Returns true if the job should be retried given the current attempt count,
 * configured maximum, and the error that caused the failure.
 *
 * Only transient errors (network, timeout, etc.) are retried. Deterministic
 * errors (validation, missing config) are not.
 */
export function shouldRetry(
  attempts: number,
  maxAttempts: number,
  error: unknown,
): boolean {
  return attempts < maxAttempts && isTransientError(error);
}
