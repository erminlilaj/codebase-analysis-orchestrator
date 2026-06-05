import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { OllamaHttpProvider, type OllamaHttpProviderConfig } from './OllamaHttpProvider';
import type { ProviderAnalysisInput } from '../common/AnalysisProvider';

const baseConfig: OllamaHttpProviderConfig = {
  enabled: true,
  baseUrl: 'http://127.0.0.1:11434',
  model: 'granite4.1:8b',
  timeoutMs: 180000,
  maxInlineBytes: 200000,
};

let workspace: string;

beforeEach(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'ollama-provider-'));
  await fs.mkdir(path.join(workspace, 'src'), { recursive: true });
  await fs.writeFile(
    path.join(workspace, 'src', 'BILLING.cob'),
    [
      '       IDENTIFICATION DIVISION.',
      '       PROGRAM-ID. BILLING.',
      '       PROCEDURE DIVISION.',
      '           DISPLAY "BILLING".',
    ].join('\n'),
  );
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(workspace, { recursive: true, force: true });
});

function makeInput(overrides: Partial<ProviderAnalysisInput> = {}): ProviderAnalysisInput {
  return {
    jobId: 'job-1',
    projectId: 'project-1',
    workspacePath: workspace,
    bundle: {
      mainFile: {
        id: 'main-file',
        projectId: 'project-1',
        path: path.join(workspace, 'src', 'BILLING.cob'),
        relativePath: 'src/BILLING.cob',
        filename: 'BILLING.cob',
        extension: '.cob',
        language: 'cobol',
        checksum: 'abc',
      },
      contextFiles: [],
      unresolvedDependencies: [],
      metadata: { resolver: 'cobol' },
    },
    question: { id: 'question-1', key: 'purpose', text: 'What does this do?' },
    metadata: {},
    ...overrides,
  };
}

describe('OllamaHttpProvider', () => {
  it('reports healthy status through the shared readiness check', async () => {
    const provider = new OllamaHttpProvider(baseConfig, vi.fn(), async () => ({
      version: '0.12.6',
      models: ['granite4.1:8b'],
    }));

    await expect(provider.health()).resolves.toMatchObject({
      providerId: 'ollama',
      type: 'http',
      configured: true,
      enabled: true,
      available: true,
      details: {
        baseUrl: 'http://127.0.0.1:11434',
        model: 'granite4.1:8b',
        version: '0.12.6',
        models: ['granite4.1:8b'],
      },
    });
  });

  it('builds an inline prompt, calls /api/chat, and parses structured JSON', async () => {
    const executor = vi.fn().mockResolvedValue({
      model: 'granite4.1:8b',
      message: {
        role: 'assistant',
        content: JSON.stringify({
          answer: 'BILLING displays a billing marker.',
          confidence: 'high',
          evidence: [],
          unresolved: [],
          missingContext: [],
        }),
      },
      done: true,
      prompt_eval_count: 12,
      eval_count: 8,
      done_reason: 'stop',
      total_duration: 1234,
    });
    const provider = new OllamaHttpProvider(baseConfig, executor, async () => ({
      version: '0.12.6',
      models: ['granite4.1:8b'],
    }));

    const result = await provider.analyze(makeInput());

    expect(executor).toHaveBeenCalledOnce();
    const request = executor.mock.calls[0][0];
    expect(request.url).toBe('http://127.0.0.1:11434/api/chat');
    expect(request.body).toMatchObject({
      model: 'granite4.1:8b',
      stream: false,
      format: 'json',
    });
    expect(request.body.messages.at(-1)?.content).toContain('```cobol');
    expect(request.body.messages.at(-1)?.content).toContain('BILLING.cob');

    expect(result.parsedAnswer).toMatchObject({
      answer: 'BILLING displays a billing marker.',
      confidence: 'high',
    });
    expect(result.metadata).toMatchObject({
      providerId: 'ollama',
      parseStatus: 'parsed',
      parseSource: 'strict-json',
      modelId: 'granite4.1:8b',
      inputTokens: 12,
      outputTokens: 8,
      tokensUsed: 20,
      promptMode: 'inline-content',
      referencedFiles: ['src/BILLING.cob'],
    });
  });

  it('returns provider_error metadata for Ollama HTTP errors', async () => {
    const provider = new OllamaHttpProvider(
      baseConfig,
      async () => {
        throw new Error('model not found');
      },
      async () => ({ version: '0.12.6', models: [] }),
    );

    const result = await provider.analyze(makeInput());

    expect(result.parsedAnswer).toEqual({});
    expect(result.metadata).toMatchObject({
      providerId: 'ollama',
      parseStatus: 'parse_error',
      failureKind: 'provider_error',
      error: 'model not found',
    });
  });
});
