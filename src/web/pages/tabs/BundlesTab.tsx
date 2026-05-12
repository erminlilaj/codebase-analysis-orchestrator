import React from 'react';
import * as api from '../../api';
import { useFetch } from '../../hooks';
import { Card, Empty, Spinner, ErrorMessage } from '../../components/ui';

export const BundlesTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { data: bundles, error, loading } = useFetch(() => api.listBundles(projectId), [projectId]);

  return (
    <div className="mt-4 space-y-3">
      <ErrorMessage error={error} />

      {loading && !bundles ? (
        <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading…</div>
      ) : !bundles || bundles.length === 0 ? (
        <Card><Empty title="No bundles yet" hint="Scan the project, then click 'Build bundles'." /></Card>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100 max-h-[60vh] overflow-auto">
            {bundles.map((b) => {
              const main = b.files?.find((bf) => bf.role === 'main');
              const ctx = b.files?.filter((bf) => bf.role === 'context') ?? [];
              const unresolved = ((b.metadata as Record<string, unknown>)?.unresolvedDependencies as string[] | undefined) ?? [];
              return (
                <li key={b.id} className="px-5 py-3">
                  <div className="flex items-baseline justify-between">
                    <div className="font-mono text-sm font-medium">
                      {main?.file.relativePath ?? '(no main file)'}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">{b.id}</div>
                  </div>
                  {ctx.length > 0 ? (
                    <div className="mt-1 text-xs text-slate-600">
                      <span className="font-medium text-slate-500">context: </span>
                      {ctx.map((c) => (
                        <span key={c.file.id} className="font-mono mr-2">{c.file.relativePath}</span>
                      ))}
                    </div>
                  ) : null}
                  {unresolved.length > 0 ? (
                    <div className="mt-1 text-xs text-amber-700">
                      <span className="font-medium">unresolved: </span>
                      {unresolved.map((u) => <span key={u} className="font-mono mr-2">{u}</span>)}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
};
