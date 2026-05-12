import React, { useCallback, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { ApiClient } from './api';
import type { NavigationApi, Screen } from './navigation';
import { ProjectsScreen } from './screens/ProjectsScreen';
import { ProjectScreen } from './screens/ProjectScreen';
import { NewProjectScreen } from './screens/NewProjectScreen';
import { NewRunScreen } from './screens/NewRunScreen';
import { RunScreen } from './screens/RunScreen';
import { NewExportScreen } from './screens/NewExportScreen';
import { MessageScreen } from './screens/MessageScreen';
import { Header } from './components/Header';

export const App: React.FC<{ apiUrl: string }> = ({ apiUrl }) => {
  const { exit } = useApp();
  const api = useMemo(() => new ApiClient(apiUrl), [apiUrl]);
  const [stack, setStack] = useState<Screen[]>([{ kind: 'projects' }]);
  const current = stack[stack.length - 1]!;

  const nav: NavigationApi = useMemo(() => ({
    push: (s) => setStack((prev) => [...prev, s]),
    replace: (s) => setStack((prev) => [...prev.slice(0, -1), s]),
    pop: () => setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev)),
    reset: (s) => setStack([s]),
  }), []);

  // Global quit
  useInput((input, key) => {
    if (input === 'q' && current.kind === 'projects') {
      exit();
    } else if (key.escape && stack.length > 1) {
      nav.pop();
    }
  });

  const render = useCallback(() => {
    switch (current.kind) {
      case 'projects':
        return <ProjectsScreen api={api} nav={nav} />;
      case 'new-project':
        return <NewProjectScreen api={api} nav={nav} />;
      case 'project':
        return <ProjectScreen api={api} nav={nav} projectId={current.projectId} />;
      case 'new-run':
        return <NewRunScreen api={api} nav={nav} projectId={current.projectId} />;
      case 'run':
        return <RunScreen api={api} nav={nav} projectId={current.projectId} runId={current.runId} />;
      case 'new-export':
        return (
          <NewExportScreen
            api={api}
            nav={nav}
            projectId={current.projectId}
            runId={current.runId}
          />
        );
      case 'message':
        return <MessageScreen nav={nav} title={current.title} body={current.body} />;
    }
  }, [api, nav, current]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text color="magenta" bold>codebase-analysis-orchestrator</Text>
        <Text dimColor> · TUI · </Text>
        <Text dimColor>{apiUrl}</Text>
      </Box>
      {render()}
    </Box>
  );
};
