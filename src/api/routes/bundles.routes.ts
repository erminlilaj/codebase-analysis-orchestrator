import path from 'path';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma';
import { buildAndPersistBundle } from '../../core/bundles/bundleBuilder';
import type { SourceFile } from '../../languages/common/types';

export async function bundleRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>('/:id/bundles', async (req, reply) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: 'Project not found' });

    return prisma.analysisBundle.findMany({
      where: { projectId: req.params.id },
      include: { files: { include: { file: true } } },
      orderBy: { createdAt: 'asc' },
    });
  });

  // Build one bundle per source file. Idempotent: skips if bundles already exist.
  app.post<{ Params: { id: string } }>('/:id/bundles', async (req, reply) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: 'Project not found' });

    const dbFiles = await prisma.sourceFile.findMany({ where: { projectId: project.id } });
    if (dbFiles.length === 0) {
      return reply.code(422).send({ error: 'No files found. Scan the project first.' });
    }

    const existing = await prisma.analysisBundle.count({ where: { projectId: project.id } });
    if (existing > 0) {
      return { bundlesCreated: 0, message: 'Bundles already exist for this project' };
    }

    const allFiles: SourceFile[] = dbFiles.map((f) => ({
      id: f.id,
      projectId: f.projectId,
      path: path.join(project.repoPath, f.relativePath),
      relativePath: f.relativePath,
      filename: path.basename(f.relativePath),
      extension: path.extname(f.relativePath),
      language: f.language,
      checksum: '',
      sizeBytes: f.sizeBytes ?? undefined,
    }));

    let bundlesCreated = 0;
    for (const file of allFiles) {
      await buildAndPersistBundle(project.id, file, allFiles);
      bundlesCreated++;
    }

    reply.code(201);
    return { bundlesCreated };
  });
}
