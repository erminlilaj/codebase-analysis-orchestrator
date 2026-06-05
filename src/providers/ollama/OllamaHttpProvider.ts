import type {
  AnalysisProvider,
  ProviderAnalysisInput,
  ProviderAnalysisResult,
  ProviderHealth,
} from '../common/AnalysisProvider';
import { buildOpenCodePrompt, type OpenCodePromptBuildResult } from '../opencode/OpenCodePromptBuilder';
import {
  checkOllamaProviderHealth,
  ollamaApiUrl,
  type OllamaHealthCheck,
  type OllamaProviderHealthConfig,
} from './OllamaProviderHealth';

export type OllamaHttpProviderConfig = OllamaProviderHealthConfig & {
  format?: 'json';
  options?: Record<string, unknown>;
};

export type OllamaChatRequest = {
  url: string;
  body: {
    model: string;
    messages: Array<{ role: 'system' | 'user'; content: string }>;
    stream: false;
    format: 'json';
    options?: Record<string, unknown>;
  };
  timeoutMs: number;
};

export type OllamaChatExecutor = (request: OllamaChatRequest) => Promise<OllamaChatResponse>;

export type OllamaChatResponse = {
  model?: string;
  message?: {
    role?: string;
    content?: string;
  };
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
  error?: string;
};

export class OllamaProviderUnavailableError extends Error {
  constructor(readonly health: ProviderHealth) {
    super(`Ollama provider unavailable: ${health.reason ?? 'unknown reason'}`);
    this.name = 'OllamaProviderUnavailableError';
  }
}

export class OllamaHttpProvider implements AnalysisProvider {
  readonly id = 'ollama';
  readonly displayName = 'Ollama HTTP';

  constructor(
    private readonly config: OllamaHttpProviderConfig,
    private readonly executor: OllamaChatExecutor = defaultOllamaChatExecutor,
    private readonly healthCheck?: OllamaHealthCheck,
  ) {}

  async health(): Promise<ProviderHealth> {
    return checkOllamaProviderHealth(this.config, this.healthCheck);
  }

  async analyze(input: ProviderAnalysisInput): Promise<ProviderAnalysisResult> {
    const health = await this.health();
    if (!health.available) {
      throw new OllamaProviderUnavailableError(health);
    }

    const model = this.config.model?.trim();
    if (!model) {
      return failureResult('', 'OLLAMA_MODEL is empty and no per-run model was provided', {
        modelId: undefined,
      });
    }

    const prompt = await buildOpenCodePrompt({
      bundle: input.bundle,
      question: input.question,
      mode: 'inline-content',
      maxInlineBytes: this.config.maxInlineBytes,
      workspacePath: input.workspacePath,
    });

    const started = Date.now();
    let response: OllamaChatResponse;
    try {
      response = await this.executor({
        url: ollamaApiUrl(this.config.baseUrl, '/api/chat'),
        body: {
          model,
          messages: [
            {
              role: 'system',
              content: [
                'You are a batch code-analysis engine.',
                'Return only the requested JSON object. Do not include markdown or prose outside JSON.',
              ].join(' '),
            },
            { role: 'user', content: prompt.prompt },
          ],
          stream: false,
          format: this.config.format ?? 'json',
          ...(this.config.options ? { options: this.config.options } : {}),
        },
        timeoutMs: this.config.timeoutMs,
      });
    } catch (error) {
      return failureResult('', errorMessage(error), {
        modelId: model,
        durationMs: Date.now() - started,
        prompt,
      });
    }

    const rawOutput = response.message?.content ?? '';
    if (response.error) {
      return failureResult(rawOutput, response.error, {
        modelId: response.model ?? model,
        durationMs: Date.now() - started,
        response,
        prompt,
      });
    }

    const parsed = parseJsonAnswer(rawOutput);
    if (!parsed.ok) {
      return {
        rawOutput,
        parsedAnswer: {},
        metadata: {
          providerId: this.id,
          parseStatus: 'parse_error',
          parseSource: 'none',
          failureKind: 'parse_error',
          error: parsed.error,
          modelId: response.model ?? model,
          durationMs: Date.now() - started,
          inputTokens: response.prompt_eval_count,
          outputTokens: response.eval_count,
          tokensUsed: sumTokens(response.prompt_eval_count, response.eval_count),
          ...promptMetadata(prompt),
        },
      };
    }

    return {
      rawOutput,
      parsedAnswer: parsed.value,
      metadata: {
        providerId: this.id,
        parseStatus: 'parsed',
        parseSource: parsed.source,
        modelId: response.model ?? model,
        durationMs: Date.now() - started,
        inputTokens: response.prompt_eval_count,
        outputTokens: response.eval_count,
        tokensUsed: sumTokens(response.prompt_eval_count, response.eval_count),
        doneReason: response.done_reason,
        totalDurationNs: response.total_duration,
        ...promptMetadata(prompt),
      },
    };
  }
}

async function defaultOllamaChatExecutor(request: OllamaChatRequest): Promise<OllamaChatResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
  try {
    const response = await fetch(request.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request.body),
      signal: controller.signal,
    });
    const text = await response.text();
    const parsed = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const message = recordFrom(parsed)?.error;
      throw new Error(
        typeof message === 'string'
          ? message
          : `Ollama HTTP ${response.status}: ${text || response.statusText}`,
      );
    }
    return parsed as OllamaChatResponse;
  } finally {
    clearTimeout(timeout);
  }
}

function failureResult(
  rawOutput: string,
  error: string,
  details: {
    modelId?: string;
    durationMs?: number;
    response?: OllamaChatResponse;
    prompt?: OpenCodePromptBuildResult;
  },
): ProviderAnalysisResult {
  return {
    rawOutput,
    parsedAnswer: {},
    metadata: {
      providerId: 'ollama',
      parseStatus: 'parse_error',
      parseSource: 'none',
      failureKind: 'provider_error',
      error,
      modelId: details.modelId,
      durationMs: details.durationMs,
      inputTokens: details.response?.prompt_eval_count,
      outputTokens: details.response?.eval_count,
      tokensUsed: sumTokens(details.response?.prompt_eval_count, details.response?.eval_count),
      ...(details.prompt ? promptMetadata(details.prompt) : {}),
    },
  };
}

function parseJsonAnswer(
  text: string,
):
  | { ok: true; value: unknown; source: 'strict-json' | 'embedded-json' }
  | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'Ollama produced no assistant content' };

  try {
    return { ok: true, value: JSON.parse(trimmed), source: 'strict-json' };
  } catch {
    // Fall through to embedded JSON extraction.
  }

  const embedded = extractFirstJsonValue(trimmed);
  if (!embedded) return { ok: false, error: 'No valid JSON object or array found in Ollama output' };

  try {
    return { ok: true, value: JSON.parse(embedded), source: 'embedded-json' };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

function extractFirstJsonValue(text: string): string | undefined {
  const start = firstJsonStart(text);
  if (start < 0) return undefined;

  const opener = text[start];
  const closer = opener === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === opener) depth += 1;
    if (char === closer) depth -= 1;
    if (depth === 0) return text.slice(start, index + 1);
  }

  return undefined;
}

function firstJsonStart(text: string): number {
  const objectIndex = text.indexOf('{');
  const arrayIndex = text.indexOf('[');
  if (objectIndex < 0) return arrayIndex;
  if (arrayIndex < 0) return objectIndex;
  return Math.min(objectIndex, arrayIndex);
}

function promptMetadata(prompt: OpenCodePromptBuildResult): Record<string, unknown> {
  return {
    promptMode: prompt.mode,
    referencedFiles: prompt.referencedFiles,
    inlineBytes: prompt.inlineBytes,
  };
}

function recordFrom(value: unknown): Record<string, unknown> | undefined {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
    ? (value as Record<string, unknown>)
    : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sumTokens(
  inputTokens: number | undefined,
  outputTokens: number | undefined,
): number | undefined {
  if (inputTokens === undefined && outputTokens === undefined) return undefined;
  return (inputTokens ?? 0) + (outputTokens ?? 0);
}
