import fs from 'node:fs';
import type { ContextResolver, SourceFile, AnalysisBundle } from '../common/ContextResolver';
import { parseCopyStatements } from './parseCopyStatements';
import { resolveCopybooks } from './resolveCopybooks';

const COBOL_EXTENSIONS = new Set(['.cob', '.cbl', '.cpy', '.copy', '.pco']);

export class CobolResolver implements ContextResolver {
  readonly language = 'cobol';

  supports(file: SourceFile): boolean {
    return COBOL_EXTENSIONS.has(file.extension.toLowerCase());
  }

  async resolve(file: SourceFile, allFiles: SourceFile[]): Promise<AnalysisBundle> {
    const source = fs.readFileSync(file.path, 'utf8');
    const copyNames = parseCopyStatements(source);
    const { resolved, unresolved } = resolveCopybooks(copyNames, allFiles);

    return {
      mainFile: file,
      contextFiles: resolved,
      unresolvedDependencies: unresolved,
      metadata: {
        resolver: 'cobol',
        copyNamesFound: copyNames,
        resolvedCount: resolved.length,
        unresolvedCount: unresolved.length,
      },
    };
  }
}
