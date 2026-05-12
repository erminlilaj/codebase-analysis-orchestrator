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
  Textarea,
  Select,
} from '../components/ui';

// Global question catalog — shows all questions across languages.
const LANGUAGES = ['cobol', 'java', 'typescript', 'javascript', 'python', 'cpp', 'c', 'go', 'rust'];

export const QuestionsPage: React.FC = () => {
  const all = useFetch(() => api.listQuestions(), []);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftKey, setDraftKey] = useState('');
  const [draftText, setDraftText] = useState('');
  const [draftLang, setDraftLang] = useState<string>('cobol');

  const createNew = async () => {
    if (!draftKey.trim() || !draftText.trim()) {
      setError('key and text are required');
      return;
    }
    try {
      await api.createQuestion({
        key: draftKey.trim(),
        text: draftText.trim(),
        language: draftLang === 'universal' ? null : draftLang,
      });
      setCreating(false);
      setDraftKey('');
      setDraftText('');
      setError(null);
      all.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const remove = async (id: string, key: string) => {
    if (!confirm(`Delete question "${key}"?`)) return;
    try {
      await api.deleteQuestion(id);
      all.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Questions</h1>
        {!creating ? <Button onClick={() => setCreating(true)}>+ Add question</Button> : null}
      </div>

      <ErrorMessage error={error} />

      {creating ? (
        <Card>
          <CardHeader><div className="font-medium text-sm">New question</div></CardHeader>
          <CardBody className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Key</label>
              <Input value={draftKey} onChange={(e) => setDraftKey(e.target.value)} placeholder="purpose" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Language</label>
              <Select value={draftLang} onChange={(e) => setDraftLang(e.target.value)}>
                <option value="universal">universal (all languages)</option>
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Text</label>
              <Textarea rows={3} value={draftText} onChange={(e) => setDraftText(e.target.value)} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setCreating(false)}>Cancel</Button>
              <Button onClick={createNew}>Create</Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {all.loading && !all.data ? (
        <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading…</div>
      ) : !all.data || all.data.length === 0 ? (
        <Card><Empty title="No questions defined" /></Card>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {all.data.map((q) => (
              <li key={q.id} className="px-5 py-3 flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="bg-violet-100 text-violet-800 text-xs px-2 py-0.5 rounded">{q.key}</code>
                    <span className="text-xs text-slate-500">
                      [{q.language ?? 'universal'}]
                    </span>
                  </div>
                  <div className="text-sm text-slate-700">{q.text}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(q.id, q.key)}>Delete</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
};
