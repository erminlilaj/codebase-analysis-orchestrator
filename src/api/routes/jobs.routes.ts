import type { FastifyInstance } from 'fastify';
import type { JobStatus } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { retryJobs } from '../../core/jobs/retryJobs';
import { eventBus, type WorkerLogEvent } from '../eventBus';

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

  app.get<{ Params: { runId: string } }>('/runs/:runId/stale-jobs', async (req, reply) => {
    const run = await prisma.analysisRun.findUnique({ where: { id: req.params.runId } });
    if (!run) return reply.code(404).send({ error: 'Run not found' });

    const jobs = await prisma.analysisJob.findMany({
      where: { runId: req.params.runId },
      include: { question: true },
      orderBy: { createdAt: 'asc' },
    });
    return jobs.filter((job) => job.questionVersion < job.question.version);
  });

  app.post<{ Params: { runId: string }; Body: { jobIds?: string[] } }>(
    '/runs/:runId/retry',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            jobIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (req, reply) => {
      const run = await prisma.analysisRun.findUnique({ where: { id: req.params.runId } });
      if (!run) return reply.code(404).send({ error: 'Run not found' });

      const failedJobs = await prisma.analysisJob.findMany({
        where: { runId: req.params.runId, status: 'failed' },
        select: { id: true },
      });
      const failedIds = new Set(failedJobs.map((j) => j.id));

      const requested = req.body?.jobIds;
      let targetIds: string[];
      if (requested && requested.length > 0) {
        const invalid = requested.filter((id) => !failedIds.has(id));
        if (invalid.length > 0) {
          return reply.code(400).send({
            error: 'Some job IDs are not failed jobs in this run',
            invalidJobIds: invalid,
          });
        }
        targetIds = requested;
      } else {
        targetIds = [...failedIds];
      }

      await retryJobs(req.params.runId, targetIds);

      return { retriedJobIds: targetIds, count: targetIds.length };
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

  app.get<{ Params: { runId: string } }>('/runs/:runId/stream', async (req, reply) => {
    const run = await prisma.analysisRun.findUnique({ where: { id: req.params.runId } });
    if (!run) return reply.code(404).send({ error: 'Run not found' });

    reply.hijack();
    const res = reply.raw;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);

    const listener = (event: WorkerLogEvent) => {
      if (event.runId === req.params.runId) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    };

    eventBus.on('worker', listener);
    await new Promise<void>((resolve) => req.raw.on('close', resolve));
    clearInterval(heartbeat);
    eventBus.off('worker', listener);
  });
}
