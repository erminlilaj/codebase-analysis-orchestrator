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

  it('parses nested OpenCode message.part.updated text events', () => {
    const stdout = [
      JSON.stringify({
        type: 'message.part.updated',
        properties: {
          part: {
            type: 'text',
            text: '{"answer":"Nested event parsed.","confidence":"high","evidence":[],"unresolved":[],"missingContext":[]}',
          },
        },
      }),
      JSON.stringify({
        type: 'message.part.updated',
        properties: {
          part: {
            type: 'step-finish',
            tokens: { input: 10, output: 5, total: 15 },
          },
        },
      }),
    ].join('\n');

    const result = parseOpenCodeOutput({ stdout, exitCode: 0 });

    expect(result.metadata).toMatchObject({
      parseStatus: 'parsed',
      parseSource: 'ndjson-message',
    });
    expect(result.parsedAnswer).toMatchObject({
      answer: 'Nested event parsed.',
      confidence: 'high',
    });
  });

  it('does not treat user message content as assistant output', () => {
    const stdout = [
      JSON.stringify({
        type: 'message.updated',
        message: {
          role: 'user',
          content: '{"answer":"This is the prompt, not the answer."}',
        },
      }),
      JSON.stringify({
        type: 'message.updated',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: '{"answer":"Assistant event parsed.","confidence":"medium","evidence":[],"unresolved":[],"missingContext":[]}',
            },
          ],
        },
      }),
    ].join('\n');

    const result = parseOpenCodeOutput({ stdout, exitCode: 0 });

    expect(result.metadata.parseStatus).toBe('parsed');
    expect(result.parsedAnswer).toMatchObject({
      answer: 'Assistant event parsed.',
      confidence: 'medium',
    });
  });

  it('marks a single OpenCode error event as provider_error', () => {
    const stdout = JSON.stringify({
      type: 'error',
      error: {
        data: { message: 'Unexpected server error. Check server logs for details.' },
        name: 'UnknownError',
      },
      sessionID: 'ses_168753f8dffedByEjzfLeb5lfv',
      timestamp: 1780658913590,
    });

    const result = parseOpenCodeOutput({ stdout, exitCode: 0 });

    expect(result.parsedAnswer).toEqual({});
    expect(result.metadata).toMatchObject({
      parseStatus: 'parse_error',
      parseSource: 'strict-json',
      failureKind: 'provider_error',
      error: 'Unexpected server error. Check server logs for details.',
    });
  });

  it('marks OpenCode error events inside NDJSON as provider_error', () => {
    const stdout = [
      JSON.stringify({
        type: 'session.created',
        sessionID: 'ses_168753f8dffedByEjzfLeb5lfv',
      }),
      JSON.stringify({
        type: 'error',
        error: {
          data: { message: 'Unexpected server error. Check server logs for details.' },
          name: 'UnknownError',
        },
      }),
    ].join('\n');

    const result = parseOpenCodeOutput({ stdout, exitCode: 0 });

    expect(result.parsedAnswer).toEqual({});
    expect(result.metadata).toMatchObject({
      parseStatus: 'parse_error',
      parseSource: 'none',
      failureKind: 'provider_error',
      error: 'Unexpected server error. Check server logs for details.',
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
