import { execFile } from 'child_process';
import { promisify } from 'util';
import type { ProviderHealth } from '../common/AnalysisProvider';

const execFileAsync = promisify(execFile);

export type OpenCodeProviderHealthConfig = {
  enabled: boolean;
  command: string;
  model?: string;
  agent: string;
  timeoutMs: number;
  maxBufferMb: number;
  maxInlineBytes: number;
};

export type OpenCodeCommandCheck = (command: string) => Promise<{ version?: string }>;

export async function checkOpenCodeProviderHealth(
  config: OpenCodeProviderHealthConfig,
  commandCheck: OpenCodeCommandCheck = defaultOpenCodeCommandCheck,
): Promise<ProviderHealth> {
  const base = {
    providerId: 'opencode',
    name: 'OpenCode CLI',
    type: 'shell' as const,
    enabled: config.enabled,
    retryable: false,
    details: safeDetails(config),
  };

  const configError = validateOpenCodeProviderConfig(config);
  if (configError) {
    return {
      ...base,
      configured: false,
      available: false,
      reason: configError,
    };
  }

  if (!config.enabled) {
    return {
      ...base,
      configured: Boolean(config.command.trim() && config.agent.trim()),
      available: false,
      reason: 'OpenCode provider disabled',
    };
  }

  try {
    const check = await commandCheck(config.command);
    return {
      ...base,
      configured: true,
      available: true,
      details: {
        ...safeDetails(config),
        version: check.version,
      },
    };
  } catch (error) {
    return {
      ...base,
      configured: true,
      available: false,
      reason: `OPENCODE_COMMAND unavailable: ${errorMessage(error)}`,
    };
  }
}

export function validateOpenCodeProviderConfig(
  config: OpenCodeProviderHealthConfig,
): string | undefined {
  if (!config.command.trim()) return 'OPENCODE_COMMAND is empty';
  if (!config.agent.trim()) return 'OPENCODE_AGENT is empty';
  if (!Number.isInteger(config.timeoutMs) || config.timeoutMs <= 0) {
    return 'OPENCODE_TIMEOUT_MS must be a positive integer';
  }
  if (!Number.isInteger(config.maxBufferMb) || config.maxBufferMb <= 0) {
    return 'OPENCODE_MAX_BUFFER_MB must be a positive integer';
  }
  if (!Number.isInteger(config.maxInlineBytes) || config.maxInlineBytes <= 0) {
    return 'OPENCODE_MAX_INLINE_BYTES must be a positive integer';
  }
  return undefined;
}

async function defaultOpenCodeCommandCheck(command: string): Promise<{ version?: string }> {
  const { stdout, stderr } = await execFileAsync(command, ['--version'], {
    timeout: 5000,
    windowsHide: true,
  });
  const version = `${stdout}${stderr}`.trim() || undefined;
  return { version };
}

function safeDetails(config: OpenCodeProviderHealthConfig): Record<string, unknown> {
  return {
    command: config.command,
    agent: config.agent,
    model: config.model,
    timeoutMs: config.timeoutMs,
    maxBufferMb: config.maxBufferMb,
    maxInlineBytes: config.maxInlineBytes,
    hasModel: Boolean(config.model?.trim()),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
