import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanDirectory } from './FileScanner';

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scanner-test-'));

  fs.writeFileSync(path.join(tmpDir, 'MAIN.cob'), 'IDENTIFICATION DIVISION.');
  fs.writeFileSync(path.join(tmpDir, 'helper.py'), 'print("hello")');
  fs.writeFileSync(path.join(tmpDir, 'README.md'), '# readme');

  // directory that should be skipped
  const gitDir = path.join(tmpDir, '.git');
  fs.mkdirSync(gitDir);
  fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main');

  // custom exclude dir
  const vendorDir = path.join(tmpDir, 'vendor');
  fs.mkdirSync(vendorDir);
  fs.writeFileSync(path.join(vendorDir, 'lib.c'), 'int main() {}');

  // nested source file
  const srcDir = path.join(tmpDir, 'src');
  fs.mkdirSync(srcDir);
  fs.writeFileSync(path.join(srcDir, 'util.ts'), 'export const x = 1;');
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('scanDirectory', () => {
  it('returns one entry per source file', () => {
    const files = scanDirectory(tmpDir);
    const relPaths = files.map((f) => f.relativePath).sort();
    expect(relPaths).toContain('MAIN.cob');
    expect(relPaths).toContain('helper.py');
    expect(relPaths).toContain('README.md');
    expect(relPaths).toContain(path.join('src', 'util.ts'));
  });

  it('skips .git by default', () => {
    const files = scanDirectory(tmpDir);
    const relPaths = files.map((f) => f.relativePath);
    expect(relPaths.every((p) => !p.startsWith('.git'))).toBe(true);
  });

  it('skips vendor by default', () => {
    const files = scanDirectory(tmpDir);
    const relPaths = files.map((f) => f.relativePath);
    expect(relPaths.every((p) => !p.startsWith('vendor'))).toBe(true);
  });

  it('respects additional excludeDirs option', () => {
    const files = scanDirectory(tmpDir, { excludeDirs: ['src'] });
    const relPaths = files.map((f) => f.relativePath);
    expect(relPaths.every((p) => !p.startsWith('src'))).toBe(true);
  });

  it('assigns correct language via LanguageDetector', () => {
    const files = scanDirectory(tmpDir);
    const cob = files.find((f) => f.filename === 'MAIN.cob');
    const py = files.find((f) => f.filename === 'helper.py');
    const ts = files.find((f) => f.filename === 'util.ts');
    expect(cob?.language).toBe('cobol');
    expect(py?.language).toBe('python');
    expect(ts?.language).toBe('typescript');
  });

  it('populates path, relativePath, filename, extension, sizeBytes, and checksum', () => {
    const files = scanDirectory(tmpDir);
    const cob = files.find((f) => f.filename === 'MAIN.cob')!;
    expect(cob.path).toBe(path.join(tmpDir, 'MAIN.cob'));
    expect(cob.relativePath).toBe('MAIN.cob');
    expect(cob.extension).toBe('.cob');
    expect(cob.sizeBytes).toBeGreaterThan(0);
    expect(cob.checksum).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });

  it('produces a stable checksum for unchanged files', () => {
    const first = scanDirectory(tmpDir);
    const second = scanDirectory(tmpDir);
    const c1 = first.find((f) => f.filename === 'MAIN.cob')!.checksum;
    const c2 = second.find((f) => f.filename === 'MAIN.cob')!.checksum;
    expect(c1).toBe(c2);
  });
});
