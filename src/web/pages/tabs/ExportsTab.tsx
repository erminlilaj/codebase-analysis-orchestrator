import React, { useState } from 'react';
import * as api from '../../api';
import { useFetch } from '../../hooks';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Empty,
  ErrorMessage,
  Select,
  Spinner,
} from '../../components/ui';

export const ExportsTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const exports = useFetch(() => api.listExports(projectId), [projectId]);
  const runs = useFetch(() => api.listRuns(projectId), [projectId]);
  const [format, setFormat] = useState<'json' | 'csv' | 'markdown'>('markdown');
  const [runId, setRunId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPath, setLastPath] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setLastPath(null);
    try {
      const res = await api.createExport(projectId, {
        format,
        runId: runId || undefined,
      });
      setLastPath(res.filePath);
      exports.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader><div className="font-medium text-sm">Generate a new export</div></CardHeader>
        <CardBody className="space-y-3">
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Format</label>
              <Select value={format} onChange={(e) => setFormat(e.target.value as 'json' | 'csv' | 'markdown')}>
                <option value="markdown">Markdown</option>
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </Select>
            </div>
            <div className="min-w-[20rem]">
              <label className="block text-xs font-medium text-slate-600 mb-1">Run (optional)</label>
              <Select value={runId} onChange={(e) => setRunId(e.target.value)}>
                <option value="">All runs</option>
                {runs.data?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {new Date(r.startedAt ?? r.createdAt).toLocaleString()} — {r.status} — {r.id.slice(0, 8)}…
                  </option>
                ))}
              </Select>
            </div>
            <Button onClick={submit} disabled={busy}>
              {busy ? 'Generating…' : 'Generate export'}
            </Button>
          </div>
          <ErrorMessage error={error} />
          {lastPath ? (
            <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded p-3">
              Wrote: <code className="text-xs">{lastPath}</code>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><div className="font-medium text-sm">Past exports</div></CardHeader>
        {exports.loading && !exports.data ? (
          <CardBody><Spinner /></CardBody>
        ) : !exports.data || exports.data.length === 0 ? (
          <CardBody><Empty title="No exports yet" /></CardBody>
        ) : (
          <ul className="divide-y divide-slate-100">
            {exports.data.map((e) => (
              <li key={e.id} className="px-5 py-3 flex justify-between items-center text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-block bg-slate-100 text-slate-700 text-xs rounded px-2 py-0.5 uppercase">
                      {e.format}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(e.createdAt).toLocaleString()}
                    </span>
                    {e.sizeBytes != null ? (
                      <span className="text-xs text-slate-500">{e.sizeBytes} B</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-600 font-mono truncate">{e.filePath}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};
