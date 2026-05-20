import type {
  Project,
  SourceFile,
  AnalysisBundle,
  AnalysisRun,
  AnalysisJob,
  AnalysisAnswer,
  Question,
  ExportRecord,
  ProviderHealth,
  ProviderCredential,
  RunCreateResult,
  ScanResult,
  BundleBuildResult,
  FsListResponse,
} from './types';

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: string) {
    super(`API ${status}: ${body}`);
    this.name = 'ApiError';
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const parsed = JSON.parse(text);
      msg = parsed.error ?? text;
    } catch { /* keep raw */ }
    throw new ApiError(res.status, msg);
  }
  if (!text) return undefined as T;
  try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
}

// Projects
export const listProjects = () => request<Project[]>('GET', '/projects');
export const getProject = (id: string) => request<Project>('GET', `/projects/${id}`);
export const createProject = (body: { name: string; repoPath: string; language?: string }) =>
  request<Project>('POST', '/projects', body);
export const deleteProject = (id: string) => request<void>('DELETE', `/projects/${id}`);
export const scanProject = (id: string) => request<ScanResult>('POST', `/projects/${id}/scan`);

// Files / Bundles
export const listFiles = (projectId: string, language?: string) =>
  request<SourceFile[]>('GET', `/projects/${projectId}/files${language ? `?language=${language}` : ''}`);
export const listBundles = (projectId: string) =>
  request<AnalysisBundle[]>('GET', `/projects/${projectId}/bundles`);
export const buildBundles = (projectId: string) =>
  request<BundleBuildResult>('POST', `/projects/${projectId}/bundles`);

// Questions (global with optional language tag)
export const listQuestions = (language?: string) =>
  request<Question[]>('GET', `/questions${language ? `?language=${language}` : ''}`);
export const createQuestion = (body: { key: string; text: string; language?: string | null }) =>
  request<Question>('POST', '/questions', body);
export const updateQuestion = (id: string, body: { key?: string; text?: string; language?: string | null }) =>
  request<Question>('PUT', `/questions/${id}`, body);
export const deleteQuestion = (id: string) => request<void>('DELETE', `/questions/${id}`);

// Runs / Jobs / Answers
export const listRuns = (projectId: string) =>
  request<AnalysisRun[]>('GET', `/projects/${projectId}/runs`);
export const createRun = (
  projectId: string,
  body: {
    providerId: string;
    questionIds?: string[];
    priority?: number;
    model?: string;
    agent?: string;
  },
) => request<RunCreateResult>('POST', `/projects/${projectId}/runs`, body);
export const getRun = (runId: string) => request<AnalysisRun>('GET', `/runs/${runId}`);
export const cancelRun = (runId: string) =>
  request<{ cancelledJobCount: number }>('POST', `/runs/${runId}/cancel`);
export const retryRun = (runId: string) =>
  request<{ retriedJobIds: string[]; count: number }>('POST', `/runs/${runId}/retry`);
export const listRunJobs = (runId: string, status?: string) =>
  request<AnalysisJob[]>('GET', `/runs/${runId}/jobs${status ? `?status=${status}` : ''}`);
export const listRunAnswers = (runId: string) =>
  request<AnalysisAnswer[]>('GET', `/runs/${runId}/answers`);
export const getJob = (jobId: string) =>
  request<AnalysisJob>('GET', `/jobs/${jobId}`);
export const getAnswer = (jobId: string) =>
  request<AnalysisAnswer>('GET', `/jobs/${jobId}/answer`);

// Exports
export const listExports = (projectId: string) =>
  request<ExportRecord[]>('GET', `/projects/${projectId}/exports`);
export const createExport = (projectId: string, body: { format: 'json' | 'csv' | 'markdown'; runId?: string }) =>
  request<ExportRecord>('POST', `/projects/${projectId}/exports`, body);

// Providers
export const listProviders = () =>
  request<Record<string, ProviderHealth>>('GET', '/providers');

// Settings — provider API credentials
export const listCredentials = () =>
  request<ProviderCredential[]>('GET', '/settings/credentials');
export const saveCredential = (envVar: string, value: string) =>
  request<ProviderCredential>('PUT', `/settings/credentials/${envVar}`, { value });
export const deleteCredential = (envVar: string) =>
  request<void>('DELETE', `/settings/credentials/${envVar}`);

// Filesystem
export const fsList = (path?: string) =>
  request<FsListResponse>('GET', `/fs/list${path ? `?path=${encodeURIComponent(path)}` : ''}`);
export const fsHome = () => request<{ path: string }>('GET', '/fs/home');
