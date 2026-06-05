import path from 'path';
import fs from 'fs';
import os from 'os';
import { env } from './env';

function defaultOpenCodeCommand(command: string): string {
  if (command !== 'opencode') return command;
  const userInstallPath = path.join(os.homedir(), '.opencode', 'bin', 'opencode');
  return fs.existsSync(userInstallPath) ? userInstallPath : command;
}

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
  opencode: {
    command: defaultOpenCodeCommand(env.OPENCODE_COMMAND),
    model: env.OPENCODE_MODEL,
    agent: env.OPENCODE_AGENT,
    enabled: env.OPENCODE_PROVIDER_ENABLED,
    timeoutMs: env.OPENCODE_TIMEOUT_MS,
    maxBufferMb: env.OPENCODE_MAX_BUFFER_MB,
    maxInlineBytes: env.OPENCODE_MAX_INLINE_BYTES,
  },
  ollama: {
    baseUrl: env.OLLAMA_BASE_URL,
    model: env.OLLAMA_MODEL,
    enabled: env.OLLAMA_PROVIDER_ENABLED,
    timeoutMs: env.OLLAMA_TIMEOUT_MS,
    maxInlineBytes: env.OLLAMA_MAX_INLINE_BYTES,
  },
} as const;
