import { describe, it, expect } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { parseOpenCodeOutput } from './OpenCodeOutputParser';

const fixtureRoot = path.join(__dirname, 'fixtures');

async function fixture(name: string): Promise<string> {
  return fs.readFile(path.join(fixtureRoot, name), 'utf-8');
}

describe('parseOpenCodeOutput', () => {
  it('parses strict JSON stdout', async () => {
    const stdout = await fixture('strict-json.stdout');
    const result = parseOpenCodeOutput({ stdout, exitCode: 0, durationMs: 1000 });

    expect(result.rawOutput).toBe(stdout);
    expect(result.metadata).toMatchObject({
      providerId: 'opencode',
      parseStatus: 'parsed',
      parseSource: 'strict-json',
      exitCode: 0,
      durationMs: 1000,
    });
    expect(result.parsedAnswer).toMatchObject({
      answer: 'BILLING calculates customer charges.',
      confidence: 'high',
      unresolved: [],
    });
  });

  it('extracts JSON surrounded by explanatory text', async () => {
    const stdout = await fixture('embedded-json.stdout');
    const result = parseOpenCodeOutput({ stdout, exitCode: 0 });

    expect(result.metadata.parseStatus).toBe('parsed');
    expect(result.metadata.parseSource).toBe('embedded-json');
    expect(result.parsedAnswer).toMatchObject({
      answer: 'PAYROLL computes employee pay.',
      confidence: 'medium',
      unresolved: ['TAXTABLE'],
    });
  });

  it('parses OpenCode json event output and token stats', async () => {
    const stdout = await fixture('stream-json.ndjson');
    const result = parseOpenCodeOutput({ stdout, exitCode: 0 });

    expect(result.metadata).toMatchObject({
      parseStatus: 'parsed',
      parseSource: 'ndjson-message',
      inputTokens: 123,
      outputTokens: 45,
      tokensUsed: 168,
    });
    expect(result.parsedAnswer).toMatchObject({
      answer: 'BILLING validates customer accounts.',
      confidence: 'high',
    });
  });

  it('marks malformed JSON as parse_error while preserving raw output', async () => {
    const stdout = await fixture('malformed.stdout');
    const result = parseOpenCodeOutput({ stdout, exitCode: 0 });

    expect(result.rawOutput).toBe(stdout);
    expect(result.parsedAnswer).toEqual({});
    expect(result.metadata).toMatchObject({
      parseStatus: 'parse_error',
      parseSource: 'none',
      failureKind: 'parse_error',
    });
    expect(result.metadata.error).toContain('No valid JSON');
  });

  it('marks empty stdout as empty_output', () => {
    const result = parseOpenCodeOutput({ stdout: '', exitCode: 0 });

    expect(result.rawOutput).toBe('');
    expect(result.parsedAnswer).toEqual({});
    expect(result.metadata).toMatchObject({
      parseStatus: 'empty_output',
      parseSource: 'none',
      failureKind: 'empty_output',
    });
  });

  it('marks stderr-only output as provider_error', async () => {
    const stderr = await fixture('stderr-only.stderr');
    const result = parseOpenCodeOutput({ stdout: '', stderr, exitCode: 1 });

    expect(result.rawOutput).toBe(stderr);
    expect(result.metadata).toMatchObject({
      parseStatus: 'stderr_only',
      parseSource: 'none',
      failureKind: 'provider_error',
      stderr,
      exitCode: 1,
    });
  });

  it('marks timed-out output distinctly and keeps partial stdout', async () => {
    const stdout = await fixture('timeout.stdout');
    const result = parseOpenCodeOutput({
      stdout,
      stderr: 'Timeout after 180000ms',
      exitCode: null,
      timedOut: true,
      durationMs: 180000,
    });

    expect(result.rawOutput).toBe(stdout);
    expect(result.parsedAnswer).toEqual({});
    expect(result.metadata).toMatchObject({
      parseStatus: 'timeout',
      parseSource: 'none',
      failureKind: 'timeout',
      timedOut: true,
      durationMs: 180000,
      stderr: 'Timeout after 180000ms',
    });
  });
});
