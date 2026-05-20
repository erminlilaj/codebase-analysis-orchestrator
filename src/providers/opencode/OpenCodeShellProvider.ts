import { execFile } from 'child_process';
import type { ExecFileException } from 'child_process';
import path from 'path';
import type {
  AnalysisProvider,
  ProviderAnalysisInput,
  ProviderAnalysisResult,
  ProviderHealth,
} from '../common/AnalysisProvider';
import {
  buildOpenCodePrompt,
  type OpenCodePromptBuildResult,
  type OpenCodePromptFileMode,
} from './OpenCodePromptBuilder';
import {
  checkOpenCodeProviderHealth,
  type OpenCodeCommandCheck,
  type OpenCodeProviderHealthConfig,
} from './OpenCodeProviderHealth';
import { parseOpenCodeOutput, type OpenCodeProcessOutput } from './OpenCodeOutputParser';

export type OpenCodeShellProviderConfig = OpenCodeProviderHealthConfig & {
  promptFileMode?: OpenCodePromptFileMode;
  format?: 'default' | 'json';
  skipPermissions?: boolean;
  // Extra environment variables merged into the OpenCode subprocess, e.g.
  // provider API keys configured from the Settings page.
  extraEnv?: Record<string, string>;
};

export type OpenCodeShellExecutionRequest = {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  maxBufferBytes: number;
};

export type OpenCodeShellExecutor = (
  request: OpenCodeShellExecutionRequest,
) => Promise<OpenCodeProcessOutput>;

export class OpenCodeProviderUnavailableError extends Error {
  constructor(readonly health: ProviderHealth) {
    super(`OpenCode provider unavailable: ${health.reason ?? 'unknown reason'}`);
    this.name = 'OpenCodeProviderUnavailableError';
  }
}

export class OpenCodeShellProvider implements AnalysisProvider {
  readonly id = 'opencode';
  readonly displayName = 'OpenCode CLI';

  constructor(
    private readonly config: OpenCodeShellProviderConfig,
    private readonly executor: OpenCodeShellExecutor = defaultOpenCodeShellExecutor,
    private readonly commandCheck?: OpenCodeCommandCheck,
  ) {}

  async health(): Promise<ProviderHealth> {
    return checkOpenCodeProviderHealth(this.config, this.commandCheck);
  }

  async analyze(input: ProviderAnalysisInput): Promise<ProviderAnalysisResult> {
    const health = await this.health();
    if (!health.available) {
      throw new OpenCodeProviderUnavailableError(health);
    }

    const workspacePath = path.resolve(input.workspacePath);
    const prompt = await buildOpenCodePrompt({
      bundle: input.bundle,
      question: input.question,
      mode: this.config.promptFileMode ?? 'file-reference',
      maxInlineBytes: this.config.maxInlineBytes,
      workspacePath,
    });

    const args = buildOpenCodeArgs(prompt.prompt, workspacePath, this.config);
    const output = await this.executor({
      command: this.config.command,
      args,
      cwd: workspacePath,
      env: buildOpenCodeEnv(this.config.extraEnv),
      timeoutMs: this.config.timeoutMs,
      maxBufferBytes: this.config.maxBufferMb * 1024 * 1024,
    });

    const parsed = parseOpenCodeOutput(output);
    return {
      rawOutput: parsed.rawOutput,
      parsedAnswer: parsed.parsedAnswer,
      metadata: {
        ...parsed.metadata,
        ...promptMetadata(prompt),
        modelId: this.config.model,
        command: this.config.command,
        args: redactPromptArg(args),
      },
    };
  }
}

export function buildOpenCodeArgs(
  prompt: string,
  workspacePath: string,
  config: OpenCodeShellProviderConfig,
): string[] {
  const args = [
    'run',
    '--dir',
    workspacePath,
    '--agent',
    config.agent,
    '--format',
    config.format ?? 'json',
  ];

  if (config.model?.trim()) {
    args.push('--model', config.model);
  }

  if (config.skipPermissions) {
    args.push('--dangerously-skip-permissions');
  }

  args.push(prompt);
  return args;
}

function buildOpenCodeEnv(extraEnv?: Record<string, string>): NodeJS.ProcessEnv {
  return {
    ...process.env,
    OPENCODE_DISABLE_AUTOUPDATE: process.env.OPENCODE_DISABLE_AUTOUPDATE ?? 'true',
    OPENCODE_DISABLE_LSP_DOWNLOAD: process.env.OPENCODE_DISABLE_LSP_DOWNLOAD ?? 'true',
    OPENCODE_DISABLE_DEFAULT_PLUGINS: process.env.OPENCODE_DISABLE_DEFAULT_PLUGINS ?? 'true',
    ...extraEnv,
  };
}

function promptMetadata(prompt: OpenCodePromptBuildResult): Record<string, unknown> {
  return {
    promptMode: prompt.mode,
    referencedFiles: prompt.referencedFiles,
    inlineBytes: prompt.inlineBytes,
  };
}

function redactPromptArg(args: string[]): string[] {
  return args.map((arg, index) => {
    const previous = args[index - 1];
    return previous === '--command' ? '<prompt>' : index === args.length - 1 ? '<prompt>' : arg;
  });
}

async function defaultOpenCodeShellExecutor(
  request: OpenCodeShellExecutionRequest,
): Promise<OpenCodeProcessOutput> {
  const started = Date.now();
  const ptyCommand = buildPtyCommand(request.command, request.args);

  return new Promise((resolve) => {
    execFile(
      'script',
      ['-qec', ptyCommand, '/dev/null'],
      {
        cwd: request.cwd,
        env: request.env,
        timeout: request.timeoutMs,
        maxBuffer: request.maxBufferBytes,
        windowsHide: true,
      },
      async (error: ExecFileException | null, stdout: string | Buffer, stderr: string | Buffer) => {
        const durationMs = Date.now() - started;
        const execError = error as (ExecFileException & { killed?: boolean; signal?: string }) | null;
        const stdoutString = await hydrateOpenCodeStdout(
          request,
          bufferToString(stdout),
          Boolean(execError?.killed && execError.signal === 'SIGTERM'),
        ).catch(() => bufferToString(stdout));
        resolve({
          stdout: stdoutString,
          stderr: bufferToString(stderr),
          exitCode: execError?.code === undefined ? 0 : codeToExitCode(execError.code),
          timedOut: Boolean(execError?.killed && execError.signal === 'SIGTERM'),
          durationMs,
        });
      },
    );
  });
}

async function hydrateOpenCodeStdout(
  request: OpenCodeShellExecutionRequest,
  stdout: string,
  timedOut: boolean,
): Promise<string> {
  if (timedOut || stdout.includes('"type":"text"') || stdout.includes('"type": "text"')) return stdout;

  const sessionId = extractOpenCodeSessionId(stdout);
  if (!sessionId) return stdout;

  const query = buildOpenCodePartsQuery(sessionId);
  const { stdout: dbStdout } = await execFilePromise(request.command, ['db', '--format', 'json', query], {
    cwd: request.cwd,
    env: request.env,
    timeout: Math.min(request.timeoutMs, 10000),
    maxBuffer: request.maxBufferBytes,
    windowsHide: true,
  });

  const hydrated = buildHydratedOpenCodeEvent(dbStdout);
  return hydrated ? `${stdout.trimEnd()}\n${JSON.stringify(hydrated)}\n` : stdout;
}

export function extractOpenCodeSessionId(stdout: string): string | undefined {
  const match = stdout.match(/"sessionID"\s*:\s*"(ses_[^"]+)"/);
  return match?.[1];
}

export function buildOpenCodePartsQuery(sessionId: string): string {
  return [
    'select part.message_id as message_id, part.data as data, message.data as message_data',
    'from part join message on message.id = part.message_id',
    `where part.session_id = ${sqlString(sessionId)}`,
    'order by part.time_created',
  ].join(' ');
}

function buildHydratedOpenCodeEvent(dbStdout: string): Record<string, unknown> | undefined {
  let rows: unknown;
  try {
    rows = JSON.parse(dbStdout);
  } catch {
    return undefined;
  }
  if (!Array.isArray(rows)) return undefined;

  const assistantMessages = new Map<
    string,
    { textParts: string[]; tokenStats: Record<string, unknown> }
  >();

  for (const row of rows) {
    if (
      !isRecord(row) ||
      typeof row.message_id !== 'string' ||
      typeof row.data !== 'string' ||
      typeof row.message_data !== 'string'
    ) {
      continue;
    }
    const messageData = parseJsonRecord(row.message_data);
    if (messageData?.role !== 'assistant') continue;

    const data = parseJsonRecord(row.data);
    if (!data) continue;

    const message = assistantMessages.get(row.message_id) ?? {
      textParts: [],
      tokenStats: {},
    };
    if (data.type === 'text' && typeof data.text === 'string') {
      message.textParts.push(data.text);
    }
    if (data.type === 'step-finish' && isRecord(data.tokens)) {
      message.tokenStats = data.tokens;
    }
    assistantMessages.set(row.message_id, message);
  }

  const finalMessage = Array.from(assistantMessages.values())
    .reverse()
    .find((message) => message.textParts.some((part) => part.trim().length > 0));
  if (!finalMessage) return undefined;

  const text = finalMessage.textParts.join('').trim();
  if (!text) return undefined;

  return {
    type: 'text',
    text,
    usage: {
      input_tokens: numberFrom(finalMessage.tokenStats.input),
      output_tokens: numberFrom(finalMessage.tokenStats.output),
      total_tokens: numberFrom(finalMessage.tokenStats.total),
    },
  };
}

function execFilePromise(
  command: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    timeout: number;
    maxBuffer: number;
    windowsHide: boolean;
  },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout: bufferToString(stdout), stderr: bufferToString(stderr) });
    });
  });
}

function parseJsonRecord(text: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function numberFrom(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function buildPtyCommand(command: string, args: string[]): string {
  return [command, ...args].map(quoteShellArg).join(' ');
}

function quoteShellArg(value: string): string {
  if (/^[A-Za-z0-9_/:=.,@%+-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function bufferToString(value: string | Buffer): string {
  return Buffer.isBuffer(value) ? value.toString('utf-8') : value;
}

function codeToExitCode(code: string | number | null | undefined): number | null {
  if (typeof code === 'number') return code;
  if (code === undefined || code === null) return null;
  const parsed = Number.parseInt(code, 10);
  return Number.isNaN(parsed) ? null : parsed;
}
