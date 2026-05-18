import { prisma } from '../../db/prisma';

export type ExportRecord = {
  projectId: string;
  projectName: string;
  runId: string;
  runStatus: string;
  jobId: string;
  jobStatus: string;
  bundleId: string;
  mainFilePath: string | null;
  mainFileLanguage: string | null;
  questionKey: string;
  questionText: string;
  questionLanguage: string | null;
  stale: boolean;
  providerId: string;
  attempts: number;
  lastError: string | null;
  failureKind: string | null;
  modelId: string | null;
  tokensUsed: number | null;
  rawOutput: string | null;
  parsedJson: unknown;
  answeredAt: string | null;
  jobCreatedAt: string;
};

const PAGE_SIZE = 200;

export async function* streamRecords(opts: {
  projectId: string;
  runId?: string;
  pageSize?: number;
}): AsyncGenerator<ExportRecord> {
  const project = await prisma.project.findUnique({ where: { id: opts.projectId } });
  if (!project) return;

  const take = opts.pageSize ?? PAGE_SIZE;
  let offset = 0;

  while (true) {
    const jobs = await prisma.analysisJob.findMany({
      where: {
        bundle: { projectId: opts.projectId },
        ...(opts.runId ? { runId: opts.runId } : {}),
      },
      include: {
        question: true,
        answer: true,
        run: true,
        bundle: {
          include: {
            files: { where: { role: 'main' }, include: { file: true }, take: 1 },
          },
        },
      },
      orderBy: [{ runId: 'asc' }, { id: 'asc' }],
      take,
      skip: offset,
    });

    if (jobs.length === 0) break;

    for (const job of jobs) {
      const mainBundleFile = job.bundle.files[0];
      yield {
        projectId: project.id,
        projectName: project.name,
        runId: job.runId,
        runStatus: job.run.status,
        jobId: job.id,
        jobStatus: job.status,
        bundleId: job.bundleId,
        mainFilePath: mainBundleFile?.file.relativePath ?? null,
        mainFileLanguage: mainBundleFile?.file.language ?? null,
        questionKey: job.question.key,
        questionText: job.question.text,
        questionLanguage: job.question.language ?? null,
        stale: job.questionVersion < job.question.version,
        providerId: job.providerId,
        attempts: job.attempts,
        lastError: job.lastError ?? null,
        failureKind: job.failureKind ?? null,
        modelId: job.answer?.modelId ?? null,
        tokensUsed: job.answer?.tokensUsed ?? null,
        rawOutput: job.answer?.rawOutput ?? null,
        parsedJson: job.answer?.parsed ?? null,
        answeredAt: job.answer?.createdAt.toISOString() ?? null,
        jobCreatedAt: job.createdAt.toISOString(),
      };
    }

    if (jobs.length < take) break;
    offset += jobs.length;
  }
}
