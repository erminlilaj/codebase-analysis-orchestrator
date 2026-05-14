import { describe, it, expect, vi } from 'vitest';
import path from 'path';
import { BobProviderUnavailableError, BobShellProvider, buildBobArgs } from './BobShellProvider';
import type { ProviderAnalysisInput } from '../common/AnalysisProvider';
import type { BobShellProviderConfig } from './BobShellProvider';

const baseConfig: BobShellProviderConfig = {
  enabled: true,
  command: 'bob',
  apiKey: 'secret-key',
  timeoutMs: 180000,
  maxBufferMb: 20,
  maxInlineBytes: 51200,
};

function makeInput(overrides: Partial<ProviderAnalysisInput> = {}): ProviderAnalysisInput {
  return {
    jobId: 'job-1',
    projectId: 'project-1',
    workspacePath: '/tmp/workspace/job-1',
    bundle: {
      mainFile: {
        id: 'main-file',
        projectId: 'project-1',
        path: path.join('/repo', 'src/BILLING.cob'),
        relativePath: 'src/BILLING.cob',
        filename: 'BILLING.cob',
        extension: '.cob',
        language: 'cobol',
        checksum: 'abc',
      },
      contextFiles: [
        {
          id: 'copybook',
          projectId: 'project-1',
          path: path.join('/repo', 'copybooks/CUSTOMER.cpy'),
          relativePath: 'copybooks/CUSTOMER.cpy',
          filename: 'CUSTOMER.cpy',
          extension: '.cpy',
          language: 'cobol',
          checksum: 'def',
        },
      ],
      unresolvedDependencies: [],
      metadata: { resolver: 'cobol' },
    },
    question: { id: 'question-1', key: 'purpose', text: 'What does this do?' },
    metadata: {},
    ...overrides,
  };
}

describe('BobShellProvider', () => {
  it('reports health through the shared readiness check', async () => {
    const provider = new BobShellProvider(baseConfig, vi.fn(), async () => ({
      version: '1.0.3',
    }));

    await expect(provider.health()).resolves.toMatchObject({
      providerId: 'bob',
      type: 'shell',
      configured: true,
      enabled: true,
      available: true,
      details: {
        version: '1.0.3',
        hasApiKey: true,
      },
    });
  });

  it('fails fast when Bob is unavailable and does not execute the command', async () => {
    const executor = vi.fn();
    const provider = new BobShellProvider(
      { ...baseConfig, enabled: false },
      executor,
      async () => ({ version: '1.0.3' }),
    );

    await expect(provider.analyze(makeInput())).rejects.toBeInstanceOf(
      BobProviderUnavailableError,
    );
    expect(executor).not.toHaveBeenCalled();
  });

  it('builds the prompt, executes Bob, parses output, and returns safe metadata', async () => {
    const executor = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({
        answer: 'BILLING calculates customer charges.',
        confidence: 'high',
        evidence: [],
        unresolved: [],
        missingContext: [],
      }),
      stderr: '',
      exitCode: 0,
      timedOut: false,
      durationMs: 25,
    });
    const provider = new BobShellProvider(baseConfig, executor, async () => ({
      version: '1.0.3',
    }));

    const result = await provider.analyze(makeInput());

    expect(executor).toHaveBeenCalledOnce();
    const request = executor.mock.calls[0][0];
    expect(request).toMatchObject({
      command: 'bob',
      cwd: '/tmp/workspace/job-1',
      timeoutMs: 180000,
      maxBufferBytes: 20 * 1024 * 1024,
    });
    expect(request.env.BOBSHELL_API_KEY).toBe('secret-key');
    expect(request.args).toEqual(
      expect.arrayContaining([
        '--auth-method',
        'api-key',
        '--accept-license',
        '--chat-mode',
        'ask',
        '--hide-intermediary-output',
        '-p',
      ]),
    );
    expect(request.args.at(-1)).toContain('@src/BILLING.cob');
    expect(request.args.at(-1)).toContain('@copybooks/CUSTOMER.cpy');

    expect(result.parsedAnswer).toMatchObject({
      answer: 'BILLING calculates customer charges.',
      confidence: 'high',
    });
    expect(result.metadata).toMatchObject({
      providerId: 'bob',
      parseStatus: 'parsed',
      parseSource: 'strict-json',
      promptMode: 'file-reference',
      referencedFiles: ['src/BILLING.cob', 'copybooks/CUSTOMER.cpy'],
      inlineBytes: 0,
      command: 'bob',
    });
    expect(result.metadata.args).toContain('<prompt>');
    expect(JSON.stringify(result.metadata)).not.toContain('secret-key');
    expect(JSON.stringify(result.metadata)).not.toContain('BILLING calculates customer charges.');
  });
});

describe('buildBobArgs', () => {
  it('can omit intermediary-output hiding when configured', () => {
    const args = buildBobArgs('prompt', {
      ...baseConfig,
      chatMode: 'plan',
      hideIntermediaryOutput: false,
    });

    expect(args).toEqual([
      '--auth-method',
      'api-key',
      '--accept-license',
      '--chat-mode',
      'plan',
      '-p',
      'prompt',
    ]);
  });
});
