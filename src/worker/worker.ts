import { env } from '../config/env';
import { WorkerLoop } from './WorkerLoop';
import { WorkspaceBuilder } from './WorkspaceBuilder';
import type { AnalysisProvider } from '../providers/common/AnalysisProvider';

// ---------------------------------------------------------------------------
// Placeholder provider — replaced by Phase 12 Bob Shell adapter.
// ---------------------------------------------------------------------------
const placeholderProvider: AnalysisProvider = {
  id: 'placeholder',
  displayName: 'Placeholder (no provider configured)',
  async analyze(input) {
    throw new Error(
      `No provider configured for job ${input.jobId}. ` +
        'Configure a real provider in Phase 12.',
    );
  },
};

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const workspace = new WorkspaceBuilder(env.WORKSPACE_ROOT);

const worker = new WorkerLoop(placeholderProvider, workspace, {
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
