import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from './api';
import type { AnalysisRun, AnalysisJob, AnalysisAnswer } from './types';

export type LogEntry = { message: string; level: 'info' | 'warn' | 'error'; ts: number };

/** Fetch + auto-refresh, with loading & error state. */
export function useFetch<T>(
  fn: () => Promise<T>,
  deps: unknown[],
  options: { pollMs?: number; pollWhile?: (data: T) => boolean } = {},
): {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const lastFnRef = useRef(fn);
  lastFnRef.current = fn;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      try {
        const next = await lastFnRef.current();
        if (cancelled) return;
        setData(next);
        setError(null);
        if (options.pollMs && options.pollMs > 0) {
          if (!options.pollWhile || options.pollWhile(next)) {
            timer = setTimeout(run, options.pollMs);
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    void run();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, error, loading, refresh: () => setTick((t) => t + 1) };
}

/** Stream worker log events for a run via SSE. Pass enabled=false to skip connecting. */
export function useWorkerLogs(runId: string, enabled: boolean): LogEntry[] {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (!enabled) return;
    setLogs([]);
    const es = new EventSource(`/api/runs/${runId}/stream`);
    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as { type: string } & LogEntry;
        if (event.type === 'log') {
          setLogs((prev) => [...prev.slice(-499), { message: event.message, level: event.level, ts: event.ts }]);
        }
      } catch {
        // malformed event — ignore
      }
    };
    return () => es.close();
  }, [runId, enabled]);

  return logs;
}

// ---------------------------------------------------------------------------
// useRunData — initial REST load + single SSE connection for live updates
// ---------------------------------------------------------------------------

type RunDataState = {
  run: AnalysisRun | null;
  jobs: AnalysisJob[] | null;
  answers: AnalysisAnswer[] | null;
  logs: LogEntry[];
  error: string | null;
  refresh: () => void;
};

type SseJobUpdate = { type: 'job_update'; job: { id: string; status: string; attempts: number; lastError: string | null; failureKind: string | null } };
type SseAnswerNew = { type: 'answer_new'; answer: AnalysisAnswer };
type SseRunUpdate = { type: 'run_update'; status: string; finishedAt: string | null };
type SseLogEvent  = { type: 'log' } & LogEntry;
type SseEvent = SseJobUpdate | SseAnswerNew | SseRunUpdate | SseLogEvent;

/** Load run/jobs/answers once, then keep them live via SSE while the run is active. */
export function useRunData(runId: string): RunDataState {
  const [run, setRun]       = useState<AnalysisRun | null>(null);
  const [jobs, setJobs]     = useState<AnalysisJob[] | null>(null);
  const [answers, setAnswers] = useState<AnalysisAnswer[] | null>(null);
  const [logs, setLogs]     = useState<LogEntry[]>([]);
  const [error, setError]   = useState<string | null>(null);
  const [tick, setTick]     = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  // Initial load (re-runs on manual refresh)
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getRun(runId), api.listRunJobs(runId), api.listRunAnswers(runId)])
      .then(([r, j, a]) => {
        if (cancelled) return;
        setRun(r);
        setJobs(j);
        setAnswers(a);
        setError(null);
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [runId, tick]);

  // SSE — only while the run is active; a new connection opens if the run goes
  // from finished back to active (e.g. retry).
  const active = run?.status === 'pending' || run?.status === 'running';

  useEffect(() => {
    if (!active) return;
    setLogs([]);
    const es = new EventSource(`/api/runs/${runId}/stream`);
    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const evt = JSON.parse(e.data) as SseEvent;
        switch (evt.type) {
          case 'job_update':
            setJobs((prev) =>
              prev?.map((j) => (j.id === evt.job.id ? { ...j, ...evt.job } : j)) ?? prev,
            );
            break;
          case 'answer_new':
            setAnswers((prev) => (prev ? [...prev, evt.answer] : [evt.answer]));
            break;
          case 'run_update':
            setRun((prev) => (prev ? { ...prev, status: evt.status as AnalysisRun['status'], finishedAt: evt.finishedAt } : prev));
            break;
          case 'log':
            setLogs((prev) => [...prev.slice(-499), { message: evt.message, level: evt.level, ts: evt.ts }]);
            break;
        }
      } catch { /* malformed — ignore */ }
    };
    return () => es.close();
  }, [runId, active]);

  return { run, jobs, answers, logs, error, refresh };
}
