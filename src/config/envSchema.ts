import { z } from 'zod';

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  if (['true', '1', 'yes', 'on'].includes(value.toLowerCase())) return true;
  if (['false', '0', 'no', 'off'].includes(value.toLowerCase())) return false;
  return value;
}, z.boolean());

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Bob Shell provider — validated by the provider adapter at runtime
  BOBSHELL_API_KEY: z.string().optional(),
  BOB_COMMAND: z.string().default('bob'),
  BOB_PROVIDER_ENABLED: booleanFromEnv.default(false),
  BOB_TIMEOUT_MS: z.coerce.number().int().positive().default(180000),
  BOB_MAX_BUFFER_MB: z.coerce.number().int().positive().default(20),
  BOB_MAX_INLINE_BYTES: z.coerce.number().int().positive().default(51200),

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
