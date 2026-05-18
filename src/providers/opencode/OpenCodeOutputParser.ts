export type OpenCodeProcessOutput = {
  stdout: string;
  stderr?: string;
  exitCode?: number | null;
  timedOut?: boolean;
  durationMs?: number;
};

export type OpenCodeOutputParseSource =
  | 'strict-json'
  | 'embedded-json'
  | 'ndjson-message'
  | 'none';

export type OpenCodeOutputParseStatus =
  | 'parsed'
  | 'parse_error'
  | 'empty_output'
  | 'stderr_only'
  | 'timeout';

export type OpenCodeOutputFailureKind =
  | 'parse_error'
  | 'empty_output'
  | 'provider_error'
  | 'timeout';

export type OpenCodeOutputParseMetadata = {
  providerId: 'opencode';
  parseStatus: OpenCodeOutputParseStatus;
  parseSource: OpenCodeOutputParseSource;
  failureKind?: OpenCodeOutputFailureKind;
  error?: string;
  exitCode?: number | null;
  timedOut?: boolean;
  durationMs?: number;
  stderr?: string;
  inputTokens?: number;
  outputTokens?: number;
  tokensUsed?: number;
};

export type OpenCodeOutputParseResult = {
  rawOutput: string;
  parsedAnswer: unknown;
  metadata: OpenCodeOutputParseMetadata;
};

type ParsedJsonValue = {
  value: unknown;
  source: Exclude<OpenCodeOutputParseSource, 'ndjson-message' | 'none'>;
};

export function parseOpenCodeOutput(
  output: OpenCodeProcessOutput,
): OpenCodeOutputParseResult {
  const stdout = output.stdout ?? '';
  const stderr = output.stderr ?? '';
  const rawOutput = stdout.length > 0 ? stdout : stderr;
  const baseMetadata = buildBaseMetadata(output);

  if (output.timedOut) {
    return failureResult(rawOutput, {
      ...baseMetadata,
      parseStatus: 'timeout',
      parseSource: 'none',
      failureKind: 'timeout',
      error: 'OpenCode command timed out',
    });
  }

  if (stdout.trim().length === 0 && stderr.trim().length > 0) {
    return failureResult(rawOutput, {
      ...baseMetadata,
      parseStatus: 'stderr_only',
      parseSource: 'none',
      failureKind: 'provider_error',
      error: 'OpenCode produced stderr without stdout',
    });
  }

  if (stdout.trim().length === 0) {
    return failureResult(rawOutput, {
      ...baseMetadata,
      parseStatus: 'empty_output',
      parseSource: 'none',
      failureKind: 'empty_output',
      error: 'OpenCode produced no stdout',
    });
  }

  const ndjson = parseNdjson(stdout);
  if (ndjson) {
    return {
      rawOutput,
      parsedAnswer: ndjson.parsedAnswer,
      metadata: {
        ...baseMetadata,
        ...ndjson.tokenMetadata,
        parseStatus: ndjson.ok ? 'parsed' : 'parse_error',
        parseSource: ndjson.ok ? 'ndjson-message' : ndjson.parseSource,
        failureKind: ndjson.ok ? undefined : 'parse_error',
        error: ndjson.ok ? undefined : ndjson.error,
      },
    };
  }

  const parsed = parseJsonAnswer(stdout);
  if (parsed.ok) {
    return {
      rawOutput,
      parsedAnswer: parsed.value,
      metadata: {
        ...baseMetadata,
        parseStatus: 'parsed',
        parseSource: parsed.source,
      },
    };
  }

  return failureResult(rawOutput, {
    ...baseMetadata,
    parseStatus: 'parse_error',
    parseSource: 'none',
    failureKind: 'parse_error',
    error: parsed.error,
  });
}

function buildBaseMetadata(output: OpenCodeProcessOutput): OpenCodeOutputParseMetadata {
  return {
    providerId: 'opencode',
    parseStatus: 'parse_error',
    parseSource: 'none',
    exitCode: output.exitCode,
    timedOut: output.timedOut,
    durationMs: output.durationMs,
    stderr: output.stderr,
  };
}

function failureResult(
  rawOutput: string,
  metadata: OpenCodeOutputParseMetadata,
): OpenCodeOutputParseResult {
  return {
    rawOutput,
    parsedAnswer: {},
    metadata,
  };
}

function parseJsonAnswer(
  text: string,
): ({ ok: true } & ParsedJsonValue) | { ok: false; error: string } {
  const trimmed = text.trim();

  try {
    return { ok: true, value: JSON.parse(trimmed), source: 'strict-json' };
  } catch {
    // Fall through to embedded JSON extraction.
  }

  const embedded = extractFirstJsonValue(trimmed);
  if (!embedded) {
    return { ok: false, error: 'No valid JSON object or array found in OpenCode output' };
  }

  try {
    return { ok: true, value: JSON.parse(embedded), source: 'embedded-json' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function parseNdjson(
  stdout: string,
):
  | {
      ok: boolean;
      parsedAnswer: unknown;
      parseSource: OpenCodeOutputParseSource;
      tokenMetadata: Partial<OpenCodeOutputParseMetadata>;
      error?: string;
    }
  | undefined {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) return undefined;

  const events: unknown[] = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch {
      return undefined;
    }
  }

  const textParts: string[] = [];
  let tokenMetadata: Partial<OpenCodeOutputParseMetadata> = {};

  for (const event of events) {
    if (!isRecord(event)) continue;
    const text = extractEventText(event);
    if (text) textParts.push(text);
    tokenMetadata = {
      ...tokenMetadata,
      ...parseTokenStats(event),
      ...parseTokenStats(recordFrom(event.info)),
      ...parseTokenStats(recordFrom(event.usage)),
      ...parseTokenStats(recordFrom(event.cost)),
    };
  }

  const completionText = textParts.join('').trim();
  if (!completionText) {
    return {
      ok: false,
      parsedAnswer: {},
      parseSource: 'none',
      tokenMetadata,
      error: 'NDJSON output did not contain assistant text',
    };
  }

  const parsed = parseJsonAnswer(completionText);
  if (!parsed.ok) {
    return {
      ok: false,
      parsedAnswer: {},
      parseSource: 'ndjson-message',
      tokenMetadata,
      error: parsed.error,
    };
  }

  return {
    ok: true,
    parsedAnswer: parsed.value,
    parseSource: 'ndjson-message',
    tokenMetadata,
  };
}

function extractEventText(event: Record<string, unknown>): string | undefined {
  const direct = stringFrom(event.text) ?? stringFrom(event.message) ?? stringFrom(event.content);
  if (direct) return direct;

  const part = recordFrom(event.part);
  const partText = stringFrom(part?.text) ?? stringFrom(part?.content);
  if (partText) return partText;

  const delta = recordFrom(event.delta);
  const deltaText = stringFrom(delta?.text) ?? stringFrom(delta?.content);
  if (deltaText) return deltaText;

  const info = recordFrom(event.info);
  const output = info ? stringFrom(info.output) ?? stringFrom(info.message) : undefined;
  if (output) return output;

  return undefined;
}

function parseTokenStats(
  stats: Record<string, unknown> | undefined,
): Partial<OpenCodeOutputParseMetadata> {
  if (!stats) return {};
  const inputTokens =
    numberFrom(stats.input_tokens) ?? numberFrom(stats.inputTokens) ?? numberFrom(stats.prompt_tokens);
  const outputTokens =
    numberFrom(stats.output_tokens) ??
    numberFrom(stats.outputTokens) ??
    numberFrom(stats.completion_tokens);
  const totalTokens =
    numberFrom(stats.total_tokens) ?? numberFrom(stats.totalTokens) ?? numberFrom(stats.tokens);

  return {
    inputTokens,
    outputTokens,
    tokensUsed: totalTokens ?? sumTokens(inputTokens, outputTokens),
  };
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
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function recordFrom(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function stringFrom(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberFrom(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function sumTokens(
  inputTokens: number | undefined,
  outputTokens: number | undefined,
): number | undefined {
  if (inputTokens === undefined && outputTokens === undefined) return undefined;
  return (inputTokens ?? 0) + (outputTokens ?? 0);
}
