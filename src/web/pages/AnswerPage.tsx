import React from 'react';
import { Link, useParams } from 'react-router-dom';
import * as api from '../api';
import { useFetch } from '../hooks';
import { Card, CardBody, CardHeader, ErrorMessage, Spinner, StatusBadge } from '../components/ui';

export const AnswerPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const job = useFetch(() => api.getJob(jobId!), [jobId]);
  const answer = useFetch(() => api.getAnswer(jobId!), [jobId]);

  if (job.error) return <ErrorMessage error={job.error} />;
  if (!job.data) return <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to={`/runs/${job.data.runId}`} className="hover:underline">Run</Link>
        <span>/</span>
        <span>Answer</span>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <StatusBadge status={job.data.status} />
            {job.data.question ? (
              <code className="bg-violet-100 text-violet-800 text-xs px-2 py-0.5 rounded">
                {job.data.question.key}
              </code>
            ) : null}
          </div>
          <div className="text-xs text-slate-400 font-mono">{job.data.id}</div>
        </CardHeader>
        <CardBody className="space-y-2">
          {job.data.question ? (
            <div className="text-sm text-slate-700">
              <strong>Question:</strong> {job.data.question.text}
            </div>
          ) : null}
          <div className="text-xs text-slate-500">
            provider: <code>{job.data.providerId}</code>
            {job.data.attempts > 0 ? <span className="ml-3">attempts: {job.data.attempts}</span> : null}
          </div>
          {job.data.lastError ? (
            <div className="mt-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded p-3">
              <strong>Last error:</strong> {job.data.lastError}
            </div>
          ) : null}
        </CardBody>
      </Card>

      {answer.error ? (
        <Card>
          <CardBody>
            <div className="text-sm text-slate-500">No answer stored for this job.</div>
          </CardBody>
        </Card>
      ) : !answer.data ? (
        <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading answer…</div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="font-medium text-sm">Raw output</div>
              <div className="text-xs text-slate-500">
                {answer.data.modelId ? <span>{answer.data.modelId} · </span> : null}
                {answer.data.tokensUsed != null ? <span>{answer.data.tokensUsed} tokens · </span> : null}
                <span>{new Date(answer.data.createdAt).toLocaleString()}</span>
              </div>
            </CardHeader>
            <CardBody>
              <pre className="font-mono text-sm whitespace-pre-wrap break-words bg-slate-50 rounded p-4 max-h-[60vh] overflow-auto">
                {answer.data.rawOutput}
              </pre>
            </CardBody>
          </Card>

          {answer.data.parsed && Object.keys(answer.data.parsed as object).length > 0 ? (
            <Card>
              <CardHeader>
                <div className="font-medium text-sm">Parsed JSON</div>
              </CardHeader>
              <CardBody>
                <pre className="font-mono text-xs bg-slate-50 rounded p-4 overflow-auto max-h-96">
                  {JSON.stringify(answer.data.parsed, null, 2)}
                </pre>
              </CardBody>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
};
