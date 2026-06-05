import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma';

const ENV_VAR_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function maskSecret(value: string): string {
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return value.length <= 4 ? '••••' : `••••${value.slice(-4)}`;
}

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/credentials', async () => {
    const rows = await prisma.providerCredential.findMany({ orderBy: { envVar: 'asc' } });
    return rows.map((r) => ({
      envVar: r.envVar,
      valuePreview: maskSecret(r.value),
      updatedAt: r.updatedAt,
    }));
  });

  app.put<{ Params: { envVar: string }; Body: { value: string } }>(
    '/credentials/:envVar',
    {
      schema: {
        body: {
          type: 'object',
          required: ['value'],
          properties: { value: { type: 'string' } },
        },
      },
    },
    async (req, reply) => {
      const { envVar } = req.params;
      if (!ENV_VAR_RE.test(envVar)) {
        return reply.code(400).send({ error: 'Invalid environment variable name' });
      }
      const value = req.body.value.trim();
      if (!value) {
        return reply.code(400).send({ error: 'Value must not be empty' });
      }
      const row = await prisma.providerCredential.upsert({
        where: { envVar },
        create: { envVar, value },
        update: { value },
      });
      return { envVar: row.envVar, valuePreview: maskSecret(row.value), updatedAt: row.updatedAt };
    },
  );

  app.delete<{ Params: { envVar: string } }>('/credentials/:envVar', async (req, reply) => {
    const existing = await prisma.providerCredential.findUnique({
      where: { envVar: req.params.envVar },
    });
    if (!existing) return reply.code(404).send({ error: 'Credential not found' });
    await prisma.providerCredential.delete({ where: { envVar: req.params.envVar } });
    reply.code(204);
  });
}
