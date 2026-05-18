import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { finished } from 'stream/promises';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { streamRecords } from './recordIterator';
import { writeJson } from './jsonExporter';
import { writeCsv } from './csvExporter';
import { writeMarkdown } from './markdownExporter';

export type ExportFormat = 'json' | 'csv' | 'markdown';

const EXTENSIONS: Record<ExportFormat, string> = {
  json: 'json',
  csv: 'csv',
  markdown: 'md',
};

export type RunExportOptions = {
  projectId: string;
  format: ExportFormat;
  runId?: string;
  outputDir?: string;
};

export async function runExport(opts: RunExportOptions) {
  const project = await prisma.project.findUnique({ where: { id: opts.projectId } });
  if (!project) {
    throw new Error(`Project not found: ${opts.projectId}`);
  }

  if (opts.runId) {
    const run = await prisma.analysisRun.findUnique({ where: { id: opts.runId } });
    if (!run || run.projectId !== project.id) {
      throw new Error(`Run not found for project: ${opts.runId}`);
    }
  }

  const baseDir = opts.outputDir ?? env.EXPORT_ROOT;
  const outDir = path.resolve(baseDir, project.id);
  await fsp.mkdir(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const scope = opts.runId ?? 'all';
  const filename = `${scope}-${timestamp}.${EXTENSIONS[opts.format]}`;
  const filePath = path.join(outDir, filename);

  const writeStream = fs.createWriteStream(filePath, { encoding: 'utf-8' });

  try {
    const records = streamRecords({ projectId: project.id, runId: opts.runId });
    switch (opts.format) {
      case 'json':
        await writeJson(writeStream, records);
        break;
      case 'csv':
        await writeCsv(writeStream, records);
        break;
      case 'markdown':
        await writeMarkdown(writeStream, records, project);
        break;
    }
  } catch (err) {
    writeStream.destroy();
    await fsp.unlink(filePath).catch(() => undefined);
    throw err;
  }

  writeStream.end();
  await finished(writeStream);

  const stat = await fsp.stat(filePath);

  return prisma.export.create({
    data: {
      projectId: project.id,
      format: opts.format,
      filePath,
      sizeBytes: stat.size,
      metadata: { runId: opts.runId ?? null },
    },
  });
}
