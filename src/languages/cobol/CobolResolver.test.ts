import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CobolResolver } from './CobolResolver';
import type { SourceFile } from '../common/types';

let tmpDir: string;
let mainFile: SourceFile;
let copybookFile: SourceFile;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cobol-resolver-test-'));

  fs.writeFileSync(
    path.join(tmpDir, 'MAIN.cbl'),
    [
      '       IDENTIFICATION DIVISION.',
      '       PROGRAM-ID. MAIN.',
      '       COPY UTILS.',
      '       COPY MISSING.',
    ].join('\n'),
  );

  fs.writeFileSync(path.join(tmpDir, 'UTILS.cpy'), '      * utility copybook');

  const makeFile = (filename: string, ext: string): SourceFile => ({
    id: filename,
    projectId: 'p1',
    path: path.join(tmpDir, filename),
    relativePath: filename,
    filename,
    extension: ext,
    language: 'cobol',
    checksum: 'x',
  });

  mainFile = makeFile('MAIN.cbl', '.cbl');
  copybookFile = makeFile('UTILS.cpy', '.cpy');
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('CobolResolver', () => {
  const resolver = new CobolResolver();

  it('has language "cobol"', () => {
    expect(resolver.language).toBe('cobol');
  });

  it('supports COBOL extensions', () => {
    const exts = ['.cob', '.cbl', '.cpy', '.copy', '.pco'];
    for (const ext of exts) {
      expect(resolver.supports({ ...mainFile, extension: ext })).toBe(true);
    }
  });

  it('does not support non-COBOL extensions', () => {
    expect(resolver.supports({ ...mainFile, extension: '.ts' })).toBe(false);
    expect(resolver.supports({ ...mainFile, extension: '.py' })).toBe(false);
  });

  it('resolves known copybooks as contextFiles', async () => {
    const bundle = await resolver.resolve(mainFile, [mainFile, copybookFile]);
    expect(bundle.contextFiles.map((f) => f.filename)).toContain('UTILS.cpy');
  });

  it('reports unknown copybooks as unresolvedDependencies', async () => {
    const bundle = await resolver.resolve(mainFile, [mainFile, copybookFile]);
    expect(bundle.unresolvedDependencies).toContain('MISSING');
  });

  it('sets resolver metadata', async () => {
    const bundle = await resolver.resolve(mainFile, [mainFile, copybookFile]);
    expect(bundle.metadata.resolver).toBe('cobol');
    expect(bundle.metadata.resolvedCount).toBe(1);
    expect(bundle.metadata.unresolvedCount).toBe(1);
  });
});
