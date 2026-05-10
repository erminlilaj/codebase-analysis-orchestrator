import { describe, it, expect } from 'vitest';
import { resolveCopybooks } from './resolveCopybooks';
import type { SourceFile } from '../common/types';

const makeFile = (filename: string, ext: string): SourceFile => ({
  id: filename,
  projectId: 'p1',
  path: `/repo/copy/${filename}`,
  relativePath: `copy/${filename}`,
  filename,
  extension: ext,
  language: 'cobol',
  checksum: 'x',
});

describe('resolveCopybooks', () => {
  const allFiles: SourceFile[] = [
    makeFile('UTILS.cpy', '.cpy'),
    makeFile('HEADER-REC.cpy', '.cpy'),
    makeFile('MAIN.cbl', '.cbl'),
  ];

  it('resolves a matching copybook name', () => {
    const { resolved, unresolved } = resolveCopybooks(['UTILS'], allFiles);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].filename).toBe('UTILS.cpy');
    expect(unresolved).toHaveLength(0);
  });

  it('resolves matching names case-insensitively', () => {
    const { resolved } = resolveCopybooks(['utils'], allFiles);
    expect(resolved[0].filename).toBe('UTILS.cpy');
  });

  it('puts unmatched names in unresolved', () => {
    const { resolved, unresolved } = resolveCopybooks(['MISSING'], allFiles);
    expect(resolved).toHaveLength(0);
    expect(unresolved).toEqual(['MISSING']);
  });

  it('handles a mix of resolved and unresolved', () => {
    const { resolved, unresolved } = resolveCopybooks(
      ['UTILS', 'GONE', 'HEADER-REC'],
      allFiles,
    );
    expect(resolved.map((f) => f.filename)).toEqual(['UTILS.cpy', 'HEADER-REC.cpy']);
    expect(unresolved).toEqual(['GONE']);
  });

  it('returns empty arrays when names list is empty', () => {
    const { resolved, unresolved } = resolveCopybooks([], allFiles);
    expect(resolved).toHaveLength(0);
    expect(unresolved).toHaveLength(0);
  });
});
