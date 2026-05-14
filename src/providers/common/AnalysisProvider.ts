import type {
  ProviderAnalysisInput,
  ProviderAnalysisResult,
  AnalysisQuestion,
  ProviderHealth,
} from './types';

export type { ProviderAnalysisInput, ProviderAnalysisResult, AnalysisQuestion, ProviderHealth };

export interface AnalysisProvider {
  /** Stable identifier for this provider, e.g. "bob", "openai". */
  readonly id: string;

  /** Human-readable name shown in logs and exports. */
  readonly displayName: string;

  /**
   * Runs one analysis job and returns the raw output plus any structured
   * extraction the provider can produce.
   */
  analyze(input: ProviderAnalysisInput): Promise<ProviderAnalysisResult>;

  /**
   * Optional readiness check. API routes may use this before creating jobs so
   * unavailable providers fail fast instead of producing a queue of doomed jobs.
   */
  health?(): Promise<ProviderHealth>;
}
