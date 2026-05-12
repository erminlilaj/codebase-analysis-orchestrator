import React, { useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import * as api from '../api';
import { useFetch } from '../hooks';
import { Button, ErrorMessage, Spinner } from '../components/ui';
import { OverviewTab } from './tabs/OverviewTab';
import { FilesTab } from './tabs/FilesTab';
import { BundlesTab } from './tabs/BundlesTab';
import { QuestionsTab } from './tabs/QuestionsTab';
import { RunsTab } from './tabs/RunsTab';
import { ExportsTab } from './tabs/ExportsTab';

export const ProjectPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data: project, error, loading, refresh } = useFetch(
    () => api.getProject(id!),
    [id],
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [busyError, setBusyError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const action = async (label: string, fn: () => Promise<string>) => {
    setBusy(label);
    setBusyError(null);
    setLastResult(null);
    try {
      const result = await fn();
      setLastResult(result);
      refresh();
    } catch (err) {
      setBusyError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  if (loading && !project) {
    return <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading…</div>;
  }
  if (error || !project) {
    return <ErrorMessage error={error ?? 'Project not found'} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/projects" className="hover:underline">Projects</Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">{project.name}</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <div className="text-sm text-slate-500 mt-1 font-mono">{project.repoPath}</div>
          <div className="flex gap-2 mt-2 text-xs">
            <span className="inline-block bg-slate-100 text-slate-700 rounded px-2 py-0.5">
              language: <strong>{project.language}</strong>
            </span>
            <span className="inline-block bg-slate-100 text-slate-500 rounded px-2 py-0.5 font-mono">
              {project.id}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="secondary"
            disabled={!!busy}
            onClick={() => action('Scan', async () => {
              const r = await api.scanProject(project.id);
              return `Scanned ${r.filesFound} files.`;
            })}
          >
            {busy === 'Scan' ? '…' : 'Scan'}
          </Button>
          <Button
            variant="secondary"
            disabled={!!busy}
            onClick={() => action('Build bundles', async () => {
              const r = await api.buildBundles(project.id);
              return r.message ?? `Created ${r.bundlesCreated} bundles.`;
            })}
          >
            {busy === 'Build bundles' ? '…' : 'Build bundles'}
          </Button>
          <Button
            onClick={() => nav(`/projects/${project.id}/runs?new=1`)}
          >
            + New run
          </Button>
        </div>
      </div>

      {lastResult ? (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-md text-sm">
          {lastResult}
        </div>
      ) : null}
      <ErrorMessage error={busyError} />

      <div className="border-b border-slate-200 flex gap-1 text-sm">
        <Tab to={`/projects/${project.id}`} end>Overview</Tab>
        <Tab to={`/projects/${project.id}/files`}>Files</Tab>
        <Tab to={`/projects/${project.id}/bundles`}>Bundles</Tab>
        <Tab to={`/projects/${project.id}/questions`}>Questions</Tab>
        <Tab to={`/projects/${project.id}/runs`}>Runs</Tab>
        <Tab to={`/projects/${project.id}/exports`}>Exports</Tab>
      </div>

      <Routes>
        <Route index element={<OverviewTab project={project} />} />
        <Route path="files" element={<FilesTab projectId={project.id} />} />
        <Route path="bundles" element={<BundlesTab projectId={project.id} />} />
        <Route path="questions" element={<QuestionsTab language={project.language} />} />
        <Route path="runs" element={<RunsTab projectId={project.id} />} />
        <Route path="exports" element={<ExportsTab projectId={project.id} />} />
      </Routes>
    </div>
  );
};

const Tab: React.FC<{ to: string; children: React.ReactNode; end?: boolean }> = ({ to, children, end }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      `px-3 py-2 -mb-px border-b-2 transition ${
        isActive
          ? 'border-violet-500 text-violet-700 font-medium'
          : 'border-transparent text-slate-600 hover:text-slate-900'
      }`
    }
  >
    {children}
  </NavLink>
);
