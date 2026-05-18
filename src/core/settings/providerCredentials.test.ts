import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/prisma', () => ({
  prisma: { providerCredential: { findMany: vi.fn() } },
}));

import { loadProviderCredentials } from './providerCredentials';
import { prisma } from '../../db/prisma';

const mockFindMany = vi.mocked(prisma.providerCredential.findMany);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadProviderCredentials', () => {
  it('maps stored rows to an env-var record', async () => {
    mockFindMany.mockResolvedValue([
      { envVar: 'DEEPSEEK_API_KEY', value: 'sk-deepseek' },
      { envVar: 'OPENAI_API_KEY', value: 'sk-openai' },
    ] as any);

    const env = await loadProviderCredentials();

    expect(env).toEqual({
      DEEPSEEK_API_KEY: 'sk-deepseek',
      OPENAI_API_KEY: 'sk-openai',
    });
  });

  it('returns an empty object when no credentials are stored', async () => {
    mockFindMany.mockResolvedValue([] as any);
    expect(await loadProviderCredentials()).toEqual({});
  });
});
