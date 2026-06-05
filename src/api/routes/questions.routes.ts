import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma';

export async function questionRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { language?: string; projectId?: string } }>('/', async (req, reply) => {
    const { language, projectId } = req.query;
    if (projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return reply.code(404).send({ error: 'Project not found' });
      const effectiveLanguage = language ?? project.language;
      return prisma.question.findMany({
        where: {
          OR: [
            { projectId, },
            { projectId: null, language: effectiveLanguage },
            { projectId: null, language: null },
          ],
        },
        orderBy: { createdAt: 'asc' },
      });
    }

    return prisma.question.findMany({
      where: language
        ? { projectId: null, OR: [{ language }, { language: null }] }
        : { projectId: null },
      orderBy: { createdAt: 'asc' },
    });
  });

  app.post<{ Body: { key: string; text: string; language?: string | null; projectId?: string | null } }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['key', 'text'],
          properties: {
            key: { type: 'string', minLength: 1 },
            text: { type: 'string', minLength: 1 },
            language: { anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }] },
            projectId: { anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }] },
          },
        },
      },
    },
    async (req, reply) => {
      const { key, text, language, projectId } = req.body;
      if (projectId) {
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) return reply.code(404).send({ error: 'Project not found' });
      }
      const question = await prisma.question.create({
        data: {
          key: key.trim(),
          text: text.trim(),
          language: language ?? null,
          projectId: projectId ?? null,
        },
      });
      reply.code(201);
      return question;
    },
  );

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const question = await prisma.question.findUnique({ where: { id: req.params.id } });
    if (!question) return reply.code(404).send({ error: 'Question not found' });
    return question;
  });

  app.put<{
    Params: { id: string };
    Body: { key?: string; text?: string; language?: string | null; projectId?: string | null };
  }>('/:id', async (req, reply) => {
    const question = await prisma.question.findUnique({ where: { id: req.params.id } });
    if (!question) return reply.code(404).send({ error: 'Question not found' });

    const { key, text, language, projectId } = req.body;

    if (key !== undefined && key.trim().length === 0)
      return reply.code(400).send({ error: 'key must not be empty' });
    if (text !== undefined && text.trim().length === 0)
      return reply.code(400).send({ error: 'text must not be empty' });

    if (projectId !== undefined && projectId !== null) {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return reply.code(404).send({ error: 'Project not found' });
    }

    const trimmed = {
      ...(key !== undefined ? { key: key.trim() } : {}),
      ...(text !== undefined ? { text: text.trim() } : {}),
      ...(language !== undefined ? { language } : {}),
      ...(projectId !== undefined ? { projectId } : {}),
    };
    const changed =
      (trimmed.key !== undefined && trimmed.key !== question.key) ||
      (trimmed.text !== undefined && trimmed.text !== question.text) ||
      (language !== undefined && language !== question.language) ||
      (projectId !== undefined && projectId !== question.projectId);

    return prisma.question.update({
      where: { id: req.params.id },
      data: { ...trimmed, ...(changed ? { version: question.version + 1 } : {}) },
    });
  });

  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const question = await prisma.question.findUnique({ where: { id: req.params.id } });
    if (!question) return reply.code(404).send({ error: 'Question not found' });
    await prisma.question.delete({ where: { id: req.params.id } });
    reply.code(204);
  });
}
