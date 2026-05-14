import path from 'path';
import { env } from './env';

export const projectConfig = {
  workspaceRoot: path.resolve(env.WORKSPACE_ROOT),
  exportRoot: path.resolve(env.EXPORT_ROOT),
  worker: {
    pollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
    concurrency: env.WORKER_CONCURRENCY,
    maxAttempts: env.JOB_MAX_ATTEMPTS,
    staleTimeoutSeconds: env.JOB_STALE_TIMEOUT_SECONDS,
  },
  bob: {
    command: env.BOB_COMMAND,
    apiKey: env.BOBSHELL_API_KEY,
    enabled: env.BOB_PROVIDER_ENABLED,
    timeoutMs: env.BOB_TIMEOUT_MS,
    maxBufferMb: env.BOB_MAX_BUFFER_MB,
    maxInlineBytes: env.BOB_MAX_INLINE_BYTES,
  },
} as const;
