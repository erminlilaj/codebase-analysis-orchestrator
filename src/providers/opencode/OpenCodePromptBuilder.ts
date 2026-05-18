import fs from 'fs/promises';
import path from 'path';
import type { AnalysisBundle, SourceFile } from '../../languages/common/types';
import type { AnalysisQuestion } from '../common/AnalysisProvider';

export type OpenCodePromptFileMode = 'file-reference' | 'inline-content';

export type OpenCodePromptBuilderInput = {
  bundle: AnalysisBundle;
  question: AnalysisQuestion;
  mode: OpenCodePromptFileMode;
  maxInlineBytes: number;
  workspacePath?: string;
  expectedSchema?: unknown;
};

export type OpenCodePromptBuildResult = {
  prompt: string;
  mode: OpenCodePromptFileMode;
  referencedFiles: string[];
  inlineBytes: number;
};

export class OpenCodePromptError extends Error {
  constructor(
    message: string,
    readonly code: 'INLINE_CONTENT_TOO_LARGE' | 'MISSING_WORKSPACE_FILE' | 'INVALID_CONFIG',
  ) {
    super(message);
    this.name = 'OpenCodePromptError';
  }
}

const defaultExpectedSchema = {
  answer: 'string',
  confidence: 'high|medium|low',
  evidence: [
    {
      file: 'string',
      location: 'string',
      symbol: 'string|null',
      explanation: 'string',
    },
  ],
  unresolved: ['string'],
  missingContext: ['string'],
};

export async function buildOpenCodePrompt(
  input: OpenCodePromptBuilderInput,
): Promise<OpenCodePromptBuildResult> {
  validateInput(input);

  const files = [input.bundle.mainFile, ...input.bundle.contextFiles];
  const referencedFiles = files.map((file) => normalizeRelativePath(file.relativePath));
  const schema = input.expectedSchema ?? defaultExpectedSchema;

  const header = [
    'Analyze the source code files below and answer the requested question.',
    'This is a read-only batch analysis job. Do not edit files and do not run shell commands.',
    'Return only valid JSON matching the expected answer schema.',
    '',
    `Question key: ${input.question.key}`,
    `Question: ${input.question.text}`,
    `Main file: ${normalizeRelativePath(input.bundle.mainFile.relativePath)}`,
    `Language: ${input.bundle.mainFile.language ?? 'generic'}`,
    '',
    `Unresolved dependencies: ${stableStringify(input.bundle.unresolvedDependencies)}`,
    `Bundle metadata: ${stableStringify(input.bundle.metadata)}`,
    '',
    'Expected answer schema:',
    stableStringify(schema),
    '',
  ];

  if (input.mode === 'file-reference') {
    return {
      prompt: [...header, ...buildFileReferenceLines(input.bundle)].join('\n'),
      mode: input.mode,
      referencedFiles,
      inlineBytes: 0,
    };
  }

  const inline = await buildInlineContentSection(input, files);
  return {
    prompt: [...header, ...inline.lines].join('\n'),
    mode: input.mode,
    referencedFiles,
    inlineBytes: inline.bytes,
  };
}

function validateInput(input: OpenCodePromptBuilderInput): void {
  if (!Number.isInteger(input.maxInlineBytes) || input.maxInlineBytes <= 0) {
    throw new OpenCodePromptError('maxInlineBytes must be a positive integer', 'INVALID_CONFIG');
  }
}

function buildFileReferenceLines(bundle: AnalysisBundle): string[] {
  const lines = ['Files:'];
  lines.push(`Main file: @${normalizeRelativePath(bundle.mainFile.relativePath)}`);

  if (bundle.contextFiles.length === 0) {
    lines.push('Context files: []');
  } else {
    lines.push('Context files:');
    for (const file of bundle.contextFiles) {
      lines.push(`- @${normalizeRelativePath(file.relativePath)}`);
    }
  }

  return lines;
}

async function buildInlineContentSection(
  input: OpenCodePromptBuilderInput,
  files: SourceFile[],
): Promise<{ lines: string[]; bytes: number }> {
  const lines = ['Files:'];
  let totalBytes = 0;

  for (const file of files) {
    const role = file.id === input.bundle.mainFile.id ? 'Main file' : 'Context file';
    const content = await readFileContent(input.workspacePath, file);
    const contentBytes = Buffer.byteLength(content);
    totalBytes += contentBytes;

    if (totalBytes > input.maxInlineBytes) {
      throw new OpenCodePromptError(
        `Inline prompt content is ${totalBytes} bytes, exceeding maxInlineBytes=${input.maxInlineBytes}. Use file-reference mode for this job.`,
        'INLINE_CONTENT_TOO_LARGE',
      );
    }

    const fence = codeFenceFor(content);
    lines.push(`${role}: ${normalizeRelativePath(file.relativePath)}`);
    lines.push(`${fence}${file.language ?? 'text'}`);
    lines.push(content);
    lines.push(fence);
  }

  return { lines, bytes: totalBytes };
}

async function readFileContent(
  workspacePath: string | undefined,
  file: SourceFile,
): Promise<string> {
  const filePath = workspacePath
    ? path.join(workspacePath, file.relativePath)
    : file.path;

  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new OpenCodePromptError(
      `Unable to read ${normalizeRelativePath(file.relativePath)} for inline prompt content: ${message}`,
      'MISSING_WORKSPACE_FILE',
    );
  }
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').split(path.sep).join('/').replace(/^\/+/, '');
}

function codeFenceFor(content: string): string {
  const matches = content.match(/`+/g) ?? [];
  const longest = matches.reduce((max, run) => Math.max(max, run.length), 0);
  return '`'.repeat(Math.max(3, longest + 1));
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJson(value), null, 2);
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = sortJson((value as Record<string, unknown>)[key]);
      return acc;
    }, {});
}
