import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as api from '../api';
import { Card, CardHeader, CardBody, Button, Input, Select, ErrorMessage } from '../components/ui';
import { FileBrowser } from '../components/FileBrowser';

const LANGUAGES = ['cobol', 'java', 'typescript', 'javascript', 'python', 'cpp', 'c', 'go', 'rust', 'unknown'];

export const NewProjectPage: React.FC = () => {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [repoPath, setRepoPath] = useState('');
  const [language, setLanguage] = useState('cobol');
  const [browserOpen, setBrowserOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !repoPath.trim()) {
      setError('Name and repo path are required.');
      return;
    }
    setSubmitting(true);
    try {
      const p = await api.createProject({
        name: name.trim(),
        repoPath: repoPath.trim(),
        language: language.trim() || 'unknown',
      });
      nav(`/projects/${p.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/projects" className="hover:underline">Projects</Link>
        <span>/</span>
        <span>New</span>
      </div>

      <Card>
        <CardHeader>
          <div className="font-semibold">New project</div>
        </CardHeader>
        <CardBody>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-legacy-repo"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Primary language</label>
              <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                Used to pick the question set for runs. Overwritten by the dominant scanned language after scan.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Repository path on this server</label>
              <div className="flex gap-2">
                <Input
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                  placeholder="/absolute/path/to/repo"
                  className="font-mono text-xs"
                />
                <Button type="button" variant="secondary" onClick={() => setBrowserOpen(true)}>Browse…</Button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Absolute path on the machine where the API is running.
              </p>
            </div>

            <ErrorMessage error={error} />

            <div className="flex justify-end gap-2">
              <Link to="/projects">
                <Button type="button" variant="secondary">Cancel</Button>
              </Link>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create project'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {browserOpen ? (
        <FileBrowser
          initialPath={repoPath || undefined}
          onSelect={(p) => { setRepoPath(p); setBrowserOpen(false); }}
          onCancel={() => setBrowserOpen(false)}
        />
      ) : null}
    </div>
  );
};
