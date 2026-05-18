import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type { ApiClient } from '../api';
import type { NavigationApi } from '../navigation';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export const NewRunScreen: React.FC<{
  api: ApiClient;
  nav: NavigationApi;
  projectId: string;
}> = ({ api, nav, projectId }) => {
  const [providerId, setProviderId] = useState('stub');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!providerId.trim()) {
      setError('providerId is required');
      return;
    }
    setSubmitting(true);
    try {
      const r = await api.createRun(projectId, { providerId: providerId.trim() });
      nav.replace({ kind: 'run', projectId, runId: r.run.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  useInput((_input, key) => {
    if (submitting) return;
    if (key.return) void submit();
  });

  return (
    <Box flexDirection="column">
      <Header title="New run" subtitle={projectId} />
      <Box flexDirection="column" marginBottom={1}>
        <Text dimColor>
          Creates a new AnalysisRun and one job per (bundle × question) pair using
          the chosen provider. Questions are picked automatically based on the
          project's language.
        </Text>
      </Box>
      <Box>
        <Box width={14}><Text>▶ provider:</Text></Box>
        <TextInput value={providerId} onChange={setProviderId} onSubmit={() => void submit()} />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Known providers: stub (always available), bob, opencode.</Text>
      </Box>

      {error ? <Text color="red">{error}</Text> : null}
      {submitting ? <Box><Spinner /><Text>  creating run...</Text></Box> : null}

      <Footer hints={[{ key: '⏎', label: 'submit' }, { key: 'esc', label: 'cancel' }]} />
    </Box>
  );
};
