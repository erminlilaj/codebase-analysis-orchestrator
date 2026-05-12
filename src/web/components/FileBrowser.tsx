import React, { useEffect, useState } from 'react';
import * as api from '../api';
import { Button, Spinner } from './ui';

// Modal-style directory picker. Lists server filesystem via /api/fs/list.
export const FileBrowser: React.FC<{
  initialPath?: string;
  onSelect: (path: string) => void;
  onCancel: () => void;
}> = ({ initialPath, onSelect, onCancel }) => {
  const [path, setPath] = useState<string | null>(initialPath ?? null);
  const [data, setData] = useState<Awaited<ReturnType<typeof api.fsList>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        let target = path;
        if (!target) {
          const home = await api.fsHome();
          target = home.path;
        }
        const next = await api.fsList(target);
        if (cancelled) return;
        setData(next);
        setPath(next.path);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [path]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="px-5 py-3 border-b border-slate-200">
          <div className="text-sm font-medium text-slate-700 mb-1">Browse server filesystem</div>
          <div className="font-mono text-xs text-slate-600 truncate">{data?.path ?? path ?? '…'}</div>
        </div>

        <div className="flex-1 overflow-auto px-2 py-2 min-h-[200px]">
          {error ? (
            <div className="m-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>
          ) : loading ? (
            <div className="flex items-center justify-center py-8 text-slate-500"><Spinner /></div>
          ) : !data ? null : (
            <ul className="text-sm">
              {data.parent ? (
                <li>
                  <button
                    className="w-full text-left px-3 py-1.5 rounded hover:bg-slate-100 flex items-center gap-2"
                    onClick={() => setPath(data.parent)}
                  >
                    <span className="text-slate-400">↑</span>
                    <span className="text-slate-600">.. (parent)</span>
                  </button>
                </li>
              ) : null}
              {data.entries.length === 0 ? (
                <li className="px-3 py-2 text-slate-500">empty</li>
              ) : (
                data.entries.map((e) => (
                  <li key={e.path}>
                    <button
                      className="w-full text-left px-3 py-1.5 rounded hover:bg-slate-100 flex items-center gap-2 disabled:text-slate-400"
                      disabled={!e.isDirectory}
                      onClick={() => e.isDirectory && setPath(e.path)}
                    >
                      <span className={e.isDirectory ? 'text-amber-600' : 'text-slate-400'}>
                        {e.isDirectory ? '📁' : '📄'}
                      </span>
                      <span className={e.isDirectory ? 'font-medium' : 'text-slate-500'}>{e.name}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex justify-between items-center gap-3">
          <div className="text-xs text-slate-500">
            Click a folder to navigate. Use <strong>Select this folder</strong> when you're inside the target repo.
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button onClick={() => data?.path && onSelect(data.path)} disabled={!data?.path}>
              Select this folder
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
