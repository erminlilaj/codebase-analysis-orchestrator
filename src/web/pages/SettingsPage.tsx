import React, { useState } from 'react';
import * as api from '../api';
import { useFetch } from '../hooks';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Empty,
  ErrorMessage,
  Input,
  Spinner,
} from '../components/ui';

export const SettingsPage: React.FC = () => {
  const creds = useFetch(() => api.listCredentials(), []);
  const [envVar, setEnvVar] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!envVar.trim() || !value.trim()) {
      setError('Both the variable name and value are required.');
      return;
    }
    setSaving(true);
    try {
      await api.saveCredential(envVar.trim(), value.trim());
      setEnvVar('');
      setValue('');
      setError(null);
      creds.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (name: string) => {
    if (!confirm(`Delete credential "${name}"?`)) return;
    try {
      await api.deleteCredential(name);
      creds.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <div className="font-medium text-sm">Provider API keys</div>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-slate-600">
            Stored in the database and injected as environment variables into the
            OpenCode process when a run executes. For DeepSeek, set{' '}
            <code className="text-xs bg-slate-100 px-1 rounded">DEEPSEEK_API_KEY</code>.
          </p>

          <ErrorMessage error={error} />

          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Variable</label>
              <Input
                value={envVar}
                onChange={(e) => setEnvVar(e.target.value)}
                placeholder="DEEPSEEK_API_KEY"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Value</label>
              <Input
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="sk-…"
              />
            </div>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>

          {creds.loading && !creds.data ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Spinner /> Loading…
            </div>
          ) : !creds.data || creds.data.length === 0 ? (
            <Empty title="No API keys set" hint="Add one above to enable a provider." />
          ) : (
            <ul className="border border-slate-200 rounded-md divide-y divide-slate-100">
              {creds.data.map((c) => (
                <li
                  key={c.envVar}
                  className="px-4 py-2 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <code className="bg-violet-100 text-violet-800 text-xs px-2 py-0.5 rounded">
                      {c.envVar}
                    </code>
                    <span className="font-mono text-sm text-slate-500">{c.valuePreview}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => remove(c.envVar)}>
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
