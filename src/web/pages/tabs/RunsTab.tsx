import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '../../api';
import { useFetch } from '../../hooks';
import { PROVIDER_DEFS } from '../../providerDefs';
import type { Question } from '../../types';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Empty,
  ErrorMessage,
  Input,
  Select,
  Spinner,
  StatusBadge,
} from '../../components/ui';

const KNOWN_AGENTS = ['plan', 'build'] as const;

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
  const [modelSelect, setModelSelect] = useState('');
  const [modelCustom, setModelCustom] = useState('');
  const [agent, setAgent] = useState('');
  const providers = useFetch(() => api.listProviders(), []);
  const credentials = useFetch(() => api.listCredentials(), []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Models available based on which provider API keys are saved.
  const availableModels = useMemo(() => {
    const savedEnvVars = new Set((credentials.data ?? []).map((c) => c.envVar));
    return PROVIDER_DEFS.filter((p) => savedEnvVars.has(p.envVar)).flatMap((p) => p.models);
  }, [credentials.data]);

  useEffect(() => {
    if (!project) return;
    void api.listQuestions(project.language).then((qs) => {
      setQuestions(qs);
      setSelected(new Set(qs.map((q) => q.id)));
    });
  }, [project]);

  // Pre-select model/agent from server-configured OpenCode defaults.
  useEffect(() => {
    const details = providers.data?.opencode?.details;
    if (!details) return;
    if (typeof details.model === 'string' && details.model) {
      setModelSelect((cur) => {
        if (cur) return cur;
        return (availableModels as string[]).includes(details.model as string)
          ? (details.model as string)
          : '__custom__';
      });
      setModelCustom((cur) => cur || (details.model as string));
    }
    if (typeof details.agent === 'string' && details.agent) {
      setAgent((cur) => cur || (details.agent as string));
    }
  }, [providers.data, availableModels]);

  const isOpenCode = providerId.trim() === 'opencode';

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
        ...(isOpenCode
          ? {
              ...(() => {
                const effectiveModel = modelSelect === '__custom__' ? modelCustom.trim() : modelSelect;
                return effectiveModel ? { model: effectiveModel } : {};
              })(),
              ...(agent.trim() ? { agent: agent.trim() } : {}),
            }
          : {}),
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
          <Select
            className="w-full"
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
          >
            {providers.data ? (
              Object.values(providers.data).map((p) => (
                <option key={p.providerId} value={p.providerId} disabled={!p.available}>
                  {p.providerId}
                  {p.available ? '' : ' — unavailable'}
                </option>
              ))
            ) : (
              <option value={providerId}>{providerId}</option>
            )}
          </Select>
          {providers.data?.[providerId] && !providers.data[providerId].available ? (
            <p className="text-xs text-red-600 mt-1">
              {providers.data[providerId].reason ?? 'Provider unavailable'}
            </p>
          ) : null}
        </div>

        {isOpenCode ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Model</label>
              <Select
                className="w-full"
                value={modelSelect}
                onChange={(e) => setModelSelect(e.target.value)}
              >
                <option value="">(server default)</option>
                {availableModels.length === 0 ? (
                  <option disabled value="">— no API keys configured —</option>
                ) : (
                  availableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))
                )}
                <option value="__custom__">Custom…</option>
              </Select>
              {modelSelect === '__custom__' ? (
                <Input
                  className="mt-1"
                  value={modelCustom}
                  onChange={(e) => setModelCustom(e.target.value)}
                  placeholder="e.g. provider/model-name"
                />
              ) : null}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Agent</label>
              <Select
                className="w-full"
                value={agent}
                onChange={(e) => setAgent(e.target.value)}
              >
                <option value="">(server default)</option>
                {KNOWN_AGENTS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </Select>
            </div>
          </div>
        ) : null}
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
