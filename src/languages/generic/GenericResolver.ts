import type { ContextResolver, SourceFile, AnalysisBundle } from '../common/ContextResolver';

export class GenericResolver implements ContextResolver {
  readonly language = 'generic';

  supports(_file: SourceFile): boolean {
    return true; // fallback — accepts anything
  }

  async resolve(file: SourceFile, _allFiles: SourceFile[]): Promise<AnalysisBundle> {
    return {
      mainFile: file,
      contextFiles: [],
      unresolvedDependencies: [],
      metadata: { resolver: 'generic', fallback: true },
    };
  }
}
