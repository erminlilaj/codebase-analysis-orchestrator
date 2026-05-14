import fs from 'fs/promises';
import path from 'path';
import type {
  AnalysisProvider,
  ProviderAnalysisInput,
  ProviderAnalysisResult,
} from '../common/AnalysisProvider';

export type StubProviderConfig = {
  delayMs?: number;
  failureRate?: number; // 0..1, probability that analyze() throws
};

// Deterministic placeholder provider used to exercise the pipeline end-to-end
// without a real LLM. Reads the main file from the workspace (so it also
// validates the workspace builder).
export class StubProvider implements AnalysisProvider {
  readonly id = 'stub';
  readonly displayName = 'Stub Provider (canned answers for testing)';

  constructor(private readonly config: StubProviderConfig = {}) {}

  async health() {
    return {
      providerId: this.id,
      name: this.displayName,
      type: 'stub' as const,
      configured: true,
      enabled: true,
      available: true,
      retryable: false,
      details: {
        delayMs: this.config.delayMs ?? 0,
        failureRate: this.config.failureRate ?? 0,
      },
    };
  }

  async analyze(input: ProviderAnalysisInput): Promise<ProviderAnalysisResult> {
    if (this.config.delayMs && this.config.delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, this.config.delayMs));
    }

    if (this.config.failureRate && Math.random() < this.config.failureRate) {
      throw new Error(`Stub provider simulated failure for job ${input.jobId}`);
    }

    const mainAbsPath = path.join(input.workspacePath, input.bundle.mainFile.relativePath);
    let mainContent = '';
    let lineCount = 0;
    try {
      mainContent = await fs.readFile(mainAbsPath, 'utf-8');
      lineCount = mainContent.split('\n').length;
    } catch {
      // Missing file is non-fatal for the stub.
    }

    const file = input.bundle.mainFile.relativePath;
    const summary = `Stub answer for question "${input.question.key}" on file ${file}`;
    const rawOutput =
      `${summary}\n\n` +
      `Question: ${input.question.text}\n` +
      `File: ${file}\n` +
      `Lines: ${lineCount}\n` +
      `Context files: ${input.bundle.contextFiles.length}`;

    return {
      rawOutput,
      parsedAnswer: {
        summary,
        questionKey: input.question.key,
        mainFile: file,
        lineCount,
        contextFileCount: input.bundle.contextFiles.length,
      },
      metadata: {
        modelId: 'stub-v1',
        tokensUsed: Math.max(50, lineCount * 5),
      },
    };
  }
}
