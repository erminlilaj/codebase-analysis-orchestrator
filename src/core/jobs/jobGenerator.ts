import { prisma } from '../../db/prisma';

const BATCH_SIZE = 500;

export type GenerateJobsParams = {
  runId: string;
  bundleIds: string[];
  questionIds: string[];
  providerId: string;
  priority?: number;
};

type JobData = {
  runId: string;
  bundleId: string;
  questionId: string;
  providerId: string;
  priority: number;
};

// Yields batches of the bundle × question cross-product without materialising
// the full list. Keeps memory flat regardless of input size.
function* jobBatches(params: Required<GenerateJobsParams>): Generator<JobData[]> {
  const { runId, bundleIds, questionIds, providerId, priority } = params;
  let batch: JobData[] = [];

  for (const bundleId of bundleIds) {
    for (const questionId of questionIds) {
      batch.push({ runId, bundleId, questionId, providerId, priority });
      if (batch.length === BATCH_SIZE) {
        yield batch;
        batch = [];
      }
    }
  }

  if (batch.length > 0) yield batch;
}

/**
 * Creates one AnalysisJob per (bundle, question) pair and returns the total
 * number of jobs inserted. Inserts in batches of 500 to avoid large payloads.
 */
export async function generateJobs(params: GenerateJobsParams): Promise<number> {
  const { runId, bundleIds, questionIds, providerId, priority = 0 } = params;

  if (bundleIds.length === 0 || questionIds.length === 0) return 0;

  let total = 0;
  for (const batch of jobBatches({ runId, bundleIds, questionIds, providerId, priority })) {
    const { count } = await prisma.analysisJob.createMany({ data: batch });
    total += count;
  }

  return total;
}
