import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

const mocks = vi.hoisted(() => ({
  prisma: {
    project: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    sourceFile: {
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    analysisBundle: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    analysisRun: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    analysisJob: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    analysisAnswer: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    question: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    export: {
      findMany: vi.fn(),
    },
  },
  generateJobs: vi.fn(),
  getQuestionsForLanguage: vi.fn(),
  getProviderHealth: vi.fn(),
  listProviderHealth: vi.fn(),
}));

vi.mock('../db/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('../core/jobs/jobGenerator', () => ({ generateJobs: mocks.generateJobs }));
vi.mock('../core/questions/questionService', () => ({
  getQuestionsForLanguage: mocks.getQuestionsForLanguage,
}));
vi.mock('../providers/providerRegistry', () => ({
  getProviderHealth: mocks.getProviderHealth,
  listProviderHealth: mocks.listProviderHealth,
}));

import { buildServer } from './server';

const now = new Date('2026-05-12T12:00:00.000Z');

describe('buildServer API routes', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProviderHealth.mockResolvedValue({
      providerId: 'stub',
      name: 'Stub Provider',
      type: 'stub',
      configured: true,
      enabled: true,
      available: true,
      retryable: false,
    });
    mocks.listProviderHealth.mockResolvedValue({
      stub: {
        providerId: 'stub',
        name: 'Stub Provider',
        type: 'stub',
        configured: true,
        enabled: true,
        available: true,
        retryable: false,
      },
      bob: {
        providerId: 'bob',
        name: 'IBM Bob Shell',
        type: 'shell',
        configured: false,
        enabled: false,
        available: false,
        retryable: false,
        reason: 'Bob provider disabled',
      },
    });
    app = buildServer();
  });

  afterEach(async () => {
    await app.close();
  });

  it('serves projects only under the /api prefix', async () => {
    const projects = [
      {
        id: 'project-1',
        name: 'Fixture',
        repoPath: '/repo',
        language: 'cobol',
        metadata: {},
        createdAt: now,
        updatedAt: now,
      },
    ];
    mocks.prisma.project.findMany.mockResolvedValue(projects);

    const res = await app.inject({ method: 'GET', url: '/api/projects' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ ...projects[0], createdAt: now.toISOString(), updatedAt: now.toISOString() }]);
    expect(mocks.prisma.project.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    });

    const unprefixed = await app.inject({ method: 'GET', url: '/projects' });
    expect(unprefixed.statusCode).toBe(200);
    expect(unprefixed.headers['content-type']).toContain('text/html');
    expect(mocks.prisma.project.findMany).toHaveBeenCalledTimes(1);
  });

  it('creates a project with default language when omitted', async () => {
    const project = {
      id: 'project-1',
      name: 'Fixture',
      repoPath: '/repo',
      language: 'unknown',
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };
    mocks.prisma.project.create.mockResolvedValue(project);

    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Fixture', repoPath: '/repo' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().language).toBe('unknown');
    expect(mocks.prisma.project.create).toHaveBeenCalledWith({
      data: { name: 'Fixture', repoPath: '/repo', language: 'unknown' },
    });
  });

  it('lists provider health under /api/providers', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/providers' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      stub: {
        providerId: 'stub',
        name: 'Stub Provider',
        type: 'stub',
        configured: true,
        enabled: true,
        available: true,
        retryable: false,
      },
      bob: {
        providerId: 'bob',
        name: 'IBM Bob Shell',
        type: 'shell',
        configured: false,
        enabled: false,
        available: false,
        retryable: false,
        reason: 'Bob provider disabled',
      },
    });
    expect(mocks.listProviderHealth).toHaveBeenCalledOnce();
  });

  it('returns provider health by id', async () => {
    const health = {
      providerId: 'bob',
      name: 'IBM Bob Shell',
      type: 'shell',
      configured: false,
      enabled: false,
      available: false,
      retryable: false,
      reason: 'Bob provider disabled',
    };
    mocks.getProviderHealth.mockResolvedValue(health);

    const res = await app.inject({ method: 'GET', url: '/api/providers/bob/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(health);
    expect(mocks.getProviderHealth).toHaveBeenCalledWith('bob');
  });

  it('returns 404 for unknown provider health requests', async () => {
    mocks.getProviderHealth.mockResolvedValue(undefined);

    const res = await app.inject({ method: 'GET', url: '/api/providers/unknown/health' });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Provider not found' });
  });

  it('filters run jobs by status after confirming the run exists', async () => {
    const run = { id: 'run-1', projectId: 'project-1', status: 'pending' };
    const jobs = [
      { id: 'job-1', runId: 'run-1', status: 'failed', question: { key: 'purpose' } },
    ];
    mocks.prisma.analysisRun.findUnique.mockResolvedValue(run);
    mocks.prisma.analysisJob.findMany.mockResolvedValue(jobs);

    const res = await app.inject({
      method: 'GET',
      url: '/api/runs/run-1/jobs?status=failed',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(jobs);
    expect(mocks.prisma.analysisJob.findMany).toHaveBeenCalledWith({
      where: { runId: 'run-1', status: 'failed' },
      include: { question: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('returns only jobs whose question version is behind from stale-jobs', async () => {
    const run = { id: 'run-1', projectId: 'project-1', status: 'completed' };
    const jobs = [
      { id: 'job-1', runId: 'run-1', questionVersion: 1, question: { version: 2 } },
      { id: 'job-2', runId: 'run-1', questionVersion: 2, question: { version: 2 } },
    ];
    mocks.prisma.analysisRun.findUnique.mockResolvedValue(run);
    mocks.prisma.analysisJob.findMany.mockResolvedValue(jobs);

    const res = await app.inject({ method: 'GET', url: '/api/runs/run-1/stale-jobs' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([jobs[0]]);
  });

  it('returns 404 from stale-jobs when the run does not exist', async () => {
    mocks.prisma.analysisRun.findUnique.mockResolvedValue(null);

    const res = await app.inject({ method: 'GET', url: '/api/runs/missing/stale-jobs' });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Run not found' });
  });

  it('increments question version when the text changes', async () => {
    const question = { id: 'q1', key: 'purpose', text: 'Old text', language: null, version: 1 };
    mocks.prisma.question.findUnique.mockResolvedValue(question);
    mocks.prisma.question.update.mockResolvedValue({ ...question, text: 'New text', version: 2 });

    const res = await app.inject({
      method: 'PUT',
      url: '/api/questions/q1',
      payload: { text: 'New text' },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.question.update).toHaveBeenCalledWith({
      where: { id: 'q1' },
      data: { text: 'New text', version: 2 },
    });
  });

  it('does not increment question version when the text is unchanged', async () => {
    const question = { id: 'q1', key: 'purpose', text: 'Same text', language: null, version: 1 };
    mocks.prisma.question.findUnique.mockResolvedValue(question);
    mocks.prisma.question.update.mockResolvedValue(question);

    const res = await app.inject({
      method: 'PUT',
      url: '/api/questions/q1',
      payload: { text: 'Same text' },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.question.update).toHaveBeenCalledWith({
      where: { id: 'q1' },
      data: { text: 'Same text' },
    });
  });

  it('creates a run from default language questions and bundle cross-product', async () => {
    const project = { id: 'project-1', language: 'cobol' };
    const bundles = [{ id: 'bundle-1' }, { id: 'bundle-2' }];
    const run = { id: 'run-1', projectId: 'project-1', startedAt: now };
    mocks.prisma.project.findUnique.mockResolvedValue(project);
    mocks.getQuestionsForLanguage.mockResolvedValue([
      { id: 'question-1', key: 'purpose', text: 'Purpose?' },
      { id: 'question-2', key: 'data', text: 'Data?' },
    ]);
    mocks.prisma.analysisBundle.findMany.mockResolvedValue(bundles);
    mocks.prisma.analysisRun.create.mockResolvedValue(run);
    mocks.generateJobs.mockResolvedValue(4);

    const res = await app.inject({
      method: 'POST',
      url: '/api/projects/project-1/runs',
      payload: { providerId: 'stub', priority: 7 },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      run: { ...run, startedAt: now.toISOString() },
      jobCount: 4,
    });
    expect(mocks.getQuestionsForLanguage).toHaveBeenCalledWith('cobol');
    expect(mocks.getProviderHealth).toHaveBeenCalledWith('stub');
    expect(mocks.generateJobs).toHaveBeenCalledWith({
      runId: 'run-1',
      bundleIds: ['bundle-1', 'bundle-2'],
      questionIds: ['question-1', 'question-2'],
      providerId: 'stub',
      priority: 7,
    });
  });

  it('rejects run creation when no bundles exist', async () => {
    mocks.prisma.project.findUnique.mockResolvedValue({ id: 'project-1', language: 'cobol' });
    mocks.getQuestionsForLanguage.mockResolvedValue([
      { id: 'question-1', key: 'purpose', text: 'Purpose?' },
    ]);
    mocks.prisma.analysisBundle.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/projects/project-1/runs',
      payload: { providerId: 'stub' },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: 'No bundles found. Build bundles first.' });
    expect(mocks.prisma.analysisRun.create).not.toHaveBeenCalled();
    expect(mocks.generateJobs).not.toHaveBeenCalled();
  });

  it('rejects run creation for unknown providers before generating jobs', async () => {
    mocks.prisma.project.findUnique.mockResolvedValue({ id: 'project-1', language: 'cobol' });
    mocks.getProviderHealth.mockResolvedValue(undefined);

    const res = await app.inject({
      method: 'POST',
      url: '/api/projects/project-1/runs',
      payload: { providerId: 'unknown' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'Unknown provider: unknown' });
    expect(mocks.getQuestionsForLanguage).not.toHaveBeenCalled();
    expect(mocks.prisma.analysisRun.create).not.toHaveBeenCalled();
    expect(mocks.generateJobs).not.toHaveBeenCalled();
  });

  it('rejects run creation when provider health is unavailable', async () => {
    const health = {
      providerId: 'bob',
      name: 'IBM Bob Shell',
      type: 'shell',
      configured: false,
      enabled: true,
      available: false,
      retryable: false,
      reason: 'BOBSHELL_API_KEY not set',
    };
    mocks.prisma.project.findUnique.mockResolvedValue({ id: 'project-1', language: 'cobol' });
    mocks.getProviderHealth.mockResolvedValue(health);

    const res = await app.inject({
      method: 'POST',
      url: '/api/projects/project-1/runs',
      payload: { providerId: 'bob' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: 'Provider unavailable: bob',
      provider: health,
    });
    expect(mocks.getQuestionsForLanguage).not.toHaveBeenCalled();
    expect(mocks.prisma.analysisRun.create).not.toHaveBeenCalled();
    expect(mocks.generateJobs).not.toHaveBeenCalled();
  });
});
