import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  OpenCodePromptError,
  buildOpenCodePrompt,
  type OpenCodePromptBuilderInput,
} from './OpenCodePromptBuilder';
import type { AnalysisBundle, SourceFile } from '../../languages/common/types';

let workspace: string;

beforeEach(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-prompt-'));
});

afterEach(async () => {
  await fs.rm(workspace, { recursive: true, force: true });
});

function makeFile(overrides: Partial<SourceFile> = {}): SourceFile {
  const relativePath = overrides.relativePath ?? 'src/BILLING.cob';
  return {
    id: overrides.id ?? 'file-main',
    projectId: 'project-1',
    path: path.join(workspace, relativePath),
    relativePath,
    filename: path.basename(relativePath),
    extension: path.extname(relativePath),
    language: overrides.language ?? 'cobol',
    checksum: overrides.checksum ?? 'checksum',
    sizeBytes: overrides.sizeBytes,
  };
}

function makeBundle(overrides: Partial<AnalysisBundle> = {}): AnalysisBundle {
  const mainFile = overrides.mainFile ?? makeFile();
  return {
    mainFile,
    contextFiles:
      overrides.contextFiles ?? [
        makeFile({
          id: 'file-copybook',
          relativePath: 'copybooks/CUSTOMER.cpy',
          extension: '.cpy',
        }),
      ],
    unresolvedDependencies: overrides.unresolvedDependencies ?? ['MISSING-COPY'],
    metadata: overrides.metadata ?? { resolver: 'cobol', z: true, a: false },
  };
}

function makeInput(
  overrides: Partial<OpenCodePromptBuilderInput> = {},
): OpenCodePromptBuilderInput {
  return {
    bundle: makeBundle(),
    question: {
      id: 'question-1',
      key: 'purpose',
      text: 'What does this program do?',
    },
    mode: 'file-reference',
    maxInlineBytes: 50_000,
    workspacePath: workspace,
    ...overrides,
  };
}

describe('buildOpenCodePrompt', () => {
  it('builds deterministic file-reference prompts with OpenCode @file references', async () => {
    const result = await buildOpenCodePrompt(makeInput());

    expect(result.mode).toBe('file-reference');
    expect(result.inlineBytes).toBe(0);
    expect(result.referencedFiles).toEqual(['src/BILLING.cob', 'copybooks/CUSTOMER.cpy']);
    expect(result.prompt).toContain('Question key: purpose');
    expect(result.prompt).toContain('Do not edit files and do not run shell commands.');
    expect(result.prompt).toContain('Main file: @src/BILLING.cob');
    expect(result.prompt).toContain('- @copybooks/CUSTOMER.cpy');
    expect(result.prompt).toContain('"answer": "string"');
    expect(result.prompt.indexOf('"a": false')).toBeLessThan(result.prompt.indexOf('"z": true'));
  });

  it('builds inline-content prompts from workspace files', async () => {
    await fs.mkdir(path.join(workspace, 'src'), { recursive: true });
    await fs.mkdir(path.join(workspace, 'copybooks'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'src/BILLING.cob'), 'IDENTIFICATION DIVISION.\n');
    await fs.writeFile(path.join(workspace, 'copybooks/CUSTOMER.cpy'), '01 CUSTOMER-ID PIC X(10).\n');

    const result = await buildOpenCodePrompt(makeInput({ mode: 'inline-content' }));

    expect(result.mode).toBe('inline-content');
    expect(result.inlineBytes).toBe(Buffer.byteLength('IDENTIFICATION DIVISION.\n01 CUSTOMER-ID PIC X(10).\n'));
    expect(result.prompt).toContain('Main file: src/BILLING.cob');
    expect(result.prompt).toContain('Context file: copybooks/CUSTOMER.cpy');
    expect(result.prompt).toContain('```cobol');
    expect(result.prompt).toContain('IDENTIFICATION DIVISION.');
    expect(result.prompt).toContain('01 CUSTOMER-ID PIC X(10).');
  });

  it('rejects inline prompts that exceed maxInlineBytes', async () => {
    await fs.mkdir(path.join(workspace, 'src'), { recursive: true });
    await fs.mkdir(path.join(workspace, 'copybooks'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'src/BILLING.cob'), '12345');
    await fs.writeFile(path.join(workspace, 'copybooks/CUSTOMER.cpy'), '67890');

    await expect(
      buildOpenCodePrompt(makeInput({ mode: 'inline-content', maxInlineBytes: 9 })),
    ).rejects.toMatchObject({
      code: 'INLINE_CONTENT_TOO_LARGE',
    });
  });

  it('uses a longer code fence when source contains backticks', async () => {
    await fs.mkdir(path.join(workspace, 'src'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'src/BILLING.cob'), 'DISPLAY "```".\n');

    const bundle = makeBundle({ contextFiles: [] });
    const result = await buildOpenCodePrompt(makeInput({ bundle, mode: 'inline-content' }));

    expect(result.prompt).toContain('````cobol');
    expect(result.prompt).toContain('DISPLAY "```".');
  });

  it('reports missing inline files as prompt errors', async () => {
    await expect(buildOpenCodePrompt(makeInput({ mode: 'inline-content' }))).rejects.toBeInstanceOf(
      OpenCodePromptError,
    );
    await expect(buildOpenCodePrompt(makeInput({ mode: 'inline-content' }))).rejects.toMatchObject({
      code: 'MISSING_WORKSPACE_FILE',
    });
  });
});
