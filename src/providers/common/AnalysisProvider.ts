import type { ProviderAnalysisInput, ProviderAnalysisResult, AnalysisQuestion } from './types';

export type { ProviderAnalysisInput, ProviderAnalysisResult, AnalysisQuestion };

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
}
