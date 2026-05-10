import type { SourceFile, AnalysisBundle } from './types';

export type { SourceFile, AnalysisBundle };

export interface ContextResolver {
  /** Language identifier this resolver handles, e.g. "cobol", "java". */
  readonly language: string;

  /** Returns true if this resolver can handle the given file. */
  supports(file: SourceFile): boolean;

  /**
   * Resolves the main file into an analysis bundle.
   *
   * @param file      The primary source file to analyse.
   * @param allFiles  All known source files for the project (used to locate
   *                  dependencies and context files).
   */
  resolve(file: SourceFile, allFiles: SourceFile[]): Promise<AnalysisBundle>;
}
