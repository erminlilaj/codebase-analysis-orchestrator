import React, { useState } from 'react';
import * as api from '../../api';
import { useFetch } from '../../hooks';
import type { Question } from '../../types';
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
  Textarea,
  useToast,
} from '../../components/ui';

// Project-specific questions plus shared questions for the project's language.
export const QuestionsTab: React.FC<{ projectId: string; language: string }> = ({ projectId, language }) => {
  const langScoped = useFetch(() => api.listQuestions(language, projectId), [language, projectId]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState('');
  const [draftText, setDraftText] = useState('');
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<Question | null>(null);
  const toast = useToast();

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
      toast.success('Question saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const remove = async (q: Question) => {
    setPending(null);
    try {
      await api.deleteQuestion(q.id);
      langScoped.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const createNew = async () => {
    if (!draftKey.trim() || !draftText.trim()) {
      setError('key and text are required');
      return;
    }
    try {
      await api.createQuestion({
        key: draftKey.trim(),
        text: draftText.trim(),
        language,
        projectId,
      });
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
    <>
    <ConfirmDialog
      open={!!pending}
      title="Delete question"
      message={`Delete "${pending?.key}"? Existing answers are kept; future runs won't include it.`}
      onConfirm={() => pending && remove(pending)}
      onCancel={() => setPending(null)}
    />
    <div className="mt-4 space-y-3">
      <ErrorMessage error={error} />

      <div className="flex justify-between items-center">
        <div className="text-sm text-slate-600">
          Private questions for this project plus shared <strong>{language}</strong>
          and universal questions. New questions created here are project-only.
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
            <div className="font-medium text-sm">New project-only question</div>
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
                        {q.projectId === projectId ? (
                          <span className="text-xs text-emerald-700">[project-only]</span>
                        ) : q.language ? (
                          <span className="text-xs text-slate-500">[{q.language} shared]</span>
                        ) : (
                          <span className="text-xs text-slate-500">[universal shared]</span>
                        )}
                      </div>
                      <div className="text-sm text-slate-700">{q.text}</div>
                    </div>
                    {q.projectId === projectId ? (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(q)}>Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => setPending(q)}>Delete</Button>
                      </div>
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            ),
          )}
        </div>
      )}
    </div>
    </>
  );
};
