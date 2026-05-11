import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { WorkspaceBuilder } from './WorkspaceBuilder';
import type { AnalysisBundle, SourceFile } from '../languages/common/types';

let tmpRoot: string;
let sourceRoot: string;

beforeEach(async () => {
  [tmpRoot, sourceRoot] = await Promise.all([
    fs.mkdtemp(path.join(os.tmpdir(), 'ws-builder-')),
    fs.mkdtemp(path.join(os.tmpdir(), 'ws-source-')),
  ]);
});

afterEach(async () => {
  await Promise.all([
    fs.rm(tmpRoot, { recursive: true, force: true }),
    fs.rm(sourceRoot, { recursive: true, force: true }),
  ]);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeSourceFile(relativePath: string, content = 'data'): Promise<SourceFile> {
  const absPath = path.join(sourceRoot, relativePath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, content, 'utf-8');
  return {
    id: relativePath,
    projectId: 'p1',
    path: absPath,
    relativePath,
    filename: path.basename(relativePath),
    extension: path.extname(relativePath),
    language: 'cobol',
    checksum: 'abc',
  };
}

function makeBundle(
  mainFile: SourceFile,
  contextFiles: SourceFile[] = [],
): AnalysisBundle {
  return { mainFile, contextFiles, unresolvedDependencies: [], metadata: {} };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkspaceBuilder.build', () => {
  it('returns the workspace path for the job', async () => {
    const main = await writeSourceFile('src/main.cob');
    const builder = new WorkspaceBuilder(tmpRoot);

    const wsPath = await builder.build('job-1', makeBundle(main));

    expect(wsPath).toBe(path.join(tmpRoot, 'job-1'));
  });

  it('copies the main file into the workspace preserving its relative path', async () => {
    const main = await writeSourceFile('src/main.cob', 'IDENTIFICATION DIVISION.');
    const builder = new WorkspaceBuilder(tmpRoot);

    const wsPath = await builder.build('job-1', makeBundle(main));

    const content = await fs.readFile(path.join(wsPath, 'src/main.cob'), 'utf-8');
    expect(content).toBe('IDENTIFICATION DIVISION.');
  });

  it('copies context files preserving their relative paths', async () => {
    const main = await writeSourceFile('src/main.cob', 'main');
    const ctx = await writeSourceFile('copybooks/CUSTOMER.cpy', 'copybook data');
    const builder = new WorkspaceBuilder(tmpRoot);

    const wsPath = await builder.build('job-1', makeBundle(main, [ctx]));

    const content = await fs.readFile(path.join(wsPath, 'copybooks/CUSTOMER.cpy'), 'utf-8');
    expect(content).toBe('copybook data');
  });

  it('creates nested subdirectories as needed', async () => {
    const main = await writeSourceFile('a/b/c/deep.cob', 'deep');
    const builder = new WorkspaceBuilder(tmpRoot);

    const wsPath = await builder.build('job-2', makeBundle(main));

    const content = await fs.readFile(path.join(wsPath, 'a/b/c/deep.cob'), 'utf-8');
    expect(content).toBe('deep');
  });

  it('does not place any files from outside the bundle in the workspace', async () => {
    const main = await writeSourceFile('src/main.cob');
    await writeSourceFile('src/other.cob', 'should not be copied');
    const builder = new WorkspaceBuilder(tmpRoot);

    const wsPath = await builder.build('job-1', makeBundle(main));

    const entries = await fs.readdir(path.join(wsPath, 'src'));
    expect(entries).toEqual(['main.cob']);
  });

  it('isolates each job under its own subdirectory', async () => {
    const main = await writeSourceFile('src/main.cob');
    const builder = new WorkspaceBuilder(tmpRoot);

    await builder.build('job-a', makeBundle(main));
    await builder.build('job-b', makeBundle(main));

    const wsA = path.join(tmpRoot, 'job-a');
    const wsB = path.join(tmpRoot, 'job-b');
    await expect(fs.access(wsA)).resolves.toBeUndefined();
    await expect(fs.access(wsB)).resolves.toBeUndefined();
  });

  it('throws when the source file does not exist', async () => {
    const missing: SourceFile = {
      id: 'missing',
      projectId: 'p1',
      path: path.join(sourceRoot, 'nonexistent.cob'),
      relativePath: 'nonexistent.cob',
      filename: 'nonexistent.cob',
      extension: '.cob',
      language: 'cobol',
      checksum: '',
    };
    const builder = new WorkspaceBuilder(tmpRoot);
    await expect(builder.build('job-1', makeBundle(missing))).rejects.toThrow();
  });
});

describe('WorkspaceBuilder.cleanup', () => {
  it('removes the workspace directory', async () => {
    const main = await writeSourceFile('src/main.cob');
    const builder = new WorkspaceBuilder(tmpRoot);

    await builder.build('job-1', makeBundle(main));
    await builder.cleanup('job-1');

    await expect(fs.access(path.join(tmpRoot, 'job-1'))).rejects.toThrow();
  });

  it('is idempotent — does not throw if workspace does not exist', async () => {
    const builder = new WorkspaceBuilder(tmpRoot);
    await expect(builder.cleanup('nonexistent-job')).resolves.toBeUndefined();
  });

  it('does not remove sibling workspaces', async () => {
    const main = await writeSourceFile('src/main.cob');
    const builder = new WorkspaceBuilder(tmpRoot);

    await builder.build('job-keep', makeBundle(main));
    await builder.build('job-remove', makeBundle(main));
    await builder.cleanup('job-remove');

    await expect(fs.access(path.join(tmpRoot, 'job-keep'))).resolves.toBeUndefined();
  });
});
