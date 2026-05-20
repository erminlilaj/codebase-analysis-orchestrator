import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as api from '../api';
import { answerSummary } from '../../core/answers/answerSummary';
import { useFetch } from '../hooks';
import type { AnalysisJob } from '../types';
import {
  Card,
  CardBody,
  CardHeader,
  Empty,
  ErrorMessage,
  ProgressBar,
  Spinner,
  StatusBadge,
} from '../components/ui';

export const RunPage: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const run = useFetch(() => api.getRun(runId!), [runId]);
  const jobs = useFetch(() => api.listRunJobs(runId!), [runId], {
    pollMs: 1500,
    pollWhile: (data) =>
      data.some((j) => j.status === 'pending' || j.status === 'claimed' || j.status === 'running'),
  });
  const answers = useFetch(() => api.listRunAnswers(runId!), [runId], {
    pollMs: 2000,
    pollWhile: () => true,
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const j of jobs.data ?? []) c[j.status] = (c[j.status] ?? 0) + 1;
    return c;
  }, [jobs.data]);

  const done = counts.completed ?? 0;
  const failed = counts.failed ?? 0;
  const total = jobs.data?.length ?? 0;
  const active = (counts.pending ?? 0) + (counts.claimed ?? 0) + (counts.running ?? 0);

  if (run.error) return <ErrorMessage error={run.error} />;
  if (!run.data) return <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading…</div>;

  const providerSettings = run.data.metadata?.providerSettings as
    | { model?: string; agent?: string }
    | undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to={`/projects/${run.data.projectId}/runs`} className="hover:underline">Runs</Link>
        <span>/</span>
        <span className="font-mono text-xs">{run.data.id}</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            Run
            <StatusBadge status={run.data.status} />
          </h1>
          <div className="text-xs text-slate-500 mt-1">
            <span>started: {run.data.startedAt ? new Date(run.data.startedAt).toLocaleString() : '—'}</span>
            <span className="ml-3">finished: {run.data.finishedAt ? new Date(run.data.finishedAt).toLocaleString() : '—'}</span>
          </div>
          {providerSettings && (providerSettings.model || providerSettings.agent) ? (
            <div className="text-xs text-slate-500 mt-0.5">
              {providerSettings.model ? (
                <span>model: <code className="text-xs">{providerSettings.model}</code></span>
              ) : null}
              {providerSettings.agent ? (
                <span className="ml-3">agent: <code className="text-xs">{providerSettings.agent}</code></span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="mb-3 flex justify-between items-center">
            <div className="text-sm font-medium">
              Progress {done + failed} / {total}
            </div>
            {active > 0 ? (
              <div className="flex items-center gap-2 text-xs text-amber-700">
                <Spinner className="text-amber-700" /> {active} in flight
              </div>
            ) : null}
          </div>
          <ProgressBar done={done} total={total} failed={failed} />
          <div className="flex gap-3 mt-3 text-xs">
            {Object.entries(counts).map(([s, n]) => (
              <span key={s} className="flex items-center gap-1.5">
                <StatusBadge status={s} />
                <span className="text-slate-600">{n}</span>
              </span>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="font-medium text-sm">Jobs ({jobs.data?.length ?? 0})</div>
        </CardHeader>
        {!jobs.data ? (
          <CardBody><Spinner /></CardBody>
        ) : jobs.data.length === 0 ? (
          <CardBody><Empty title="No jobs in this run" /></CardBody>
        ) : (
          <ul className="divide-y divide-slate-100 max-h-[50vh] overflow-auto">
            {jobs.data.map((j) => (
              <JobRow key={j.id} job={j} />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div className="font-medium text-sm">Recent answers ({answers.data?.length ?? 0})</div>
        </CardHeader>
        {!answers.data ? (
          <CardBody><Spinner /></CardBody>
        ) : answers.data.length === 0 ? (
          <CardBody><Empty title="No answers yet" hint="Waiting for jobs to complete." /></CardBody>
        ) : (
          <ul className="divide-y divide-slate-100 max-h-[50vh] overflow-auto">
            {answers.data.slice().reverse().slice(0, 20).map((a) => (
              <li key={a.id} className="px-5 py-3 hover:bg-slate-50">
                <Link to={`/jobs/${a.jobId}/answer`} className="block">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="bg-violet-100 text-violet-800 text-xs px-2 py-0.5 rounded">
                      {a.job?.question?.key ?? '—'}
                    </code>
                    {a.modelId ? (
                      <span className="text-xs text-slate-500">{a.modelId}</span>
                    ) : null}
                    {a.tokensUsed != null ? (
                      <span className="text-xs text-slate-500">{a.tokensUsed} tokens</span>
                    ) : null}
                    <span className="text-xs text-slate-400 ml-auto">
                      {new Date(a.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-sm text-slate-700 line-clamp-2">
                    {answerSummary(a.parsed, a.rawOutput)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

const JobRow: React.FC<{ job: AnalysisJob }> = ({ job }) => (
  <li className="px-5 py-2 hover:bg-slate-50 text-sm">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <StatusBadge status={job.status} />
        <code className="text-xs text-violet-700">{job.question?.key ?? '—'}</code>
        <span className="text-xs text-slate-400">{job.providerId}</span>
        <span className="text-xs text-slate-400 font-mono truncate">{job.id}</span>
      </div>
      <div className="flex gap-2 items-center text-xs text-slate-500 shrink-0">
        {job.attempts > 0 ? <span>attempts: {job.attempts}</span> : null}
        {job.failureKind ? (
          <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{job.failureKind}</span>
        ) : null}
        {job.answer ? (
          <Link to={`/jobs/${job.id}/answer`} className="text-violet-700 hover:underline">
            view answer
          </Link>
        ) : null}
      </div>
    </div>
    {job.lastError ? (
      <div className="mt-1 text-xs text-red-600 break-words">{job.lastError}</div>
    ) : null}
  </li>
);
