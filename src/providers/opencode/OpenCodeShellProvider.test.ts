import { describe, it, expect, vi } from 'vitest';
import path from 'path';
import {
  OpenCodeProviderUnavailableError,
  OpenCodeShellProvider,
  buildOpenCodeArgs,
  buildOpenCodePartsQuery,
  buildPtyCommand,
  extractOpenCodeSessionId,
} from './OpenCodeShellProvider';
import type { ProviderAnalysisInput } from '../common/AnalysisProvider';
import type { OpenCodeShellProviderConfig } from './OpenCodeShellProvider';

const baseConfig: OpenCodeShellProviderConfig = {
  enabled: true,
  command: 'opencode',
  model: 'anthropic/claude-sonnet-4-5',
  agent: 'plan',
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

describe('OpenCodeShellProvider', () => {
  it('reports health through the shared readiness check', async () => {
    const provider = new OpenCodeShellProvider(baseConfig, vi.fn(), async () => ({
      version: '1.15.4',
    }));

    await expect(provider.health()).resolves.toMatchObject({
      providerId: 'opencode',
      type: 'shell',
      configured: true,
      enabled: true,
      available: true,
      details: {
        version: '1.15.4',
        model: 'anthropic/claude-sonnet-4-5',
        agent: 'plan',
      },
    });
  });

  it('fails fast when OpenCode is unavailable and does not execute the command', async () => {
    const executor = vi.fn();
    const provider = new OpenCodeShellProvider(
      { ...baseConfig, enabled: false },
      executor,
      async () => ({ version: '1.15.4' }),
    );

    await expect(provider.analyze(makeInput())).rejects.toBeInstanceOf(
      OpenCodeProviderUnavailableError,
    );
    expect(executor).not.toHaveBeenCalled();
  });

  it('builds the prompt, executes OpenCode, parses output, and returns safe metadata', async () => {
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
    const provider = new OpenCodeShellProvider(baseConfig, executor, async () => ({
      version: '1.15.4',
    }));

    const result = await provider.analyze(makeInput());

    expect(executor).toHaveBeenCalledOnce();
    const request = executor.mock.calls[0][0];
    expect(request).toMatchObject({
      command: 'opencode',
      cwd: '/tmp/workspace/job-1',
      timeoutMs: 180000,
      maxBufferBytes: 20 * 1024 * 1024,
    });
    expect(request.env.OPENCODE_DISABLE_AUTOUPDATE).toBe('true');
    expect(request.env.OPENCODE_DISABLE_LSP_DOWNLOAD).toBe('true');
    expect(request.env.OPENCODE_DISABLE_DEFAULT_PLUGINS).toBe('true');
    expect(request.args).toEqual(
      expect.arrayContaining([
        'run',
        '--dir',
        '/tmp/workspace/job-1',
        '--agent',
        'plan',
        '--model',
        'anthropic/claude-sonnet-4-5',
        '--format',
        'json',
      ]),
    );
    expect(request.args.at(-1)).toContain('@src/BILLING.cob');
    expect(request.args.at(-1)).toContain('@copybooks/CUSTOMER.cpy');

    expect(result.parsedAnswer).toMatchObject({
      answer: 'BILLING calculates customer charges.',
      confidence: 'high',
    });
    expect(result.metadata).toMatchObject({
      providerId: 'opencode',
      parseStatus: 'parsed',
      parseSource: 'strict-json',
      promptMode: 'file-reference',
      referencedFiles: ['src/BILLING.cob', 'copybooks/CUSTOMER.cpy'],
      inlineBytes: 0,
      modelId: 'anthropic/claude-sonnet-4-5',
      command: 'opencode',
    });
    expect(result.metadata.args).toContain('<prompt>');
    expect(JSON.stringify(result.metadata)).not.toContain('BILLING calculates customer charges.');
  });
});

describe('buildOpenCodeArgs', () => {
  it('builds CLI-only non-interactive run args', () => {
    const args = buildOpenCodeArgs('prompt', '/tmp/workspace/job-1', {
      ...baseConfig,
      agent: 'review',
      format: 'default',
      skipPermissions: true,
    });

    expect(args).toEqual([
      'run',
      '--dir',
      '/tmp/workspace/job-1',
      '--agent',
      'review',
      '--format',
      'default',
      '--model',
      'anthropic/claude-sonnet-4-5',
      '--dangerously-skip-permissions',
      'prompt',
    ]);
  });
});

describe('buildPtyCommand', () => {
  it('quotes arguments for script -qec without exposing shell metacharacters', () => {
    const command = buildPtyCommand('/home/me/.opencode/bin/opencode', [
      'run',
      '--dir',
      '/tmp/work space/job-1',
      '--format',
      'json',
      "Say 'hi' && do not run commands",
    ]);

    expect(command).toBe(
      "/home/me/.opencode/bin/opencode run --dir '/tmp/work space/job-1' --format json 'Say '\\''hi'\\'' && do not run commands'",
    );
  });
});

describe('OpenCode session helpers', () => {
  it('extracts the session id from json event output', () => {
    expect(
      extractOpenCodeSessionId(
        '{"type":"step_start","sessionID":"ses_abc123","part":{"type":"step-start"}}',
      ),
    ).toBe('ses_abc123');
  });

  it('builds a quoted parts query for OpenCode db', () => {
    expect(buildOpenCodePartsQuery("ses_a'b")).toBe(
      "select part.message_id as message_id, part.data as data, message.data as message_data from part join message on message.id = part.message_id where part.session_id = 'ses_a''b' order by part.time_created",
    );
  });
});
