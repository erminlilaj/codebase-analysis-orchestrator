import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma';

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>('/:id/exports', async (req, reply) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    return prisma.export.findMany({
      where: { projectId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
  });

  // Export generation is deferred to Phase 14.
  app.post<{ Params: { id: string } }>('/:id/exports', async (_req, reply) => {
    return reply.code(501).send({ error: 'Export generation not yet implemented (Phase 14)' });
  });
}
