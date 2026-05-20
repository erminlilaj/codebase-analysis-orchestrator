import EventEmitter from 'events';

export type WorkerLogEvent = {
  type: 'log';
  runId: string;
  level: 'info' | 'warn' | 'error';
  /** Structural tag — used by the UI to render different message categories distinctly. */
  tag?: 'file' | 'context' | 'unresolved' | 'question' | 'result';
  message: string;
  ts: number;
};

export type WorkerJobEvent = {
  type: 'job_update';
  runId: string;
  job: {
    id: string;
    status: string;
    attempts: number;
    lastError: string | null;
    failureKind: string | null;
  };
};

export type WorkerAnswerEvent = {
  type: 'answer_new';
  runId: string;
  answer: {
    id: string;
    jobId: string;
    rawOutput: string;
    parsed: unknown;
    modelId: string | null;
    tokensUsed: number | null;
    createdAt: string;
  };
};

export type WorkerRunEvent = {
  type: 'run_update';
  runId: string;
  status: string;
  finishedAt: string | null;
};

export type WorkerEvent = WorkerLogEvent | WorkerJobEvent | WorkerAnswerEvent | WorkerRunEvent;

// In-process bridge between WorkerLoop and SSE clients.
// The worker emits events here; SSE route handlers subscribe and forward.
export const eventBus = new EventEmitter();
eventBus.setMaxListeners(200);
