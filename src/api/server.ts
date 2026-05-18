import fs from 'fs';
import path from 'path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { projectRoutes } from './routes/projects.routes';
import { fileRoutes } from './routes/files.routes';
import { bundleRoutes } from './routes/bundles.routes';
import { questionRoutes } from './routes/questions.routes';
import { jobRoutes } from './routes/jobs.routes';
import { answerRoutes } from './routes/answers.routes';
import { exportRoutes } from './routes/exports.routes';
import { fsRoutes } from './routes/fs.routes';
import { providerRoutes } from './routes/providers.routes';
import { settingsRoutes } from './routes/settings.routes';

export function buildServer() {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') return reply.code(404).send({ error: 'Record not found' });
      if (error.code === 'P2002') return reply.code(409).send({ error: 'Conflict: duplicate key' });
    }
    const statusCode = 'statusCode' in error ? (error as { statusCode: number }).statusCode : 500;
    app.log.error(error);
    return reply.code(statusCode).send({ error: error.message ?? 'Internal server error' });
  });

  app.register(projectRoutes, { prefix: '/api/projects' });
  app.register(fileRoutes, { prefix: '/api/projects' });
  app.register(bundleRoutes, { prefix: '/api/projects' });
  app.register(questionRoutes, { prefix: '/api/questions' });
  app.register(jobRoutes, { prefix: '/api' });
  app.register(answerRoutes, { prefix: '/api' });
  app.register(exportRoutes, { prefix: '/api/projects' });
  app.register(fsRoutes, { prefix: '/api' });
  app.register(providerRoutes, { prefix: '/api/providers' });
  app.register(settingsRoutes, { prefix: '/api/settings' });

  // Serve the built web UI when it exists. In dev the user runs `npm run web`
  // which starts Vite on its own port and proxies /api/* back here.
  const webDist = path.resolve(__dirname, '../../dist/web');
  if (fs.existsSync(path.join(webDist, 'index.html'))) {
    app.register(fastifyStatic, {
      root: webDist,
      prefix: '/',
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}

if (require.main === module) {
  const app = buildServer();
  app.listen({ port: env.PORT, host: '0.0.0.0' }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
