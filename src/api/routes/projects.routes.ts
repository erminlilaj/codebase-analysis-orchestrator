import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma';
import { scanDirectory } from '../../core/files/FileScanner';
import { generateJobs } from '../../core/jobs/jobGenerator';
import { getQuestionsForLanguage } from '../../core/questions/questionService';

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => {
    return prisma.project.findMany({ orderBy: { createdAt: 'desc' } });
  });

  app.post<{ Body: { name: string; repoPath: string; language?: string } }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name', 'repoPath'],
          properties: {
            name: { type: 'string' },
            repoPath: { type: 'string' },
            language: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const { name, repoPath, language = 'unknown' } = req.body;
      const project = await prisma.project.create({ data: { name, repoPath, language } });
      reply.code(201);
      return project;
    },
  );

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    return project;
  });

  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    await prisma.project.delete({ where: { id: req.params.id } });
    reply.code(204);
  });

  // Walk repoPath, upsert SourceFile records, update project language.
  app.post<{ Params: { id: string } }>('/:id/scan', async (req, reply) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: 'Project not found' });

    const scanned = scanDirectory(project.repoPath);

    await prisma.sourceFile.createMany({
      data: scanned.map((f) => ({
        projectId: project.id,
        relativePath: f.relativePath,
        language: f.language ?? 'unknown',
        sizeBytes: f.sizeBytes ?? null,
      })),
      skipDuplicates: true,
    });

    if (scanned.length > 0) {
      const counts = new Map<string, number>();
      for (const f of scanned) {
        const lang = f.language ?? 'unknown';
        counts.set(lang, (counts.get(lang) ?? 0) + 1);
      }
      const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';
      await prisma.project.update({ where: { id: project.id }, data: { language: dominant } });
    }

    return { filesFound: scanned.length };
  });

  app.get<{ Params: { id: string } }>('/:id/runs', async (req, reply) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    return prisma.analysisRun.findMany({
      where: { projectId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.post<{
    Params: { id: string };
    Body: { providerId: string; questionIds?: string[]; priority?: number };
  }>(
    '/:id/runs',
    {
      schema: {
        body: {
          type: 'object',
          required: ['providerId'],
          properties: {
            providerId: { type: 'string' },
            questionIds: { type: 'array', items: { type: 'string' } },
            priority: { type: 'integer' },
          },
        },
      },
    },
    async (req, reply) => {
      const project = await prisma.project.findUnique({ where: { id: req.params.id } });
      if (!project) return reply.code(404).send({ error: 'Project not found' });

      const { providerId, questionIds, priority = 0 } = req.body;

      const qIds =
        questionIds ?? (await getQuestionsForLanguage(project.language)).map((q) => q.id);
      if (qIds.length === 0) {
        return reply
          .code(422)
          .send({ error: 'No questions available for this project language' });
      }

      const bundles = await prisma.analysisBundle.findMany({
        where: { projectId: project.id },
      });
      if (bundles.length === 0) {
        return reply.code(422).send({ error: 'No bundles found. Build bundles first.' });
      }

      const run = await prisma.analysisRun.create({
        data: { projectId: project.id, startedAt: new Date() },
      });

      const jobCount = await generateJobs({
        runId: run.id,
        bundleIds: bundles.map((b) => b.id),
        questionIds: qIds,
        providerId,
        priority,
      });

      reply.code(201);
      return { run, jobCount };
    },
  );
}
