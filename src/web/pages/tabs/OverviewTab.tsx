import React from 'react';
import * as api from '../../api';
import { useFetch } from '../../hooks';
import type { Project } from '../../types';
import { Card, CardBody, Spinner } from '../../components/ui';

export const OverviewTab: React.FC<{ project: Project }> = ({ project }) => {
  const files = useFetch(() => api.listFiles(project.id), [project.id]);
  const bundles = useFetch(() => api.listBundles(project.id), [project.id]);
  const runs = useFetch(() => api.listRuns(project.id), [project.id]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
      <StatCard label="Source files" value={files.data?.length ?? null} loading={files.loading} />
      <StatCard label="Bundles" value={bundles.data?.length ?? null} loading={bundles.loading} />
      <StatCard label="Runs" value={runs.data?.length ?? null} loading={runs.loading} />

      <Card className="md:col-span-3">
        <CardBody>
          <div className="text-sm text-slate-700 leading-relaxed space-y-1">
            <div><strong>How this works:</strong></div>
            <ol className="list-decimal list-inside space-y-0.5">
              <li><strong>Scan</strong> walks <code className="text-xs">repoPath</code> and creates one <em>source file</em> per file found.</li>
              <li><strong>Build bundles</strong> resolves language context (e.g. COBOL <code className="text-xs">COPY</code> → copybooks) into one bundle per file.</li>
              <li><strong>Questions</strong> tab manages what to ask about each file.</li>
              <li><strong>New run</strong> generates one job per (bundle × question), workers process them.</li>
              <li><strong>Exports</strong> stream answers to JSON / CSV / Markdown.</li>
            </ol>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number | null; loading: boolean }> = ({ label, value, loading }) => (
  <Card>
    <CardBody>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-3xl font-semibold mt-1">
        {loading ? <Spinner /> : value ?? '—'}
      </div>
    </CardBody>
  </Card>
);
