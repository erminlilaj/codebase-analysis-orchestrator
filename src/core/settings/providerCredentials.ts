import { prisma } from '../../db/prisma';

/**
 * Loads all stored provider credentials as a flat environment-variable map,
 * for injection into provider CLI subprocesses (e.g. OpenCode reads
 * `DEEPSEEK_API_KEY` from its process environment).
 */
export async function loadProviderCredentials(): Promise<Record<string, string>> {
  const rows = await prisma.providerCredential.findMany();
  const env: Record<string, string> = {};
  for (const row of rows) env[row.envVar] = row.value;
  return env;
}
