import 'dotenv/config';
import { envSchema } from './envSchema';

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const lines = result.error.issues.map(
    (issue) => `  ${issue.path.join('.')}: ${issue.message}`,
  );
  process.stderr.write(
    `Missing or invalid environment variables:\n${lines.join('\n')}\n`,
  );
  process.exit(1);
}

export const env = result.data;
