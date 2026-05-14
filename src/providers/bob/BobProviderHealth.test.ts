import { describe, it, expect, vi } from 'vitest';
import { checkBobProviderHealth, validateBobProviderConfig } from './BobProviderHealth';

const validConfig = {
  enabled: true,
  command: 'bob',
  apiKey: 'secret',
  timeoutMs: 180000,
  maxBufferMb: 20,
  maxInlineBytes: 51200,
};

describe('checkBobProviderHealth', () => {
  it('reports disabled Bob provider without checking the command', async () => {
    const commandCheck = vi.fn();

    const health = await checkBobProviderHealth(
      { ...validConfig, enabled: false },
      commandCheck,
    );

    expect(health).toMatchObject({
      providerId: 'bob',
      type: 'shell',
      enabled: false,
      configured: true,
      available: false,
      retryable: false,
      reason: 'Bob provider disabled',
    });
    expect(commandCheck).not.toHaveBeenCalled();
    expect(health.details).toMatchObject({ hasApiKey: true });
    expect(health.details).not.toHaveProperty('apiKey');
  });

  it('reports missing API key before checking the command', async () => {
    const commandCheck = vi.fn();

    const health = await checkBobProviderHealth(
      { ...validConfig, apiKey: undefined },
      commandCheck,
    );

    expect(health).toMatchObject({
      configured: false,
      enabled: true,
      available: false,
      reason: 'BOBSHELL_API_KEY not set',
    });
    expect(commandCheck).not.toHaveBeenCalled();
  });

  it('reports invalid numeric config as not configured', async () => {
    const health = await checkBobProviderHealth({
      ...validConfig,
      timeoutMs: 0,
    });

    expect(health).toMatchObject({
      configured: false,
      available: false,
      reason: 'BOB_TIMEOUT_MS must be a positive integer',
    });
  });

  it('reports available when enabled, configured, and command check succeeds', async () => {
    const health = await checkBobProviderHealth(validConfig, async () => ({
      version: '1.0.3',
    }));

    expect(health).toMatchObject({
      configured: true,
      enabled: true,
      available: true,
      retryable: false,
    });
    expect(health.details).toMatchObject({
      command: 'bob',
      hasApiKey: true,
      version: '1.0.3',
    });
  });

  it('reports unavailable when the command check fails', async () => {
    const health = await checkBobProviderHealth(validConfig, async () => {
      throw new Error('spawn bob ENOENT');
    });

    expect(health).toMatchObject({
      configured: true,
      enabled: true,
      available: false,
      reason: 'BOB_COMMAND unavailable: spawn bob ENOENT',
    });
  });
});

describe('validateBobProviderConfig', () => {
  it('accepts valid config', () => {
    expect(validateBobProviderConfig(validConfig)).toBeUndefined();
  });

  it('rejects empty command', () => {
    expect(validateBobProviderConfig({ ...validConfig, command: '   ' })).toBe(
      'BOB_COMMAND is empty',
    );
  });

  it('rejects invalid buffer and inline limits', () => {
    expect(validateBobProviderConfig({ ...validConfig, maxBufferMb: -1 })).toBe(
      'BOB_MAX_BUFFER_MB must be a positive integer',
    );
    expect(validateBobProviderConfig({ ...validConfig, maxInlineBytes: 0 })).toBe(
      'BOB_MAX_INLINE_BYTES must be a positive integer',
    );
  });
});
