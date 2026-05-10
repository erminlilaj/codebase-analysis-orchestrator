export type SourceFile = {
  id: string;
  projectId: string;
  path: string;         // absolute path on disk
  relativePath: string; // path relative to project root
  filename: string;
  extension: string;
  language: string | null;
  checksum: string;
  sizeBytes?: number;
};

export type AnalysisBundle = {
  mainFile: SourceFile;
  contextFiles: SourceFile[];
  unresolvedDependencies: string[];
  metadata: Record<string, unknown>;
};
