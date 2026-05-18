import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '../../api';
import { useFetch } from '../../hooks';
import type { Question } from '../../types';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Empty,
  ErrorMessage,
  Input,
  Spinner,
  StatusBadge,
} from '../../components/ui';

export const RunsTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [params, setParams] = useSearchParams();
  const showNew = params.get('new') === '1';
  const runs = useFetch(() => api.listRuns(projectId), [projectId]);

  return (
    <div className="mt-4 space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-slate-600">
          Each run generates one job per <em>(bundle × question)</em>.
        </div>
        {!showNew ? (
          <Button size="sm" onClick={() => setParams({ new: '1' })}>+ New run</Button>
        ) : null}
      </div>

      {showNew ? (
        <NewRunForm
          projectId={projectId}
          onCancel={() => setParams({})}
          onCreated={() => { setParams({}); runs.refresh(); }}
        />
      ) : null}

      <ErrorMessage error={runs.error} />

      {runs.loading && !runs.data ? (
        <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading…</div>
      ) : !runs.data || runs.data.length === 0 ? (
        <Card><Empty title="No runs yet" hint="Click '+ New run' to start one." /></Card>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Started</th>
                <th className="text-left px-5 py-3">Finished</th>
                <th className="text-left px-5 py-3">Run ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.data.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-5 py-3 text-xs text-slate-600">
                    {r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600">
                    {r.finishedAt ? new Date(r.finishedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <Link to={`/runs/${r.id}`} className="text-violet-700 hover:underline font-mono text-xs">
                      {r.id}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};

const NewRunForm: React.FC<{
  projectId: string;
  onCancel: () => void;
  onCreated: () => void;
}> = ({ projectId, onCancel, onCreated }) => {
  const { data: project } = useFetch(() => api.getProject(projectId), [projectId]);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [providerId, setProviderId] = useState('stub');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    void api.listQuestions(project.language).then((qs) => {
      setQuestions(qs);
      setSelected(new Set(qs.map((q) => q.id)));
    });
  }, [project]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (selected.size === 0) {
      setError('Select at least one question.');
      return;
    }
    setSubmitting(true);
    try {
      await api.createRun(projectId, {
        providerId: providerId.trim(),
        questionIds: [...selected],
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader><div className="font-medium text-sm">New run</div></CardHeader>
      <CardBody className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Provider</label>
          <Input value={providerId} onChange={(e) => setProviderId(e.target.value)} placeholder="stub" />
          <p className="text-xs text-slate-500 mt-1">
            Known: <code className="text-xs">stub</code> (default), <code className="text-xs">bob</code>, <code className="text-xs">opencode</code>.
          </p>
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-medium text-slate-600">Questions</label>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set(questions?.map((q) => q.id) ?? []))}
              >
                Select all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          </div>
          {!questions ? (
            <Spinner />
          ) : questions.length === 0 ? (
            <div className="text-sm text-slate-500">
              No questions for <code>{project?.language}</code>. Go to the Questions tab to add some.
            </div>
          ) : (
            <ul className="border border-slate-200 rounded-md divide-y divide-slate-100 max-h-64 overflow-auto">
              {questions.map((q) => (
                <li key={q.id} className="px-3 py-2 flex items-center gap-3 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selected.has(q.id)}
                    onChange={() => toggle(q.id)}
                    className="rounded"
                  />
                  <code className="bg-violet-100 text-violet-800 text-xs px-2 py-0.5 rounded">{q.key}</code>
                  <span className="text-sm text-slate-700 truncate">{q.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <ErrorMessage error={error} />
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'Creating…' : `Create run (${selected.size} questions)`}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
};
