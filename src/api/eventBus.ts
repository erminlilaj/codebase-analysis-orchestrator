import EventEmitter from 'events';

export type WorkerLogEvent = {
  type: 'log';
  runId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  ts: number;
};

// In-process bridge between WorkerLoop and SSE clients.
// The worker emits events here; SSE route handlers subscribe and forward.
export const eventBus = new EventEmitter();
eventBus.setMaxListeners(200);
