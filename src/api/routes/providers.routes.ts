import type { FastifyInstance } from 'fastify';
import { getProviderHealth, listProviderHealth } from '../../providers/providerRegistry';

export async function providerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => {
    return listProviderHealth();
  });

  app.get<{ Params: { id: string } }>('/:id/health', async (req, reply) => {
    const health = await getProviderHealth(req.params.id);
    if (!health) return reply.code(404).send({ error: 'Provider not found' });
    return health;
  });
}
