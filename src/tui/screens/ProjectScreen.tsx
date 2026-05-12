import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { ApiClient } from '../api';
import type { NavigationApi } from '../navigation';
import type { Project, AnalysisRun, SourceFile, AnalysisBundle } from '../types';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

type Detail = {
  project: Project;
  files: SourceFile[];
  bundles: AnalysisBundle[];
  runs: AnalysisRun[];
};

export const ProjectScreen: React.FC<{
  api: ApiClient;
  nav: NavigationApi;
  projectId: string;
}> = ({ api, nav, projectId }) => {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);

  const refresh = async () => {
    try {
      const [project, files, bundles, runs] = await Promise.all([
        api.getProject(projectId),
        api.listFiles(projectId),
        api.listBundles(projectId),
        api.listRuns(projectId),
      ]);
      setDetail({ project, files, bundles, runs });
      setCursor((c) => Math.min(c, Math.max(0, runs.length - 1)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => { void refresh(); }, [projectId]);

  const runAction = async (label: string, fn: () => Promise<string>) => {
    setBusy(label);
    try {
      const msg = await fn();
      setBusy(null);
      await refresh();
      if (msg) nav.push({ kind: 'message', title: label, body: msg });
    } catch (err) {
      setBusy(null);
      nav.push({
        kind: 'message',
        title: `${label} failed`,
        body: err instanceof Error ? err.message : String(err),
      });
    }
  };

  useInput((input, key) => {
    if (!detail || busy) return;
    const runs = detail.runs;
    if (key.upArrow || input === 'k') setCursor((c) => Math.max(0, c - 1));
    else if (key.downArrow || input === 'j') setCursor((c) => Math.min(runs.length - 1, c + 1));
    else if (key.return && runs[cursor]) {
      nav.push({ kind: 'run', projectId, runId: runs[cursor]!.id });
    } else if (input === 's') {
      void runAction('Scan', async () => {
        const r = await api.scanProject(projectId);
        return `Found ${r.filesFound} files`;
      });
    } else if (input === 'b') {
      void runAction('Build bundles', async () => {
        const r = await api.buildBundles(projectId);
        return r.message ?? `Created ${r.bundlesCreated} bundles`;
      });
    } else if (input === 'r') {
      nav.push({ kind: 'new-run', projectId });
    } else if (input === 'e') {
      nav.push({ kind: 'new-export', projectId });
    } else if (input === 'R') {
      void refresh();
    }
  });

  if (error) {
    return (
      <Box flexDirection="column">
        <Header title="Project" />
        <Text color="red">Error: {error}</Text>
        <Footer hints={[{ key: 'esc', label: 'back' }]} />
      </Box>
    );
  }

  if (!detail) {
    return (
      <Box flexDirection="column">
        <Header title="Project" />
        <Box><Spinner /><Text>  loading...</Text></Box>
      </Box>
    );
  }

  const { project, files, bundles, runs } = detail;

  return (
    <Box flexDirection="column">
      <Header title={project.name} subtitle={`${project.language} · ${project.id}`} />

      <Box flexDirection="column" marginBottom={1}>
        <Text><Text dimColor>repo:    </Text>{project.repoPath}</Text>
        <Text><Text dimColor>files:   </Text>{files.length}</Text>
        <Text><Text dimColor>bundles: </Text>{bundles.length}</Text>
        <Text><Text dimColor>runs:    </Text>{runs.length}</Text>
      </Box>

      <Box marginBottom={1}>
        <Text bold>Runs</Text>
      </Box>
      {runs.length === 0 ? (
        <Text dimColor>No runs yet. Scan → build bundles → press [r] to start one.</Text>
      ) : (
        <Box flexDirection="column">
          <Box>
            <Box width={12}><Text bold>STATUS</Text></Box>
            <Box width={26}><Text bold>STARTED</Text></Box>
            <Box width={28}><Text bold>ID</Text></Box>
          </Box>
          {runs.slice(0, 10).map((r, i) => (
            <Box key={r.id}>
              <Box width={12}>
                <Text color={i === cursor ? 'cyan' : statusColor(r.status)}>
                  {i === cursor ? '▶ ' : '  '}{r.status}
                </Text>
              </Box>
              <Box width={26}>
                <Text>{r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}</Text>
              </Box>
              <Box width={28}><Text dimColor>{r.id}</Text></Box>
            </Box>
          ))}
        </Box>
      )}

      {busy ? (
        <Box marginTop={1}>
          <Spinner />
          <Text>  {busy}...</Text>
        </Box>
      ) : null}

      <Footer
        hints={[
          { key: 's', label: 'scan' },
          { key: 'b', label: 'bundles' },
          { key: 'r', label: 'run' },
          { key: 'e', label: 'export' },
          { key: '⏎', label: 'open run' },
          { key: 'R', label: 'refresh' },
          { key: 'esc', label: 'back' },
        ]}
      />
    </Box>
  );
};

function statusColor(s: string): string | undefined {
  if (s === 'completed') return 'green';
  if (s === 'failed') return 'red';
  if (s === 'running' || s === 'claimed') return 'yellow';
  return undefined;
}
