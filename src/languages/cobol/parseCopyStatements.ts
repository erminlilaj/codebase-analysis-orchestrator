// Matches: COPY name. / COPY name IN lib. / COPY "name". (fixed and free format)
// Captures the copybook name (group 1), ignoring the optional IN/OF library clause.
const COPY_RE = /\bCOPY\s+(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9#@$-]+))(?:\s+(?:IN|OF)\s+\S+)?\s*\./gi;

/**
 * Extracts all copybook names referenced by COPY statements in COBOL source.
 * Returns names uppercased and deduplicated, preserving first-seen order.
 */
export function parseCopyStatements(source: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  let match: RegExpExecArray | null;
  COPY_RE.lastIndex = 0;

  while ((match = COPY_RE.exec(source)) !== null) {
    // group 1 = double-quoted, group 2 = single-quoted, group 3 = bare name
    const raw = (match[1] ?? match[2] ?? match[3]).toUpperCase();
    if (!seen.has(raw)) {
      seen.add(raw);
      names.push(raw);
    }
  }

  return names;
}
