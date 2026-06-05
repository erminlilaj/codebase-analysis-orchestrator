import type { ProviderHealth } from './common/AnalysisProvider';
import type { AnalysisProvider } from './common/AnalysisProvider';
import { projectConfig } from '../config/projectConfig';
import { StubProvider } from './stub/StubProvider';
import { checkBobProviderHealth } from './bob/BobProviderHealth';
import { BobShellProvider } from './bob/BobShellProvider';
import { checkOpenCodeProviderHealth } from './opencode/OpenCodeProviderHealth';
import { OpenCodeShellProvider } from './opencode/OpenCodeShellProvider';
import { checkOllamaProviderHealth } from './ollama/OllamaProviderHealth';
import { OllamaHttpProvider } from './ollama/OllamaHttpProvider';

export const knownProviderIds = ['stub', 'bob', 'opencode', 'ollama'] as const;
export type KnownProviderId = (typeof knownProviderIds)[number];

export function isKnownProviderId(providerId: string): providerId is KnownProviderId {
  return (knownProviderIds as readonly string[]).includes(providerId);
}

export async function getProviderHealth(providerId: string): Promise<ProviderHealth | undefined> {
  if (providerId === 'stub') return new StubProvider().health();
  if (providerId === 'bob') return checkBobProviderHealth(projectConfig.bob);
  if (providerId === 'opencode') return checkOpenCodeProviderHealth(projectConfig.opencode);
  if (providerId === 'ollama') return checkOllamaProviderHealth(projectConfig.ollama);
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

// Provider runtime overrides assembled per job by the worker: per-run model/
// agent (from AnalysisRun.metadata) and provider credentials (from the DB).
export type ProviderConfigOverrides = {
  model?: string;
  agent?: string;
  credentials?: Record<string, string>;
};

export function getProvider(
  providerId: string,
  overrides?: ProviderConfigOverrides,
): AnalysisProvider | undefined {
  if (providerId === 'stub') return new StubProvider();
  if (providerId === 'bob') return new BobShellProvider(projectConfig.bob);
  if (providerId === 'opencode') {
    return new OpenCodeShellProvider({
      ...projectConfig.opencode,
      ...(overrides?.model ? { model: overrides.model } : {}),
      ...(overrides?.agent ? { agent: overrides.agent } : {}),
      ...(overrides?.credentials ? { extraEnv: overrides.credentials } : {}),
    });
  }
  if (providerId === 'ollama') {
    return new OllamaHttpProvider({
      ...projectConfig.ollama,
      ...(overrides?.model ? { model: overrides.model } : {}),
    });
  }
  return undefined;
}
