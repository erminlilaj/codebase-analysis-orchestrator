import React, { useState } from 'react';
import * as api from '../../api';
import { useFetch } from '../../hooks';
import type { Question } from '../../types';
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
} from '../../components/ui';

// Questions for the project's language. Shared across all projects of that
// language (e.g. all COBOL projects use the same `cobol` questions).
export const QuestionsTab: React.FC<{ language: string }> = ({ language }) => {
  // Show language-specific + universal (null-language) questions.
  const langScoped = useFetch(() => api.listQuestions(language), [language]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState('');
  const [draftText, setDraftText] = useState('');
  const [creating, setCreating] = useState(false);

  const startEdit = (q: Question) => {
    setEditingId(q.id);
    setDraftKey(q.key);
    setDraftText(q.text);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftKey('');
    setDraftText('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await api.updateQuestion(editingId, { key: draftKey.trim(), text: draftText.trim() });
      cancelEdit();
      langScoped.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const remove = async (q: Question) => {
    if (!confirm(`Delete question "${q.key}"? Existing answers are kept; future runs won't include it.`)) return;
    try {
      await api.deleteQuestion(q.id);
      langScoped.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const createNew = async () => {
    if (!draftKey.trim() || !draftText.trim()) {
      setError('key and text are required');
      return;
    }
    try {
      await api.createQuestion({ key: draftKey.trim(), text: draftText.trim(), language });
      setCreating(false);
      setDraftKey('');
      setDraftText('');
      setError(null);
      langScoped.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <ErrorMessage error={error} />

      <div className="flex justify-between items-center">
        <div className="text-sm text-slate-600">
          Questions for language: <strong>{language}</strong>. Each run asks every
          listed question about every bundle.
        </div>
        {!creating ? (
          <Button size="sm" onClick={() => { setCreating(true); setDraftKey(''); setDraftText(''); }}>
            + Add question
          </Button>
        ) : null}
      </div>

      {creating ? (
        <Card>
          <CardHeader>
            <div className="font-medium text-sm">New question (language: {language})</div>
          </CardHeader>
          <CardBody className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Key (short slug)</label>
              <Input
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value)}
                placeholder="purpose, data-structures, ..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Question text</label>
              <Textarea
                rows={4}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="What does this program do?"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => { setCreating(false); cancelEdit(); }}>Cancel</Button>
              <Button onClick={createNew}>Create</Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {langScoped.loading && !langScoped.data ? (
        <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading…</div>
      ) : !langScoped.data || langScoped.data.length === 0 ? (
        <Card><Empty title="No questions defined" hint="Click '+ Add question' to create one." /></Card>
      ) : (
        <div className="space-y-2">
          {langScoped.data.map((q) =>
            editingId === q.id ? (
              <Card key={q.id}>
                <CardBody className="space-y-3">
                  <Input value={draftKey} onChange={(e) => setDraftKey(e.target.value)} />
                  <Textarea rows={3} value={draftText} onChange={(e) => setDraftText(e.target.value)} />
                  <div className="flex gap-2 justify-end">
                    <Button variant="secondary" size="sm" onClick={cancelEdit}>Cancel</Button>
                    <Button size="sm" onClick={saveEdit}>Save</Button>
                  </div>
                </CardBody>
              </Card>
            ) : (
              <Card key={q.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="bg-violet-100 text-violet-800 text-xs px-2 py-0.5 rounded">
                          {q.key}
                        </code>
                        {q.language ? (
                          <span className="text-xs text-slate-500">[{q.language}]</span>
                        ) : (
                          <span className="text-xs text-slate-500">[universal]</span>
                        )}
                      </div>
                      <div className="text-sm text-slate-700">{q.text}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(q)}>Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(q)}>Delete</Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ),
          )}
        </div>
      )}
    </div>
  );
};
