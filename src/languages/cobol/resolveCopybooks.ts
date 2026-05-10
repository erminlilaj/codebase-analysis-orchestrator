import path from 'node:path';
import type { SourceFile } from '../common/types';

export type CopybookResolution = {
  resolved: SourceFile[];
  unresolved: string[];
};

/**
 * Matches copybook names from COPY statements against the known project files.
 *
 * Matching is case-insensitive on the base filename (without extension).
 * A name like "UTILS" will match "UTILS.cpy", "utils.cbl", "UTILS.copy", etc.
 */
export function resolveCopybooks(
  names: string[],
  allFiles: SourceFile[],
): CopybookResolution {
  // Build a lookup: uppercase base name -> SourceFile (first match wins)
  const byBaseName = new Map<string, SourceFile>();
  for (const f of allFiles) {
    const base = path.basename(f.filename, f.extension).toUpperCase();
    if (!byBaseName.has(base)) {
      byBaseName.set(base, f);
    }
  }

  const resolved: SourceFile[] = [];
  const unresolved: string[] = [];

  for (const name of names) {
    const upper = name.toUpperCase();
    const file = byBaseName.get(upper);
    if (file) {
      resolved.push(file);
    } else {
      unresolved.push(name);
    }
  }

  return { resolved, unresolved };
}
