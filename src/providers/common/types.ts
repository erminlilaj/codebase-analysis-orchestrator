import type { AnalysisBundle } from '../../languages/common/types';

export type { AnalysisBundle };

export type AnalysisQuestion = {
  id: string;
  key: string;
  text: string;
};

export type ProviderAnalysisInput = {
  jobId: string;
  projectId: string;
  bundle: AnalysisBundle;
  question: AnalysisQuestion;
  workspacePath: string;
  metadata: Record<string, unknown>;
};

export type ProviderAnalysisResult = {
  rawOutput: string;
  parsedAnswer: unknown;
  metadata: Record<string, unknown>;
};
