import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { SourceFile } from '../../languages/common/types';
import { detectLanguage } from '../../languages/common/LanguageDetector';

// ScannedFile is a SourceFile without DB-assigned fields — those are set when
// the record is persisted by the core/files service layer.
export type ScannedFile = Omit<SourceFile, 'id' | 'projectId'>;

export type ScanOptions = {
  /** Directory names to skip in addition to the built-in defaults. */
  excludeDirs?: string[];
};

const DEFAULT_EXCLUDE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  'target',
  '.venv',
  'venv',
  'env',
  'vendor',
  '__pycache__',
  'coverage',
  '.nyc_output',
  '.next',
  '.turbo',
  'tmp',
  'exports',
]);

function sha256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Walks `repoPath` recursively and returns metadata for every file found,
 * skipping common non-source directories.
 *
 * Reads file content to compute SHA-256 checksums — suitable for repositories
 * up to hundreds of MB. For very large repositories consider streaming reads.
 */
export function scanDirectory(repoPath: string, options: ScanOptions = {}): ScannedFile[] {
  const excludeDirs = new Set([
    ...DEFAULT_EXCLUDE_DIRS,
    ...(options.excludeDirs ?? []),
  ]);

  const results: ScannedFile[] = [];

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // skip directories we cannot read
    }

    for (const entry of entries) {
      if (excludeDirs.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const stat = fs.statSync(fullPath);
        const ext = path.extname(entry.name).toLowerCase();

        results.push({
          path: fullPath,
          relativePath: path.relative(repoPath, fullPath),
          filename: entry.name,
          extension: ext,
          language: detectLanguage(entry.name),
          checksum: sha256(fullPath),
          sizeBytes: stat.size,
        });
      }
    }
  }

  walk(repoPath);
  return results;
}
