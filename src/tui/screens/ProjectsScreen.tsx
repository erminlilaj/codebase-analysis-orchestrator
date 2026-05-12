import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { ApiClient } from '../api';
import type { NavigationApi } from '../navigation';
import type { Project } from '../types';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export const ProjectsScreen: React.FC<{
  api: ApiClient;
  nav: NavigationApi;
}> = ({ api, nav }) => {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const refresh = async () => {
    try {
      const list = await api.listProjects();
      setProjects(list);
      setCursor((c) => Math.min(c, Math.max(0, list.length - 1)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useInput((input, key) => {
    if (!projects) return;
    if (key.upArrow || input === 'k') setCursor((c) => Math.max(0, c - 1));
    else if (key.downArrow || input === 'j') setCursor((c) => Math.min(projects.length - 1, c + 1));
    else if (key.return && projects[cursor]) {
      nav.push({ kind: 'project', projectId: projects[cursor]!.id });
    } else if (input === 'n') {
      nav.push({ kind: 'new-project' });
    } else if (input === 'r') {
      void refresh();
    } else if (input === 'd' && projects[cursor]) {
      const target = projects[cursor]!;
      setDeleting(true);
      (async () => {
        try {
          await api.deleteProject(target.id);
        } finally {
          setDeleting(false);
          await refresh();
        }
      })();
    }
  });

  return (
    <Box flexDirection="column">
      <Header title="Projects" subtitle={projects ? `${projects.length} total` : ''} />
      {error ? (
        <Text color="red">Error: {error}</Text>
      ) : !projects ? (
        <Box>
          <Spinner /><Text>  loading projects...</Text>
        </Box>
      ) : projects.length === 0 ? (
        <Text dimColor>No projects yet. Press [n] to create one.</Text>
      ) : (
        <Box flexDirection="column">
          <Box>
            <Box width={26}><Text bold>NAME</Text></Box>
            <Box width={12}><Text bold>LANGUAGE</Text></Box>
            <Box width={28}><Text bold>ID</Text></Box>
          </Box>
          {projects.map((p, i) => (
            <Box key={p.id}>
              <Box width={26}>
                <Text color={i === cursor ? 'cyan' : undefined}>
                  {i === cursor ? '▶ ' : '  '}{truncate(p.name, 22)}
                </Text>
              </Box>
              <Box width={12}><Text>{p.language}</Text></Box>
              <Box width={28}><Text dimColor>{p.id}</Text></Box>
            </Box>
          ))}
        </Box>
      )}
      {deleting ? <Text color="yellow">deleting...</Text> : null}
      <Footer
        hints={[
          { key: '↑↓', label: 'select' },
          { key: '⏎', label: 'open' },
          { key: 'n', label: 'new' },
          { key: 'd', label: 'delete' },
          { key: 'r', label: 'refresh' },
          { key: 'q', label: 'quit' },
        ]}
      />
    </Box>
  );
};

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
