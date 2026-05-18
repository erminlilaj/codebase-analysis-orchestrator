import { describe, it, expect, vi } from 'vitest';
import {
  checkOpenCodeProviderHealth,
  validateOpenCodeProviderConfig,
} from './OpenCodeProviderHealth';

const validConfig = {
  enabled: true,
  command: 'opencode',
  model: 'anthropic/claude-sonnet-4-5',
  agent: 'plan',
  timeoutMs: 180000,
  maxBufferMb: 20,
  maxInlineBytes: 51200,
};

describe('checkOpenCodeProviderHealth', () => {
  it('reports disabled OpenCode provider without checking the command', async () => {
    const commandCheck = vi.fn();

    const health = await checkOpenCodeProviderHealth(
      { ...validConfig, enabled: false },
      commandCheck,
    );

    expect(health).toMatchObject({
      providerId: 'opencode',
      type: 'shell',
      enabled: false,
      configured: true,
      available: false,
      retryable: false,
      reason: 'OpenCode provider disabled',
    });
    expect(commandCheck).not.toHaveBeenCalled();
    expect(health.details).toMatchObject({ hasModel: true });
  });

  it('reports invalid numeric config as not configured', async () => {
    const health = await checkOpenCodeProviderHealth({
      ...validConfig,
      timeoutMs: 0,
    });

    expect(health).toMatchObject({
      configured: false,
      available: false,
      reason: 'OPENCODE_TIMEOUT_MS must be a positive integer',
    });
  });

  it('reports available when enabled, configured, and command check succeeds', async () => {
    const health = await checkOpenCodeProviderHealth(validConfig, async () => ({
      version: '1.15.4',
    }));

    expect(health).toMatchObject({
      configured: true,
      enabled: true,
      available: true,
      retryable: false,
    });
    expect(health.details).toMatchObject({
      command: 'opencode',
      agent: 'plan',
      model: 'anthropic/claude-sonnet-4-5',
      hasModel: true,
      version: '1.15.4',
    });
  });

  it('does not require OPENCODE_MODEL because OpenCode can use its own saved config', async () => {
    const health = await checkOpenCodeProviderHealth(
      { ...validConfig, model: undefined },
      async () => ({ version: '1.15.4' }),
    );

    expect(health).toMatchObject({
      configured: true,
      enabled: true,
      available: true,
    });
    expect(health.details).toMatchObject({
      hasModel: false,
    });
  });

  it('reports unavailable when the command check fails', async () => {
    const health = await checkOpenCodeProviderHealth(validConfig, async () => {
      throw new Error('spawn opencode ENOENT');
    });

    expect(health).toMatchObject({
      configured: true,
      enabled: true,
      available: false,
      reason: 'OPENCODE_COMMAND unavailable: spawn opencode ENOENT',
    });
  });
});

describe('validateOpenCodeProviderConfig', () => {
  it('accepts valid config', () => {
    expect(validateOpenCodeProviderConfig(validConfig)).toBeUndefined();
  });

  it('rejects empty command and agent', () => {
    expect(validateOpenCodeProviderConfig({ ...validConfig, command: '   ' })).toBe(
      'OPENCODE_COMMAND is empty',
    );
    expect(validateOpenCodeProviderConfig({ ...validConfig, agent: '   ' })).toBe(
      'OPENCODE_AGENT is empty',
    );
  });

  it('rejects invalid buffer and inline limits', () => {
    expect(validateOpenCodeProviderConfig({ ...validConfig, maxBufferMb: -1 })).toBe(
      'OPENCODE_MAX_BUFFER_MB must be a positive integer',
    );
    expect(validateOpenCodeProviderConfig({ ...validConfig, maxInlineBytes: 0 })).toBe(
      'OPENCODE_MAX_INLINE_BYTES must be a positive integer',
    );
  });
});
