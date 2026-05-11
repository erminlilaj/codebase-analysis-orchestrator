import path from 'path';
import fs from 'fs/promises';
import type { AnalysisBundle } from '../languages/common/types';

export class WorkspaceBuilder {
  constructor(private readonly workspaceRoot: string) {}

  /**
   * Creates an isolated directory under workspaceRoot/<jobId>/ containing
   * only the main source file and its resolved context files, preserving
   * the relative paths from the source repository.
   *
   * Returns the workspace root path so the provider knows where to find files.
   */
  async build(jobId: string, bundle: AnalysisBundle): Promise<string> {
    const wsPath = path.join(this.workspaceRoot, jobId);
    const files = [bundle.mainFile, ...bundle.contextFiles];

    for (const file of files) {
      const dest = path.join(wsPath, file.relativePath);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(file.path, dest);
    }

    return wsPath;
  }

  /**
   * Removes the workspace directory for the given job.
   * Safe to call even if the directory no longer exists.
   */
  async cleanup(jobId: string): Promise<void> {
    const wsPath = path.join(this.workspaceRoot, jobId);
    await fs.rm(wsPath, { recursive: true, force: true });
  }
}
