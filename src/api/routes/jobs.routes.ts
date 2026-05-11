import type { FastifyInstance } from 'fastify';
import type { JobStatus } from '@prisma/client';
import { prisma } from '../../db/prisma';

export async function jobRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { runId: string } }>('/runs/:runId', async (req, reply) => {
    const run = await prisma.analysisRun.findUnique({ where: { id: req.params.runId } });
    if (!run) return reply.code(404).send({ error: 'Run not found' });
    return run;
  });

  app.get<{ Params: { runId: string }; Querystring: { status?: string } }>(
    '/runs/:runId/jobs',
    async (req, reply) => {
      const run = await prisma.analysisRun.findUnique({ where: { id: req.params.runId } });
      if (!run) return reply.code(404).send({ error: 'Run not found' });

      return prisma.analysisJob.findMany({
        where: {
          runId: req.params.runId,
          ...(req.query.status ? { status: req.query.status as JobStatus } : {}),
        },
        include: { question: true },
        orderBy: { createdAt: 'asc' },
      });
    },
  );

  app.get<{ Params: { id: string } }>('/jobs/:id', async (req, reply) => {
    const job = await prisma.analysisJob.findUnique({
      where: { id: req.params.id },
      include: { question: true, answer: true },
    });
    if (!job) return reply.code(404).send({ error: 'Job not found' });
    return job;
  });
}
