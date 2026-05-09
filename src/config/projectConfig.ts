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
  },
} as const;
