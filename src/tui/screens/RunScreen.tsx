import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { ApiClient } from '../api';
import type { NavigationApi } from '../navigation';
import type { AnalysisRun, AnalysisJob, AnalysisAnswer } from '../types';
import { answerSummary } from '../../core/answers/answerSummary';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { ProgressBar } from '../components/ProgressBar';

type Detail = {
  run: AnalysisRun;
  jobs: AnalysisJob[];
  answers: AnalysisAnswer[];
};

const POLL_MS = 1500;

export const RunScreen: React.FC<{
  api: ApiClient;
  nav: NavigationApi;
  projectId: string;
  runId: string;
}> = ({ api, nav, projectId, runId }) => {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: NodeJS.Timeout | undefined;

    const tick = async () => {
      try {
        const [run, jobs, answers] = await Promise.all([
          api.getRun(runId),
          api.listRunJobs(runId),
          api.listRunAnswers(runId),
        ]);
        if (cancelled) return;
        setDetail({ run, jobs, answers });
        setError(null);
        const active = jobs.some((j) => j.status === 'pending' || j.status === 'claimed' || j.status === 'running');
        if (active) timer = setTimeout(tick, POLL_MS);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        timer = setTimeout(tick, POLL_MS * 2);
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [runId]);

  useInput((input) => {
    if (input === 'e') nav.push({ kind: 'new-export', projectId, runId });
    if (input === 'R' && detail) {
      // Force a one-off refresh by clearing the timer via state churn.
      setDetail({ ...detail });
    }
  });

  if (error && !detail) {
    return (
      <Box flexDirection="column">
        <Header title="Run" />
        <Text color="red">Error: {error}</Text>
        <Footer hints={[{ key: 'esc', label: 'back' }]} />
      </Box>
    );
  }

  if (!detail) {
    return (
      <Box flexDirection="column">
        <Header title="Run" />
        <Box><Spinner /><Text>  loading...</Text></Box>
      </Box>
    );
  }

  const { run, jobs, answers } = detail;
  const counts = jobs.reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1;
    return acc;
  }, {});
  const done = counts.completed ?? 0;
  const failed = counts.failed ?? 0;
  const total = jobs.length;
  const active = (counts.pending ?? 0) + (counts.claimed ?? 0) + (counts.running ?? 0);

  return (
    <Box flexDirection="column">
      <Header title={`Run ${run.id}`} subtitle={run.status} />

      <Box flexDirection="column" marginBottom={1}>
        <Text>
          <Text dimColor>started:  </Text>
          {run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'}
        </Text>
        <Text>
          <Text dimColor>finished: </Text>
          {run.finishedAt ? new Date(run.finishedAt).toLocaleString() : '—'}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <ProgressBar done={done} total={total} failed={failed} />
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text bold>Job statuses</Text>
        {Object.entries(counts).map(([status, n]) => (
          <Text key={status}>
            <Text dimColor>{status.padEnd(11)}</Text>
            <Text>{n}</Text>
          </Text>
        ))}
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text bold>Recent answers ({answers.length})</Text>
        {answers.slice(-5).reverse().map((a) => (
          <Box key={a.id}>
            <Box width={20}>
              <Text dimColor>{a.job?.question?.key ?? '—'}</Text>
            </Box>
            <Text>{truncate(answerSummary(a.parsed, a.rawOutput).replace(/\s+/g, ' '), 50)}</Text>
          </Box>
        ))}
      </Box>

      {active > 0 ? (
        <Box>
          <Spinner />
          <Text>  {active} job{active === 1 ? '' : 's'} in flight</Text>
        </Box>
      ) : null}

      <Footer
        hints={[
          { key: 'e', label: 'export' },
          { key: 'R', label: 'refresh' },
          { key: 'esc', label: 'back' },
        ]}
      />
    </Box>
  );
};

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
