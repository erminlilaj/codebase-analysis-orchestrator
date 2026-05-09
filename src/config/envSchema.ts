import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Bob Shell provider — validated by the provider adapter at runtime
  BOBSHELL_API_KEY: z.string().optional(),
  BOB_COMMAND: z.string().default('bob'),

  // Filesystem
  WORKSPACE_ROOT: z.string().default('tmp/workspaces'),
  EXPORT_ROOT: z.string().default('exports'),

  // Worker
  JOB_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  JOB_STALE_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(300),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(4),
});

export type Env = z.infer<typeof envSchema>;
