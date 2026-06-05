import type { ProviderHealth } from '../common/AnalysisProvider';

export type OllamaProviderHealthConfig = {
  enabled: boolean;
  baseUrl: string;
  model?: string;
  timeoutMs: number;
  maxInlineBytes: number;
};

export type OllamaHealthCheck = (
  baseUrl: string,
  timeoutMs: number,
) => Promise<{ version?: string; models?: string[] }>;

export async function checkOllamaProviderHealth(
  config: OllamaProviderHealthConfig,
  healthCheck: OllamaHealthCheck = defaultOllamaHealthCheck,
): Promise<ProviderHealth> {
  const base = {
    providerId: 'ollama',
    name: 'Ollama HTTP',
    type: 'http' as const,
    enabled: config.enabled,
    retryable: true,
    details: safeDetails(config),
  };

  const configError = validateOllamaProviderConfig(config);
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
      configured: true,
      available: false,
      reason: 'Ollama provider disabled',
    };
  }

  try {
    const check = await healthCheck(config.baseUrl, Math.min(config.timeoutMs, 5000));
    return {
      ...base,
      configured: true,
      available: true,
      details: {
        ...safeDetails(config),
        version: check.version,
        models: check.models,
      },
    };
  } catch (error) {
    return {
      ...base,
      configured: true,
      available: false,
      reason: `OLLAMA_BASE_URL unavailable: ${errorMessage(error)}`,
    };
  }
}

export function validateOllamaProviderConfig(
  config: OllamaProviderHealthConfig,
): string | undefined {
  if (!config.baseUrl.trim()) return 'OLLAMA_BASE_URL is empty';
  try {
    new URL(config.baseUrl);
  } catch {
    return 'OLLAMA_BASE_URL must be a valid URL';
  }
  if (!Number.isInteger(config.timeoutMs) || config.timeoutMs <= 0) {
    return 'OLLAMA_TIMEOUT_MS must be a positive integer';
  }
  if (!Number.isInteger(config.maxInlineBytes) || config.maxInlineBytes <= 0) {
    return 'OLLAMA_MAX_INLINE_BYTES must be a positive integer';
  }
  return undefined;
}

async function defaultOllamaHealthCheck(
  baseUrl: string,
  timeoutMs: number,
): Promise<{ version?: string; models?: string[] }> {
  const versionUrl = ollamaApiUrl(baseUrl, '/api/version');
  const tagsUrl = ollamaApiUrl(baseUrl, '/api/tags');
  const [versionResponse, tagsResponse] = await Promise.all([
    fetchJson(versionUrl, timeoutMs),
    fetchJson(tagsUrl, timeoutMs),
  ]);

  return {
    version: stringFrom(recordFrom(versionResponse)?.version),
    models: parseModelNames(tagsResponse),
  };
}

function parseModelNames(value: unknown): string[] | undefined {
  const models = recordFrom(value)?.models;
  if (!Array.isArray(models)) return undefined;
  return models
    .map((model) => {
      const record = recordFrom(model);
      return stringFrom(record?.name) ?? stringFrom(record?.model);
    })
    .filter((name): name is string => Boolean(name));
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
    }
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timeout);
  }
}

function safeDetails(config: OllamaProviderHealthConfig): Record<string, unknown> {
  return {
    baseUrl: config.baseUrl,
    model: config.model,
    hasModel: Boolean(config.model?.trim()),
    timeoutMs: config.timeoutMs,
    maxInlineBytes: config.maxInlineBytes,
  };
}

export function ollamaApiUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  return `${normalizedBase}${path.startsWith('/') ? path : `/${path}`}`;
}

function recordFrom(value: unknown): Record<string, unknown> | undefined {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringFrom(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
