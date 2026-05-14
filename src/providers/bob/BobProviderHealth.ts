import { execFile } from 'child_process';
import { promisify } from 'util';
import type { ProviderHealth } from '../common/AnalysisProvider';

const execFileAsync = promisify(execFile);

export type BobProviderHealthConfig = {
  enabled: boolean;
  command: string;
  apiKey?: string;
  timeoutMs: number;
  maxBufferMb: number;
  maxInlineBytes: number;
};

export type BobCommandCheck = (command: string) => Promise<{ version?: string }>;

export async function checkBobProviderHealth(
  config: BobProviderHealthConfig,
  commandCheck: BobCommandCheck = defaultBobCommandCheck,
): Promise<ProviderHealth> {
  const base = {
    providerId: 'bob',
    name: 'IBM Bob Shell',
    type: 'shell' as const,
    enabled: config.enabled,
    retryable: false,
    details: safeDetails(config),
  };

  const configError = validateBobProviderConfig(config);
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
      configured: Boolean(config.apiKey && config.command.trim()),
      available: false,
      reason: 'Bob provider disabled',
    };
  }

  if (!config.apiKey) {
    return {
      ...base,
      configured: false,
      available: false,
      reason: 'BOBSHELL_API_KEY not set',
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
      reason: `BOB_COMMAND unavailable: ${errorMessage(error)}`,
    };
  }
}

export function validateBobProviderConfig(config: BobProviderHealthConfig): string | undefined {
  if (!config.command.trim()) return 'BOB_COMMAND is empty';
  if (!Number.isInteger(config.timeoutMs) || config.timeoutMs <= 0) {
    return 'BOB_TIMEOUT_MS must be a positive integer';
  }
  if (!Number.isInteger(config.maxBufferMb) || config.maxBufferMb <= 0) {
    return 'BOB_MAX_BUFFER_MB must be a positive integer';
  }
  if (!Number.isInteger(config.maxInlineBytes) || config.maxInlineBytes <= 0) {
    return 'BOB_MAX_INLINE_BYTES must be a positive integer';
  }
  return undefined;
}

async function defaultBobCommandCheck(command: string): Promise<{ version?: string }> {
  const { stdout, stderr } = await execFileAsync(command, ['--version'], {
    timeout: 5000,
    windowsHide: true,
  });
  const version = `${stdout}${stderr}`.trim() || undefined;
  return { version };
}

function safeDetails(config: BobProviderHealthConfig): Record<string, unknown> {
  return {
    command: config.command,
    timeoutMs: config.timeoutMs,
    maxBufferMb: config.maxBufferMb,
    maxInlineBytes: config.maxInlineBytes,
    hasApiKey: Boolean(config.apiKey),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
