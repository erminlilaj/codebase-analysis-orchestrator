import { env } from '../config/env';
import { WorkerLoop } from './WorkerLoop';
import { WorkspaceBuilder } from './WorkspaceBuilder';
import { getProvider } from '../providers/providerRegistry';

const providers = { get: getProvider };

const workspace = new WorkspaceBuilder(env.WORKSPACE_ROOT);

const worker = new WorkerLoop(providers, workspace, {
  concurrency: env.WORKER_CONCURRENCY,
  pollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
  maxAttempts: env.JOB_MAX_ATTEMPTS,
  staleTimeoutSeconds: env.JOB_STALE_TIMEOUT_SECONDS,
});

const shutdown = () => {
  console.log('Shutting down worker...');
  worker.stop();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(
  `Worker starting (concurrency=${env.WORKER_CONCURRENCY}, pollInterval=${env.WORKER_POLL_INTERVAL_MS}ms)`,
);

worker.start().catch((err) => {
  console.error('Worker crashed:', err);
  process.exit(1);
});
