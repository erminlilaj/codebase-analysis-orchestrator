/* eslint-disable no-console */
/**
 * End-to-end smoke test. Drives the API via fastify.inject() against a real
 * PostgreSQL, processes jobs in-process with the stub provider, and writes
 * exports to disk.
 *
 * Run with: npm run e2e
 * Requirements:
 *   - Postgres running (docker compose up -d)
 *   - Migrations applied (npm run db:deploy)
 *   - Questions seeded (npm run db:seed)
 */
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

import { buildServer } from '../src/api/server';
import { prisma } from '../src/db/prisma';
import { WorkerLoop } from '../src/worker/WorkerLoop';
import { WorkspaceBuilder } from '../src/worker/WorkspaceBuilder';
import { StubProvider } from '../src/providers/stub/StubProvider';

const FIXTURE_DIR = path.resolve(__dirname, 'fixtures/cobol');

function log(label: string, body?: unknown) {
  if (body !== undefined) console.log(`\n[${label}]`, body);
  else console.log(`\n[${label}]`);
}

async function call<T = unknown>(
  app: ReturnType<typeof buildServer>,
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  body?: unknown,
): Promise<{ status: number; body: T }> {
  const res = await app.inject({ method, url: `/api${url}`, payload: body as object | undefined });
  let parsed: unknown;
  try {
    parsed = res.body ? JSON.parse(res.body) : undefined;
  } catch {
    parsed = res.body;
  }
  if (res.statusCode >= 400) {
    throw new Error(`${method} ${url} → ${res.statusCode}: ${res.body}`);
  }
  return { status: res.statusCode, body: parsed as T };
}

async function main(): Promise<void> {
  const projectName = `e2e-stub-${Date.now()}`;
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'e2e-ws-'));

  const app = buildServer();
  await app.ready();

  const workspace = new WorkspaceBuilder(workspaceRoot);
  const worker = new WorkerLoop(new StubProvider({ delayMs: 10 }), workspace, {
    concurrency: 4,
    pollIntervalMs: 200,
    maxAttempts: 3,
    staleTimeoutSeconds: 60,
  });

  const workerPromise = worker.start();

  try {
    log('1. Create project', { name: projectName, repoPath: FIXTURE_DIR });
    const { body: project } = await call<{ id: string; language: string }>(
      app,
      'POST',
      '/projects',
      { name: projectName, repoPath: FIXTURE_DIR, language: 'cobol' },
    );
    log('   project', project);

    log('2. Scan');
    const { body: scan } = await call<{ filesFound: number }>(
      app,
      'POST',
      `/projects/${project.id}/scan`,
    );
    log('   scan result', scan);

    log('3. Build bundles');
    const { body: bundles } = await call<{ bundlesCreated: number }>(
      app,
      'POST',
      `/projects/${project.id}/bundles`,
    );
    log('   bundles result', bundles);

    log('4. List questions for cobol');
    const { body: questions } = await call<Array<{ id: string; key: string }>>(
      app,
      'GET',
      '/questions?language=cobol',
    );
    log('   questions', questions.map((q) => q.key));
    if (questions.length === 0) {
      throw new Error('No COBOL questions seeded. Run `npm run db:seed` first.');
    }

    log('5. Create run with stub provider');
    const { body: run } = await call<{ run: { id: string }; jobCount: number }>(
      app,
      'POST',
      `/projects/${project.id}/runs`,
      { providerId: 'stub' },
    );
    log('   run created', run);

    log('6. Waiting for jobs to complete...');
    const runId = run.run.id;
    const deadline = Date.now() + 30_000;
    let lastSummary = '';
    while (Date.now() < deadline) {
      const jobs = await prisma.analysisJob.findMany({
        where: { runId },
        select: { status: true },
      });
      const counts = jobs.reduce<Record<string, number>>((acc, j) => {
        acc[j.status] = (acc[j.status] ?? 0) + 1;
        return acc;
      }, {});
      const summary = JSON.stringify(counts);
      if (summary !== lastSummary) {
        console.log(`   status: ${summary}`);
        lastSummary = summary;
      }
      const pending = (counts.pending ?? 0) + (counts.claimed ?? 0) + (counts.running ?? 0);
      if (pending === 0 && jobs.length > 0) break;
      await new Promise((r) => setTimeout(r, 300));
    }

    log('7. Fetch answers');
    const { body: answers } = await call<unknown[]>(
      app,
      'GET',
      `/runs/${runId}/answers`,
    );
    log(`   ${answers.length} answers stored`);

    log('8. Run exports (json, csv, markdown)');
    for (const format of ['json', 'csv', 'markdown'] as const) {
      const { body: exportRow } = await call<{ filePath: string; sizeBytes: number }>(
        app,
        'POST',
        `/projects/${project.id}/exports`,
        { format, runId },
      );
      const head = (await fs.readFile(exportRow.filePath, 'utf-8'))
        .split('\n')
        .slice(0, 4)
        .join('\n');
      console.log(`   ${format} → ${exportRow.filePath} (${exportRow.sizeBytes} bytes)`);
      console.log(`     head:\n${head.replace(/^/gm, '       ')}`);
    }

    log('9. Cleanup: delete project (cascades to files/bundles/runs/jobs/answers)');
    await call(app, 'DELETE', `/projects/${project.id}`);
    log('   done');
  } finally {
    worker.stop();
    await workerPromise.catch(() => undefined);
    await app.close();
    await prisma.$disconnect();
    await fs.rm(workspaceRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

main().catch((err) => {
  console.error('\nE2E failed:', err);
  process.exit(1);
});
