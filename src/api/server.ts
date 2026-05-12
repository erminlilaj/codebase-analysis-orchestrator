import Fastify from 'fastify';
import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { projectRoutes } from './routes/projects.routes';
import { fileRoutes } from './routes/files.routes';
import { bundleRoutes } from './routes/bundles.routes';
import { questionRoutes } from './routes/questions.routes';
import { jobRoutes } from './routes/jobs.routes';
import { answerRoutes } from './routes/answers.routes';
import { exportRoutes } from './routes/exports.routes';

export function buildServer() {
  const app = Fastify({ logger: true });

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') return reply.code(404).send({ error: 'Record not found' });
      if (error.code === 'P2002') return reply.code(409).send({ error: 'Conflict: duplicate key' });
    }
    const statusCode = 'statusCode' in error ? (error as { statusCode: number }).statusCode : 500;
    app.log.error(error);
    return reply.code(statusCode).send({ error: error.message ?? 'Internal server error' });
  });

  app.register(projectRoutes, { prefix: '/projects' });
  app.register(fileRoutes, { prefix: '/projects' });
  app.register(bundleRoutes, { prefix: '/projects' });
  app.register(questionRoutes, { prefix: '/questions' });
  app.register(jobRoutes);
  app.register(answerRoutes);
  app.register(exportRoutes, { prefix: '/projects' });

  return app;
}

if (require.main === module) {
  const app = buildServer();
  app.listen({ port: env.PORT, host: '0.0.0.0' }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
