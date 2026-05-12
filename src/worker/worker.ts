import { env } from '../config/env';
import { WorkerLoop } from './WorkerLoop';
import { WorkspaceBuilder } from './WorkspaceBuilder';
import type { AnalysisProvider } from '../providers/common/AnalysisProvider';
import { StubProvider } from '../providers/stub/StubProvider';

// Phase 12 will introduce the Bob Shell provider here. Until then, the stub
// provider lets the full pipeline run end-to-end against canned answers.
const provider: AnalysisProvider = new StubProvider();

const workspace = new WorkspaceBuilder(env.WORKSPACE_ROOT);

const worker = new WorkerLoop(provider, workspace, {
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
  `Worker starting [${provider.id}] (concurrency=${env.WORKER_CONCURRENCY}, pollInterval=${env.WORKER_POLL_INTERVAL_MS}ms)`,
);

worker.start().catch((err) => {
  console.error('Worker crashed:', err);
  process.exit(1);
});
