import type { Writable } from 'stream';
import type { Project } from '@prisma/client';
import type { ExportRecord } from './recordIterator';
import { writeAsync } from './streamWriter';

export async function writeMarkdown(
  out: Writable,
  records: AsyncIterable<ExportRecord>,
  project: Pick<Project, 'id' | 'name' | 'repoPath' | 'language'>,
): Promise<void> {
  await writeAsync(out, `# Analysis Results — ${project.name}\n\n`);
  await writeAsync(out, `- **Project ID:** \`${project.id}\`\n`);
  await writeAsync(out, `- **Repository:** \`${project.repoPath}\`\n`);
  await writeAsync(out, `- **Language:** ${project.language}\n\n`);

  let count = 0;
  let currentRunId: string | null = null;

  for await (const r of records) {
    count++;
    if (r.runId !== currentRunId) {
      currentRunId = r.runId;
      await writeAsync(out, `## Run \`${r.runId}\` — ${r.runStatus}\n\n`);
    }

    const mainLabel = r.mainFilePath ?? '(no main file)';
    await writeAsync(out, `### ${mainLabel} — ${r.questionKey}\n\n`);
    await writeAsync(out, `- **Job:** \`${r.jobId}\` (${r.jobStatus})\n`);
    await writeAsync(out, `- **Provider:** ${r.providerId}\n`);
    await writeAsync(out, `- **Question:** ${r.questionText}\n`);
    if (r.stale) {
      await writeAsync(out, `- **Stale:** question was updated after this answer was produced\n`);
    }
    if (r.modelId) await writeAsync(out, `- **Model:** ${r.modelId}\n`);
    if (r.tokensUsed != null) await writeAsync(out, `- **Tokens used:** ${r.tokensUsed}\n`);
    await writeAsync(out, `- **Attempts:** ${r.attempts}\n`);
    if (r.lastError) await writeAsync(out, `- **Error:** ${r.lastError}\n`);
    if (r.failureKind) await writeAsync(out, `- **Failure kind:** ${r.failureKind}\n`);
    await writeAsync(out, '\n');

    if (r.rawOutput) {
      await writeAsync(out, '**Answer:**\n\n');
      await writeAsync(out, '```\n');
      await writeAsync(out, r.rawOutput);
      if (!r.rawOutput.endsWith('\n')) await writeAsync(out, '\n');
      await writeAsync(out, '```\n\n');
    } else {
      await writeAsync(out, '_No answer available._\n\n');
    }
  }

  if (count === 0) {
    await writeAsync(out, '_No analysis records found._\n');
  }
}
