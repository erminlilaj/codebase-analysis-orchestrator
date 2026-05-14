import { execFile } from 'child_process';
import type { ExecFileException } from 'child_process';
import type {
  AnalysisProvider,
  ProviderAnalysisInput,
  ProviderAnalysisResult,
  ProviderHealth,
} from '../common/AnalysisProvider';
import {
  buildBobPrompt,
  type PromptFileMode,
  type BobPromptBuildResult,
} from './BobPromptBuilder';
import {
  checkBobProviderHealth,
  type BobCommandCheck,
  type BobProviderHealthConfig,
} from './BobProviderHealth';
import { parseBobOutput, type BobProcessOutput } from './BobOutputParser';

export type BobShellProviderConfig = BobProviderHealthConfig & {
  promptFileMode?: PromptFileMode;
  chatMode?: 'ask' | 'code' | 'plan' | 'advanced';
  hideIntermediaryOutput?: boolean;
};

export type BobShellExecutionRequest = {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  maxBufferBytes: number;
};

export type BobShellExecutor = (
  request: BobShellExecutionRequest,
) => Promise<BobProcessOutput>;

export class BobProviderUnavailableError extends Error {
  constructor(readonly health: ProviderHealth) {
    super(`Bob provider unavailable: ${health.reason ?? 'unknown reason'}`);
    this.name = 'BobProviderUnavailableError';
  }
}

export class BobShellProvider implements AnalysisProvider {
  readonly id = 'bob';
  readonly displayName = 'IBM Bob Shell';

  constructor(
    private readonly config: BobShellProviderConfig,
    private readonly executor: BobShellExecutor = defaultBobShellExecutor,
    private readonly commandCheck?: BobCommandCheck,
  ) {}

  async health(): Promise<ProviderHealth> {
    return checkBobProviderHealth(this.config, this.commandCheck);
  }

  async analyze(input: ProviderAnalysisInput): Promise<ProviderAnalysisResult> {
    const health = await this.health();
    if (!health.available) {
      throw new BobProviderUnavailableError(health);
    }

    const prompt = await buildBobPrompt({
      bundle: input.bundle,
      question: input.question,
      mode: this.config.promptFileMode ?? 'file-reference',
      maxInlineBytes: this.config.maxInlineBytes,
      workspacePath: input.workspacePath,
    });

    const args = buildBobArgs(prompt.prompt, this.config);
    const output = await this.executor({
      command: this.config.command,
      args,
      cwd: input.workspacePath,
      env: buildBobEnv(this.config),
      timeoutMs: this.config.timeoutMs,
      maxBufferBytes: this.config.maxBufferMb * 1024 * 1024,
    });

    const parsed = parseBobOutput(output);
    return {
      rawOutput: parsed.rawOutput,
      parsedAnswer: parsed.parsedAnswer,
      metadata: {
        ...parsed.metadata,
        ...promptMetadata(prompt),
        command: this.config.command,
        args: redactPromptArg(args),
      },
    };
  }
}

export function buildBobArgs(prompt: string, config: BobShellProviderConfig): string[] {
  const args = [
    '--auth-method',
    'api-key',
    '--accept-license',
    '--chat-mode',
    config.chatMode ?? 'ask',
  ];

  if (config.hideIntermediaryOutput ?? true) {
    args.push('--hide-intermediary-output');
  }

  args.push('-p', prompt);
  return args;
}

function buildBobEnv(config: BobShellProviderConfig): NodeJS.ProcessEnv {
  return {
    ...process.env,
    BOBSHELL_API_KEY: config.apiKey ?? '',
  };
}

function promptMetadata(prompt: BobPromptBuildResult): Record<string, unknown> {
  return {
    promptMode: prompt.mode,
    referencedFiles: prompt.referencedFiles,
    inlineBytes: prompt.inlineBytes,
  };
}

function redactPromptArg(args: string[]): string[] {
  return args.map((arg, index) => {
    const previous = args[index - 1];
    return previous === '-p' || previous === '--prompt' ? '<prompt>' : arg;
  });
}

async function defaultBobShellExecutor(
  request: BobShellExecutionRequest,
): Promise<BobProcessOutput> {
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
