import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api';
import { useFetch } from '../hooks';
import { Card, Button, Spinner, Empty, ErrorMessage, ConfirmDialog, useToast } from '../components/ui';

export const ProjectsPage: React.FC = () => {
  const { data: projects, error, loading, refresh } = useFetch(() => api.listProjects(), []);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; name: string } | null>(null);
  const toast = useToast();

  const remove = async (id: string) => {
    setPending(null);
    setDeletingId(id);
    try {
      await api.deleteProject(id);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
    <ConfirmDialog
      open={!!pending}
      title="Delete project"
      message={`Delete "${pending?.name}" and all its data? This cannot be undone.`}
      onConfirm={() => pending && remove(pending.id)}
      onCancel={() => setPending(null)}
    />
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Link to="/projects/new">
          <Button>+ New project</Button>
        </Link>
      </div>

      <ErrorMessage error={error} />

      {loading && !projects ? (
        <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading…</div>
      ) : !projects || projects.length === 0 ? (
        <Card>
          <Empty
            title="No projects yet"
            hint="Click '+ New project' to register a source repository."
          />
        </Card>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Language</th>
                <th className="text-left px-5 py-3">Repo path</th>
                <th className="text-left px-5 py-3">Created</th>
                <th className="px-5 py-3 w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link to={`/projects/${p.id}`} className="font-medium text-violet-700 hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-block bg-slate-100 text-slate-700 text-xs rounded px-2 py-0.5">
                      {p.language}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-600 truncate max-w-md" title={p.repoPath}>
                    {p.repoPath}
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs">
                    {new Date(p.createdAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPending({ id: p.id, name: p.name })}
                      disabled={deletingId === p.id}
                    >
                      {deletingId === p.id ? '…' : 'Delete'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
    </>
  );
};
