import React, { useState } from 'react';
import * as api from '../api';
import { useFetch } from '../hooks';
import { PROVIDER_DEFS } from '../providerDefs';
import type { ProviderCredential } from '../types';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  Empty,
  ErrorMessage,
  Input,
  Spinner,
  useToast,
} from '../components/ui';

// ── ProviderRow ────────────────────────────────────────────────────────────

type ProviderRowProps = {
  name: string;
  envVar: string;
  credential: ProviderCredential | undefined;
  onSaved: () => void;
  onDeleted: () => void;
};

const ProviderRow: React.FC<ProviderRowProps> = ({ name, envVar, credential, onSaved, onDeleted }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();

  const save = async () => {
    if (!value.trim()) { setError('Value is required.'); return; }
    setSaving(true);
    try {
      await api.saveCredential(envVar, value.trim());
      setValue('');
      setEditing(false);
      setError(null);
      onSaved();
      toast.success(`${name} API key saved.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    try {
      await api.deleteCredential(envVar);
      onDeleted();
      toast.success(`${name} API key removed.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <ConfirmDialog
        open={confirmDelete}
        title={`Remove ${name} key`}
        message={`Delete "${envVar}"? The ${name} models will be unavailable until a new key is saved.`}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
      <li className="px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-medium text-sm w-28 shrink-0">{name}</span>
            <code className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded">{envVar}</code>
            {credential ? (
              <span className="font-mono text-xs text-slate-500">{credential.valuePreview}</span>
            ) : (
              <span className="text-xs text-slate-400 italic">not set</span>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            {credential ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => { setEditing((e) => !e); setError(null); }}>
                  {editing ? 'Cancel' : 'Update'}
                </Button>
                <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => { setEditing((e) => !e); setError(null); }}>
                {editing ? 'Cancel' : 'Add key'}
              </Button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="flex gap-2 items-end pl-31">
            <div className="flex-1">
              <ErrorMessage error={error} />
              <Input
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void save(); }}
                placeholder="sk-…"
                autoFocus
              />
            </div>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        ) : null}
      </li>
    </>
  );
};

// ── CustomKeyForm ──────────────────────────────────────────────────────────

const CustomKeyForm: React.FC<{ onSaved: () => void }> = ({ onSaved }) => {
  const [open, setOpen] = useState(false);
  const [envVar, setEnvVar] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const save = async () => {
    if (!envVar.trim() || !value.trim()) {
      setError('Both the variable name and value are required.');
      return;
    }
    setSaving(true);
    try {
      await api.saveCredential(envVar.trim().toUpperCase(), value.trim());
      setEnvVar('');
      setValue('');
      setOpen(false);
      setError(null);
      onSaved();
      toast.success('Custom key saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        className="text-xs text-violet-700 hover:underline mt-1"
        onClick={() => setOpen(true)}
      >
        + Add custom key
      </button>
    );
  }

  return (
    <div className="space-y-2 mt-2 p-3 border border-dashed border-slate-300 rounded-md">
      <p className="text-xs text-slate-500">Use this for any env var not listed above.</p>
      <ErrorMessage error={error} />
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Variable</label>
          <Input
            value={envVar}
            onChange={(e) => setEnvVar(e.target.value)}
            placeholder="MY_CUSTOM_API_KEY"
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
        <div className="flex gap-1">
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="secondary" onClick={() => { setOpen(false); setError(null); }}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── SettingsPage ───────────────────────────────────────────────────────────

export const SettingsPage: React.FC = () => {
  const creds = useFetch(() => api.listCredentials(), []);

  const credMap = new Map<string, ProviderCredential>(
    (creds.data ?? []).map((c) => [c.envVar, c]),
  );

  const knownEnvVars = new Set(PROVIDER_DEFS.map((p) => p.envVar));
  const customCreds = (creds.data ?? []).filter((c) => !knownEnvVars.has(c.envVar));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <div className="font-medium text-sm">Provider API keys</div>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-slate-600 mb-4">
            Keys are stored in the database and injected into the OpenCode subprocess at
            run time. Only providers with a key set will appear in the model picker.
          </p>

          {creds.loading && !creds.data ? (
            <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading…</div>
          ) : (
            <ul className="border border-slate-200 rounded-md divide-y divide-slate-100">
              {PROVIDER_DEFS.map((p) => (
                <ProviderRow
                  key={p.id}
                  name={p.name}
                  envVar={p.envVar}
                  credential={credMap.get(p.envVar)}
                  onSaved={creds.refresh}
                  onDeleted={creds.refresh}
                />
              ))}
              {customCreds.map((c) => (
                <li key={c.envVar} className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-slate-400 italic w-28 shrink-0">custom</span>
                    <code className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded">{c.envVar}</code>
                    <span className="font-mono text-xs text-slate-500">{c.valuePreview}</span>
                  </div>
                  <Button variant="danger" size="sm" onClick={async () => {
                    try { await api.deleteCredential(c.envVar); creds.refresh(); }
                    catch { /* ignore */ }
                  }}>
                    Delete
                  </Button>
                </li>
              ))}
              {!creds.data || creds.data.length === 0 ? (
                <li className="px-4 py-4">
                  <Empty title="No API keys set" hint="Add a key above to enable a provider." />
                </li>
              ) : null}
            </ul>
          )}

          <CustomKeyForm onSaved={creds.refresh} />
        </CardBody>
      </Card>
    </div>
  );
};
