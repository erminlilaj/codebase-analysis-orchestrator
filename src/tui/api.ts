import type {
  Project,
  SourceFile,
  AnalysisBundle,
  AnalysisRun,
  AnalysisJob,
  AnalysisAnswer,
  Question,
  ExportRecord,
  RunCreateResult,
  ScanResult,
  BundleBuildResult,
} from './types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`API ${status}: ${body}`);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api${path}`, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new ApiError(res.status, text);
    }
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  // Health probe — does NOT throw on 404, just reports reachable.
  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/projects`);
      return res.status < 500;
    } catch {
      return false;
    }
  }

  // ---- Projects ----
  listProjects() {
    return this.request<Project[]>('GET', '/projects');
  }
  getProject(id: string) {
    return this.request<Project>('GET', `/projects/${id}`);
  }
  createProject(body: { name: string; repoPath: string; language?: string }) {
    return this.request<Project>('POST', '/projects', body);
  }
  deleteProject(id: string) {
    return this.request<void>('DELETE', `/projects/${id}`);
  }
  scanProject(id: string) {
    return this.request<ScanResult>('POST', `/projects/${id}/scan`);
  }

  // ---- Files / Bundles ----
  listFiles(projectId: string, language?: string) {
    const q = language ? `?language=${encodeURIComponent(language)}` : '';
    return this.request<SourceFile[]>('GET', `/projects/${projectId}/files${q}`);
  }
  listBundles(projectId: string) {
    return this.request<AnalysisBundle[]>('GET', `/projects/${projectId}/bundles`);
  }
  buildBundles(projectId: string) {
    return this.request<BundleBuildResult>('POST', `/projects/${projectId}/bundles`);
  }

  // ---- Questions ----
  listQuestions(language?: string) {
    const q = language ? `?language=${encodeURIComponent(language)}` : '';
    return this.request<Question[]>('GET', `/questions${q}`);
  }

  // ---- Runs / Jobs / Answers ----
  listRuns(projectId: string) {
    return this.request<AnalysisRun[]>('GET', `/projects/${projectId}/runs`);
  }
  createRun(
    projectId: string,
    body: { providerId: string; questionIds?: string[]; priority?: number },
  ) {
    return this.request<RunCreateResult>('POST', `/projects/${projectId}/runs`, body);
  }
  getRun(runId: string) {
    return this.request<AnalysisRun>('GET', `/runs/${runId}`);
  }
  listRunJobs(runId: string, status?: string) {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<AnalysisJob[]>('GET', `/runs/${runId}/jobs${q}`);
  }
  listRunAnswers(runId: string) {
    return this.request<AnalysisAnswer[]>('GET', `/runs/${runId}/answers`);
  }

  // ---- Exports ----
  listExports(projectId: string) {
    return this.request<ExportRecord[]>('GET', `/projects/${projectId}/exports`);
  }
  createExport(
    projectId: string,
    body: { format: 'json' | 'csv' | 'markdown'; runId?: string },
  ) {
    return this.request<ExportRecord>('POST', `/projects/${projectId}/exports`, body);
  }
}
