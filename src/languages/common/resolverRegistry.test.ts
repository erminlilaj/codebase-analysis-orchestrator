import { describe, it, expect } from 'vitest';
import { selectResolver } from './resolverRegistry';
import type { SourceFile } from './types';

const makeFile = (extension: string): SourceFile => ({
  id: '1',
  projectId: 'p1',
  path: `/repo/file${extension}`,
  relativePath: `file${extension}`,
  filename: `file${extension}`,
  extension,
  language: 'generic',
  checksum: 'abc',
});

describe('selectResolver', () => {
  it('returns CobolResolver for COBOL extensions', () => {
    for (const ext of ['.cob', '.cbl', '.cpy', '.copy', '.pco']) {
      expect(selectResolver(makeFile(ext)).language).toBe('cobol');
    }
  });

  it('returns GenericResolver for unknown extensions', () => {
    expect(selectResolver(makeFile('.xyz')).language).toBe('generic');
    expect(selectResolver(makeFile('.ts')).language).toBe('generic');
  });

  it('always returns a resolver (never null)', () => {
    expect(selectResolver(makeFile('.whatever'))).toBeDefined();
  });
});
