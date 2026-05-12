import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma';
import { runExport, type ExportFormat } from '../../core/exports/exportService';

const FORMATS: ExportFormat[] = ['json', 'csv', 'markdown'];

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>('/:id/exports', async (req, reply) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    return prisma.export.findMany({
      where: { projectId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.post<{
    Params: { id: string };
    Body: { format: ExportFormat; runId?: string };
  }>(
    '/:id/exports',
    {
      schema: {
        body: {
          type: 'object',
          required: ['format'],
          properties: {
            format: { type: 'string', enum: FORMATS },
            runId: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const project = await prisma.project.findUnique({ where: { id: req.params.id } });
      if (!project) return reply.code(404).send({ error: 'Project not found' });

      const exportRow = await runExport({
        projectId: project.id,
        format: req.body.format,
        runId: req.body.runId,
      });

      reply.code(201);
      return exportRow;
    },
  );
}
