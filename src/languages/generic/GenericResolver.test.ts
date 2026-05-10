import { describe, it, expect } from 'vitest';
import { GenericResolver } from './GenericResolver';
import type { SourceFile } from '../common/types';

const makeFile = (overrides: Partial<SourceFile> = {}): SourceFile => ({
  id: '1',
  projectId: 'p1',
  path: '/repo/main.xyz',
  relativePath: 'main.xyz',
  filename: 'main.xyz',
  extension: '.xyz',
  language: 'generic',
  checksum: 'abc',
  sizeBytes: 100,
  ...overrides,
});

describe('GenericResolver', () => {
  const resolver = new GenericResolver();

  it('has language "generic"', () => {
    expect(resolver.language).toBe('generic');
  });

  it('supports any file', () => {
    expect(resolver.supports(makeFile({ extension: '.xyz' }))).toBe(true);
    expect(resolver.supports(makeFile({ extension: '.cob' }))).toBe(true);
    expect(resolver.supports(makeFile({ extension: '.ts' }))).toBe(true);
  });

  it('returns a bundle with only the main file and no context', async () => {
    const file = makeFile();
    const bundle = await resolver.resolve(file, [file]);
    expect(bundle.mainFile).toBe(file);
    expect(bundle.contextFiles).toHaveLength(0);
    expect(bundle.unresolvedDependencies).toHaveLength(0);
  });

  it('includes fallback metadata', async () => {
    const bundle = await resolver.resolve(makeFile(), []);
    expect(bundle.metadata.resolver).toBe('generic');
    expect(bundle.metadata.fallback).toBe(true);
  });
});
