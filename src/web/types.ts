// Shapes matching the REST API responses. Dates come back as ISO strings.

export type Project = {
  id: string;
  name: string;
  repoPath: string;
  language: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type SourceFile = {
  id: string;
  projectId: string;
  relativePath: string;
  language: string;
  sizeBytes: number | null;
  createdAt: string;
};

export type Question = {
  id: string;
  key: string;
  text: string;
  language: string | null;
  createdAt: string;
};

export type JobStatus = 'pending' | 'claimed' | 'running' | 'completed' | 'failed' | 'cancelled' | 'blocked';

export type AnalysisRun = {
  id: string;
  projectId: string;
  status: JobStatus;
  startedAt: string | null;
  finishedAt: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type AnalysisJob = {
  id: string;
  runId: string;
  bundleId: string;
  questionId: string;
  providerId: string;
  status: JobStatus;
  priority: number;
  attempts: number;
  lastError: string | null;
  failureKind: string | null;
  createdAt: string;
  question?: Question;
  answer?: AnalysisAnswer;
};

export type AnalysisAnswer = {
  id: string;
  jobId: string;
  rawOutput: string;
  parsed: unknown;
  modelId: string | null;
  tokensUsed: number | null;
  createdAt: string;
  job?: AnalysisJob & { question: Question };
};

export type AnalysisBundle = {
  id: string;
  projectId: string;
  name: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  files?: Array<{ role: string; file: SourceFile }>;
};

export type ExportRecord = {
  id: string;
  projectId: string;
  format: 'json' | 'csv' | 'markdown';
  filePath: string;
  sizeBytes: number | null;
  createdAt: string;
};

export type RunCreateResult = { run: AnalysisRun; jobCount: number };
export type ScanResult = { filesFound: number };
export type BundleBuildResult = { bundlesCreated: number; message?: string };

export type ProviderHealth = {
  providerId: string;
  name: string;
  type: string;
  configured: boolean;
  enabled: boolean;
  available: boolean;
  retryable: boolean;
  reason?: string;
  details?: Record<string, unknown>;
};

export type ProviderCredential = {
  envVar: string;
  valuePreview: string;
  updatedAt: string;
};

export type FsEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
};

export type FsListResponse = {
  path: string;
  parent: string | null;
  entries: FsEntry[];
};
