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

export async function listProviderHealth(): Promise<Record<KnownProviderId, ProviderHealth>> {
  const entries = await Promise.all(
    knownProviderIds.map(async (providerId) => {
      const health = await getProviderHealth(providerId);
      if (!health) throw new Error(`Known provider has no health check: ${providerId}`);
      return [providerId, health] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<KnownProviderId, ProviderHealth>;
}
