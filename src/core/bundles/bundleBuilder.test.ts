import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/prisma', () => ({
  prisma: {
    analysisBundle: {
      create: vi.fn(),
    },
  },
}));

import { buildAndPersistBundle } from './bundleBuilder';
import { prisma } from '../../db/prisma';
import { GenericResolver } from '../../languages/generic/GenericResolver';
import type { SourceFile } from '../../languages/common/types';

const mockCreate = vi.mocked(prisma.analysisBundle.create);

const makeFile = (id: string, ext = '.xyz'): SourceFile => ({
  id,
  projectId: 'p1',
  path: `/repo/file${ext}`,
  relativePath: `file${ext}`,
  filename: `file${ext}`,
  extension: ext,
  language: 'generic',
  checksum: 'abc',
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildAndPersistBundle', () => {
  it('calls prisma.analysisBundle.create with main file and returns bundle id', async () => {
    mockCreate.mockResolvedValue({ id: 'bundle-1' } as any);

    const file = makeFile('file-1');
    const id = await buildAndPersistBundle('project-1', file, [file], new GenericResolver());

    expect(id).toBe('bundle-1');
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'project-1',
        files: {
          create: [{ fileId: 'file-1', role: 'main' }],
        },
      }),
    });
  });

  it('includes context files in the create payload', async () => {
    mockCreate.mockResolvedValue({ id: 'bundle-2' } as any);

    const main = makeFile('main-1', '.cob');
    const ctx = makeFile('ctx-1', '.cpy');

    // Use a resolver that returns ctx as a context file
    const mockResolver = {
      language: 'cobol',
      supports: () => true,
      resolve: async () => ({
        mainFile: main,
        contextFiles: [ctx],
        unresolvedDependencies: [],
        metadata: { resolver: 'cobol' },
      }),
    };

    await buildAndPersistBundle('project-1', main, [main, ctx], mockResolver);

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        files: {
          create: [
            { fileId: 'main-1', role: 'main' },
            { fileId: 'ctx-1', role: 'context' },
          ],
        },
      }),
    });
  });
});
