export type BobProcessOutput = {
  stdout: string;
  stderr?: string;
  exitCode?: number | null;
  timedOut?: boolean;
  durationMs?: number;
};

export type BobOutputParseSource =
  | 'strict-json'
  | 'embedded-json'
  | 'ndjson-attempt-completion'
  | 'none';

export type BobOutputParseStatus =
  | 'parsed'
  | 'parse_error'
  | 'empty_output'
  | 'stderr_only'
  | 'timeout';

export type BobOutputFailureKind =
  | 'parse_error'
  | 'empty_output'
  | 'provider_error'
  | 'timeout';

export type BobOutputParseMetadata = {
  providerId: 'bob';
  parseStatus: BobOutputParseStatus;
  parseSource: BobOutputParseSource;
  failureKind?: BobOutputFailureKind;
  error?: string;
  exitCode?: number | null;
  timedOut?: boolean;
  durationMs?: number;
  stderr?: string;
  inputTokens?: number;
  outputTokens?: number;
  tokensUsed?: number;
};

export type BobOutputParseResult = {
  rawOutput: string;
  parsedAnswer: unknown;
  metadata: BobOutputParseMetadata;
};

type ParsedJsonValue = {
  value: unknown;
  source: Exclude<BobOutputParseSource, 'ndjson-attempt-completion' | 'none'>;
};

export function parseBobOutput(output: BobProcessOutput): BobOutputParseResult {
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
      error: 'Bob Shell command timed out',
    });
  }

  if (stdout.trim().length === 0 && stderr.trim().length > 0) {
    return failureResult(rawOutput, {
      ...baseMetadata,
      parseStatus: 'stderr_only',
      parseSource: 'none',
      failureKind: 'provider_error',
      error: 'Bob Shell produced stderr without stdout',
    });
  }

  if (stdout.trim().length === 0) {
    return failureResult(rawOutput, {
      ...baseMetadata,
      parseStatus: 'empty_output',
      parseSource: 'none',
      failureKind: 'empty_output',
      error: 'Bob Shell produced no stdout',
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
        parseSource: ndjson.ok ? 'ndjson-attempt-completion' : ndjson.parseSource,
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

function buildBaseMetadata(output: BobProcessOutput): BobOutputParseMetadata {
  return {
    providerId: 'bob',
    parseStatus: 'parse_error',
    parseSource: 'none',
    exitCode: output.exitCode,
    timedOut: output.timedOut,
    durationMs: output.durationMs,
    stderr: output.stderr,
  };
}

function failureResult(rawOutput: string, metadata: BobOutputParseMetadata): BobOutputParseResult {
  return {
    rawOutput,
    parsedAnswer: {},
    metadata,
  };
}

function parseJsonAnswer(
  text: string,
): { ok: true } & ParsedJsonValue | { ok: false; error: string } {
  const trimmed = text.trim();

  try {
    return { ok: true, value: JSON.parse(trimmed), source: 'strict-json' };
  } catch {
    // Fall through to embedded JSON extraction.
  }

  const embedded = extractFirstJsonValue(trimmed);
  if (!embedded) {
    return { ok: false, error: 'No valid JSON object or array found in Bob Shell output' };
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
      parseSource: BobOutputParseSource;
      tokenMetadata: Partial<BobOutputParseMetadata>;
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

  let completionText: string | undefined;
  let tokenMetadata: Partial<BobOutputParseMetadata> = {};

  for (const event of events) {
    if (!isRecord(event)) continue;

    if (
      event.type === 'tool_use' &&
      event.tool_name === 'attempt_completion' &&
      isRecord(event.parameters) &&
      typeof event.parameters.result === 'string'
    ) {
      completionText = event.parameters.result;
    }

    if (event.type === 'result' && isRecord(event.stats)) {
      tokenMetadata = parseTokenStats(event.stats);
    }
  }

  if (!completionText) {
    return {
      ok: false,
      parsedAnswer: {},
      parseSource: 'none',
      tokenMetadata,
      error: 'NDJSON output did not contain an attempt_completion result',
    };
  }

  const parsed = parseJsonAnswer(completionText);
  if (!parsed.ok) {
    return {
      ok: false,
      parsedAnswer: {},
      parseSource: 'ndjson-attempt-completion',
      tokenMetadata,
      error: parsed.error,
    };
  }

  return {
    ok: true,
    parsedAnswer: parsed.value,
    parseSource: 'ndjson-attempt-completion',
    tokenMetadata,
  };
}

function parseTokenStats(stats: Record<string, unknown>): Partial<BobOutputParseMetadata> {
  const inputTokens = numberFrom(stats.input_tokens);
  const outputTokens = numberFrom(stats.output_tokens);
  const totalTokens = numberFrom(stats.total_tokens);

  return {
    inputTokens,
    outputTokens,
    tokensUsed: totalTokens ?? sumTokens(inputTokens, outputTokens),
  };
}

function sumTokens(inputTokens: number | undefined, outputTokens: number | undefined): number | undefined {
  if (inputTokens === undefined && outputTokens === undefined) return undefined;
  return (inputTokens ?? 0) + (outputTokens ?? 0);
}

function numberFrom(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractFirstJsonValue(text: string): string | undefined {
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char !== '{' && char !== '[') continue;

    const end = findJsonValueEnd(text, i);
    if (end === undefined) continue;

    const candidate = text.slice(i, end + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return undefined;
}

function findJsonValueEnd(text: string, start: number): number | undefined {
  const opening = text[start];
  const expectedClosing = opening === '{' ? '}' : ']';
  const stack = [expectedClosing];
  let inString = false;
  let escaped = false;

  for (let i = start + 1; i < text.length; i += 1) {
    const char = text[i];

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

    if (char === '{') {
      stack.push('}');
      continue;
    }

    if (char === '[') {
      stack.push(']');
      continue;
    }

    if (char === '}' || char === ']') {
      if (stack.pop() !== char) return undefined;
      if (stack.length === 0) return i;
    }
  }

  return undefined;
}
