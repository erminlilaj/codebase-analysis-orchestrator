import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type { ApiClient } from '../api';
import type { NavigationApi } from '../navigation';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

type Field = 'name' | 'repoPath' | 'language';
const ORDER: Field[] = ['name', 'repoPath', 'language'];

export const NewProjectScreen: React.FC<{
  api: ApiClient;
  nav: NavigationApi;
}> = ({ api, nav }) => {
  const [name, setName] = useState('');
  const [repoPath, setRepoPath] = useState('');
  const [language, setLanguage] = useState('cobol');
  const [field, setField] = useState<Field>('name');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || !repoPath.trim()) {
      setError('name and repoPath are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const p = await api.createProject({
        name: name.trim(),
        repoPath: repoPath.trim(),
        language: language.trim() || 'unknown',
      });
      nav.replace({ kind: 'project', projectId: p.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  useInput((input, key) => {
    if (submitting) return;
    if (key.tab || (key.return && field !== 'language')) {
      const idx = ORDER.indexOf(field);
      setField(ORDER[(idx + 1) % ORDER.length]!);
    } else if (key.return && field === 'language') {
      void submit();
    } else if (input === 's' && key.ctrl) {
      void submit();
    }
  });

  return (
    <Box flexDirection="column">
      <Header title="New project" />

      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Box width={14}><Text>{field === 'name' ? '▶ name:' : '  name:'}</Text></Box>
          {field === 'name' ? (
            <TextInput value={name} onChange={setName} onSubmit={() => setField('repoPath')} />
          ) : (
            <Text dimColor>{name || '(empty)'}</Text>
          )}
        </Box>
        <Box>
          <Box width={14}><Text>{field === 'repoPath' ? '▶ repo path:' : '  repo path:'}</Text></Box>
          {field === 'repoPath' ? (
            <TextInput value={repoPath} onChange={setRepoPath} onSubmit={() => setField('language')} />
          ) : (
            <Text dimColor>{repoPath || '(empty)'}</Text>
          )}
        </Box>
        <Box>
          <Box width={14}><Text>{field === 'language' ? '▶ language:' : '  language:'}</Text></Box>
          {field === 'language' ? (
            <TextInput value={language} onChange={setLanguage} onSubmit={() => void submit()} />
          ) : (
            <Text dimColor>{language}</Text>
          )}
        </Box>
      </Box>

      {error ? <Text color="red">{error}</Text> : null}
      {submitting ? <Box><Spinner /><Text>  creating...</Text></Box> : null}

      <Footer
        hints={[
          { key: 'tab', label: 'next field' },
          { key: '⏎', label: 'next / submit' },
          { key: 'esc', label: 'cancel' },
        ]}
      />
    </Box>
  );
};
