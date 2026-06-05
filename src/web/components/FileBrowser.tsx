import React, { useEffect, useRef, useState } from 'react';
import * as api from '../api';
import { Button, Spinner } from './ui';

// Splits a posix path into clickable breadcrumb segments.
// "/" → [{ label: "/", path: "/" }]
// "/foo/bar" → [{ label: "/", path: "/" }, { label: "foo", path: "/foo" }, { label: "bar", path: "/foo/bar" }]
function breadcrumbs(p: string): { label: string; path: string }[] {
  const parts = p.split('/').filter(Boolean);
  const crumbs = [{ label: '/', path: '/' }];
  for (let i = 0; i < parts.length; i++) {
    crumbs.push({ label: parts[i], path: '/' + parts.slice(0, i + 1).join('/') });
  }
  return crumbs;
}

function isWindowsPath(p: string): boolean {
  return /^[A-Za-z]:[/\\]/.test(p);
}

export const FileBrowser: React.FC<{
  initialPath?: string;
  onSelect: (path: string) => void;
  onCancel: () => void;
}> = ({ initialPath, onSelect, onCancel }) => {
  const [path, setPath] = useState<string | null>(initialPath ?? null);
  const [inputValue, setInputValue] = useState('');
  const [data, setData] = useState<Awaited<ReturnType<typeof api.fsList>> | null>(null);
  const [roots, setRoots] = useState<{ label: string; path: string }[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load quick-access roots once.
  useEffect(() => {
    api.fsRoots().then(setRoots).catch(() => {});
  }, []);

  // Navigate whenever path or showHidden changes.
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
        const next = await api.fsList(target, showHidden);
        if (cancelled) return;
        setData(next);
        setPath(next.path);
        setInputValue(next.path);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [path, showHidden]);

  const navigateTo = (p: string) => {
    setError(null);
    setPath(p);
  };

  const commitInput = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (isWindowsPath(trimmed)) {
      setError(
        `Windows paths like "${trimmed}" don't work inside the container. ` +
        `Mount your folder in docker-compose and use the container path (e.g. /repositories/my-repo).`,
      );
      return;
    }
    navigateTo(trimmed);
  };

  const crumbs = data ? breadcrumbs(data.path) : [];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 space-y-2">
          <div className="text-sm font-medium text-slate-700">Browse server filesystem</div>

          {/* Editable path bar */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              className="flex-1 font-mono text-xs border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitInput(); }}
              placeholder="/path/to/directory"
              spellCheck={false}
            />
            <Button size="sm" variant="secondary" onClick={commitInput}>Go</Button>
          </div>

          {/* Breadcrumbs */}
          {crumbs.length > 0 && (
            <div className="flex items-center flex-wrap gap-0.5 text-xs text-slate-500">
              {crumbs.map((c, i) => (
                <React.Fragment key={c.path}>
                  {i > 0 && <span className="text-slate-300 mx-0.5">/</span>}
                  <button
                    className="hover:text-violet-700 hover:underline px-0.5 rounded"
                    onClick={() => navigateTo(c.path)}
                  >
                    {c.label}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Body: sidebar + listing */}
        <div className="flex flex-1 min-h-0">

          {/* Quick-access sidebar */}
          {roots.length > 0 && (
            <div className="w-40 shrink-0 border-r border-slate-100 py-2 flex flex-col gap-0.5 overflow-y-auto">
              <div className="px-3 pb-1 text-xs font-medium text-slate-400 uppercase tracking-wide">Quick access</div>
              {roots.map((r) => (
                <button
                  key={r.path}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded mx-1 hover:bg-slate-100 truncate ${
                    data?.path === r.path ? 'bg-violet-50 text-violet-700 font-medium' : 'text-slate-600'
                  }`}
                  style={{ width: 'calc(100% - 8px)' }}
                  onClick={() => navigateTo(r.path)}
                  title={r.path}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          {/* File listing */}
          <div className="flex-1 overflow-auto px-2 py-2 min-h-[220px]">
            {error ? (
              <div className="m-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3 whitespace-pre-wrap">{error}</div>
            ) : loading ? (
              <div className="flex items-center justify-center py-8 text-slate-500"><Spinner /></div>
            ) : !data ? null : (
              <ul className="text-sm">
                {data.parent ? (
                  <li>
                    <button
                      className="w-full text-left px-3 py-1.5 rounded hover:bg-slate-100 flex items-center gap-2"
                      onClick={() => navigateTo(data.parent!)}
                    >
                      <span className="text-slate-400 text-base">↑</span>
                      <span className="text-slate-500 text-xs">.. parent folder</span>
                    </button>
                  </li>
                ) : null}

                {data.entries.length === 0 ? (
                  <li className="px-3 py-4 text-slate-400 text-sm text-center">
                    {showHidden ? 'Empty directory' : 'Empty (or only hidden files — toggle "Show hidden")'}
                  </li>
                ) : (
                  data.entries.map((e) => (
                    <li key={e.path}>
                      <button
                        className="w-full text-left px-3 py-1.5 rounded hover:bg-slate-100 flex items-center gap-2 disabled:opacity-40 disabled:cursor-default"
                        disabled={!e.isDirectory}
                        onClick={() => e.isDirectory && navigateTo(e.path)}
                      >
                        <span className={`text-base ${e.isDirectory ? 'text-amber-500' : 'text-slate-300'}`}>
                          {e.isDirectory ? '📁' : '📄'}
                        </span>
                        <span className={e.isDirectory ? 'font-medium text-slate-700' : 'text-slate-400 text-xs'}>
                          {e.name}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 flex justify-between items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
            />
            Show hidden
          </label>
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
