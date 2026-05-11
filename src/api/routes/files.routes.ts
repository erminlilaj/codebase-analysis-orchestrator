import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma';

export async function fileRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string }; Querystring: { language?: string } }>(
    '/:id/files',
    async (req, reply) => {
      const project = await prisma.project.findUnique({ where: { id: req.params.id } });
      if (!project) return reply.code(404).send({ error: 'Project not found' });

      return prisma.sourceFile.findMany({
        where: {
          projectId: req.params.id,
          ...(req.query.language ? { language: req.query.language } : {}),
        },
        orderBy: { relativePath: 'asc' },
      });
    },
  );
}
