import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { StubProvider } from './StubProvider';
import type { ProviderAnalysisInput } from '../common/AnalysisProvider';

let workspace: string;

beforeEach(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'stub-'));
});

afterEach(async () => {
  await fs.rm(workspace, { recursive: true, force: true });
});

function makeInput(over: Partial<ProviderAnalysisInput> = {}): ProviderAnalysisInput {
  return {
    jobId: 'j1',
    projectId: 'p1',
    workspacePath: workspace,
    bundle: {
      mainFile: {
        id: 'f1',
        projectId: 'p1',
        path: path.join(workspace, 'src/main.cob'),
        relativePath: 'src/main.cob',
        filename: 'main.cob',
        extension: '.cob',
        language: 'cobol',
        checksum: '',
      },
      contextFiles: [],
      unresolvedDependencies: [],
      metadata: {},
    },
    question: { id: 'q1', key: 'purpose', text: 'What is the purpose?' },
    metadata: {},
    ...over,
  };
}

describe('StubProvider', () => {
  it('exposes id and displayName', () => {
    const provider = new StubProvider();
    expect(provider.id).toBe('stub');
    expect(provider.displayName).toMatch(/Stub/i);
  });

  it('returns rawOutput referencing the question key and main file', async () => {
    const provider = new StubProvider();
    const result = await provider.analyze(makeInput());
    expect(result.rawOutput).toContain('purpose');
    expect(result.rawOutput).toContain('src/main.cob');
  });

  it('counts lines in the workspace file when present', async () => {
    await fs.mkdir(path.join(workspace, 'src'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'src/main.cob'), 'A\nB\nC\nD\n');
    const provider = new StubProvider();
    const result = await provider.analyze(makeInput());
    const parsed = result.parsedAnswer as { lineCount: number };
    expect(parsed.lineCount).toBeGreaterThanOrEqual(4);
  });

  it('does not throw when the workspace file is missing', async () => {
    const provider = new StubProvider();
    await expect(provider.analyze(makeInput())).resolves.toBeDefined();
  });

  it('attaches modelId and tokensUsed metadata', async () => {
    const provider = new StubProvider();
    const result = await provider.analyze(makeInput());
    expect(result.metadata.modelId).toBe('stub-v1');
    expect(typeof result.metadata.tokensUsed).toBe('number');
  });

  it('throws when failureRate is 1', async () => {
    const provider = new StubProvider({ failureRate: 1 });
    await expect(provider.analyze(makeInput())).rejects.toThrow(/simulated failure/);
  });
});
