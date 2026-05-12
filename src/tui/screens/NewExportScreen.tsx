import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import type { ApiClient } from '../api';
import type { NavigationApi } from '../navigation';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

type FormatOption = { label: string; value: 'json' | 'csv' | 'markdown' };

const OPTIONS: FormatOption[] = [
  { label: 'JSON  — full structured records', value: 'json' },
  { label: 'CSV   — spreadsheet-friendly', value: 'csv' },
  { label: 'Markdown — human-readable report', value: 'markdown' },
];

export const NewExportScreen: React.FC<{
  api: ApiClient;
  nav: NavigationApi;
  projectId: string;
  runId?: string;
}> = ({ api, nav, projectId, runId }) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (item: FormatOption) => {
    setSubmitting(true);
    setError(null);
    try {
      const exportRow = await api.createExport(projectId, {
        format: item.value,
        runId,
      });
      nav.replace({
        kind: 'message',
        title: 'Export complete',
        body:
          `Format:   ${exportRow.format}\n` +
          `Path:     ${exportRow.filePath}\n` +
          `Size:     ${exportRow.sizeBytes ?? '?'} bytes`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  useInput(() => {
    /* SelectInput handles arrow keys + enter */
  });

  return (
    <Box flexDirection="column">
      <Header title="Export" subtitle={runId ? `run ${runId}` : 'all runs'} />
      <Box marginBottom={1}>
        <Text>Choose a format:</Text>
      </Box>
      {submitting ? (
        <Box><Spinner /><Text>  generating export...</Text></Box>
      ) : (
        <SelectInput items={OPTIONS} onSelect={(item) => void submit(item as FormatOption)} />
      )}
      {error ? <Text color="red">{error}</Text> : null}
      <Footer hints={[{ key: '↑↓', label: 'select' }, { key: '⏎', label: 'confirm' }, { key: 'esc', label: 'cancel' }]} />
    </Box>
  );
};
