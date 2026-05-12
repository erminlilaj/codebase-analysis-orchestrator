import React, { useMemo, useState } from 'react';
import * as api from '../../api';
import { useFetch } from '../../hooks';
import { Card, Empty, Input, Spinner, ErrorMessage } from '../../components/ui';

export const FilesTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { data: files, error, loading } = useFetch(() => api.listFiles(projectId), [projectId]);
  const [filter, setFilter] = useState('');

  const filtered = useMemo(
    () => files?.filter((f) => f.relativePath.toLowerCase().includes(filter.toLowerCase())) ?? [],
    [files, filter],
  );

  const languages = useMemo(() => {
    if (!files) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const f of files) m.set(f.language, (m.get(f.language) ?? 0) + 1);
    return m;
  }, [files]);

  return (
    <div className="mt-4 space-y-3">
      <ErrorMessage error={error} />

      {loading && !files ? (
        <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading…</div>
      ) : !files || files.length === 0 ? (
        <Card><Empty title="No files scanned yet" hint="Click 'Scan' in the project header." /></Card>
      ) : (
        <>
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div className="flex flex-wrap gap-2 text-xs">
              {[...languages.entries()].map(([lang, n]) => (
                <span key={lang} className="bg-slate-100 text-slate-700 rounded px-2 py-1">
                  {lang}: <strong>{n}</strong>
                </span>
              ))}
            </div>
            <div className="w-72">
              <Input
                placeholder="Filter by path…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          </div>

          <Card>
            <div className="text-xs text-slate-500 px-5 pt-3">
              Showing {filtered.length} of {files.length} files
            </div>
            <ul className="divide-y divide-slate-100 max-h-[60vh] overflow-auto">
              {filtered.map((f) => (
                <li key={f.id} className="px-5 py-2 flex items-center justify-between hover:bg-slate-50">
                  <div className="font-mono text-xs text-slate-700">{f.relativePath}</div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="bg-slate-100 rounded px-2 py-0.5">{f.language}</span>
                    {f.sizeBytes != null ? <span>{f.sizeBytes} B</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
};
