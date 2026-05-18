import { execFile } from 'child_process';
import type { ExecFileException } from 'child_process';
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

    const prompt = await buildOpenCodePrompt({
      bundle: input.bundle,
      question: input.question,
      mode: this.config.promptFileMode ?? 'file-reference',
      maxInlineBytes: this.config.maxInlineBytes,
      workspacePath: input.workspacePath,
    });

    const args = buildOpenCodeArgs(prompt.prompt, input.workspacePath, this.config);
    const output = await this.executor({
      command: this.config.command,
      args,
      cwd: input.workspacePath,
      env: buildOpenCodeEnv(),
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

function buildOpenCodeEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    OPENCODE_DISABLE_AUTOUPDATE: process.env.OPENCODE_DISABLE_AUTOUPDATE ?? 'true',
    OPENCODE_DISABLE_LSP_DOWNLOAD: process.env.OPENCODE_DISABLE_LSP_DOWNLOAD ?? 'true',
    OPENCODE_DISABLE_DEFAULT_PLUGINS: process.env.OPENCODE_DISABLE_DEFAULT_PLUGINS ?? 'true',
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

  return new Promise((resolve) => {
    execFile(
      request.command,
      request.args,
      {
        cwd: request.cwd,
        env: request.env,
        timeout: request.timeoutMs,
        maxBuffer: request.maxBufferBytes,
        windowsHide: true,
      },
      (error: ExecFileException | null, stdout: string | Buffer, stderr: string | Buffer) => {
        const durationMs = Date.now() - started;
        const execError = error as (ExecFileException & { killed?: boolean; signal?: string }) | null;
        resolve({
          stdout: bufferToString(stdout),
          stderr: bufferToString(stderr),
          exitCode: execError?.code === undefined ? 0 : codeToExitCode(execError.code),
          timedOut: Boolean(execError?.killed && execError.signal === 'SIGTERM'),
          durationMs,
        });
      },
    );
  });
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
