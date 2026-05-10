import type { ContextResolver, SourceFile } from './ContextResolver';
import { CobolResolver } from '../cobol/CobolResolver';
import { GenericResolver } from '../generic/GenericResolver';

// Ordered list — first resolver that supports a file wins.
// GenericResolver must be last because it accepts everything.
const RESOLVERS: readonly ContextResolver[] = [
  new CobolResolver(),
  new GenericResolver(),
];

export function selectResolver(file: SourceFile): ContextResolver {
  return RESOLVERS.find((r) => r.supports(file)) ?? new GenericResolver();
}
