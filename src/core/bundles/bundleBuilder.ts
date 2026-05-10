import { prisma } from '../../db/prisma';
import type { SourceFile } from '../../languages/common/types';
import type { ContextResolver } from '../../languages/common/ContextResolver';
import { selectResolver } from '../../languages/common/resolverRegistry';

/**
 * Resolves context for `file`, persists an AnalysisBundle + BundleFile rows,
 * and returns the new bundle's DB id.
 *
 * Pass `resolver` to override the default registry selection (useful in tests).
 */
export async function buildAndPersistBundle(
  projectId: string,
  file: SourceFile,
  allFiles: SourceFile[],
  resolver?: ContextResolver,
): Promise<string> {
  const r = resolver ?? selectResolver(file);
  const bundle = await r.resolve(file, allFiles);

  const dbBundle = await prisma.analysisBundle.create({
    data: {
      projectId,
      metadata: bundle.metadata as object,
      files: {
        create: [
          { fileId: bundle.mainFile.id, role: 'main' },
          ...bundle.contextFiles.map((f) => ({ fileId: f.id, role: 'context' })),
        ],
      },
    },
  });

  return dbBundle.id;
}
