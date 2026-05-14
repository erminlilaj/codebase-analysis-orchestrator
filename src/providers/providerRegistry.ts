import type { ProviderHealth } from './common/AnalysisProvider';
import { projectConfig } from '../config/projectConfig';
import { StubProvider } from './stub/StubProvider';
import { checkBobProviderHealth } from './bob/BobProviderHealth';

export const knownProviderIds = ['stub', 'bob'] as const;
export type KnownProviderId = (typeof knownProviderIds)[number];

export function isKnownProviderId(providerId: string): providerId is KnownProviderId {
  return (knownProviderIds as readonly string[]).includes(providerId);
}

export async function getProviderHealth(providerId: string): Promise<ProviderHealth | undefined> {
  if (providerId === 'stub') return new StubProvider().health();
  if (providerId === 'bob') return checkBobProviderHealth(projectConfig.bob);
  return undefined;
}
