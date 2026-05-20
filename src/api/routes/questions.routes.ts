import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma';

export async function questionRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { language?: string } }>('/', async (req) => {
    return prisma.question.findMany({
      where: req.query.language ? { language: req.query.language } : undefined,
      orderBy: { createdAt: 'asc' },
    });
  });

  app.post<{ Body: { key: string; text: string; language?: string } }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['key', 'text'],
          properties: {
            key: { type: 'string', minLength: 1 },
            text: { type: 'string', minLength: 1 },
            language: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      const { key, text, language } = req.body;
      const question = await prisma.question.create({ data: { key: key.trim(), text: text.trim(), language } });
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
    Body: { key?: string; text?: string; language?: string | null };
  }>('/:id', async (req, reply) => {
    const question = await prisma.question.findUnique({ where: { id: req.params.id } });
    if (!question) return reply.code(404).send({ error: 'Question not found' });

    const { key, text, language } = req.body;

    if (key !== undefined && key.trim().length === 0)
      return reply.code(400).send({ error: 'key must not be empty' });
    if (text !== undefined && text.trim().length === 0)
      return reply.code(400).send({ error: 'text must not be empty' });

    const trimmed = {
      ...(key !== undefined ? { key: key.trim() } : {}),
      ...(text !== undefined ? { text: text.trim() } : {}),
      ...(language !== undefined ? { language } : {}),
    };
    const changed =
      (trimmed.key !== undefined && trimmed.key !== question.key) ||
      (trimmed.text !== undefined && trimmed.text !== question.text) ||
      (language !== undefined && language !== question.language);

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
