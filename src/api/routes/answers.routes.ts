import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma';

export async function answerRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>('/jobs/:id/answer', async (req, reply) => {
    const answer = await prisma.analysisAnswer.findUnique({
      where: { jobId: req.params.id },
    });
    if (!answer) return reply.code(404).send({ error: 'Answer not found' });
    return answer;
  });

  app.get<{ Params: { runId: string } }>('/runs/:runId/answers', async (req, reply) => {
    const run = await prisma.analysisRun.findUnique({ where: { id: req.params.runId } });
    if (!run) return reply.code(404).send({ error: 'Run not found' });

    return prisma.analysisAnswer.findMany({
      where: { job: { runId: req.params.runId } },
      include: { job: { include: { question: true } } },
      orderBy: { createdAt: 'asc' },
    });
  });
}
