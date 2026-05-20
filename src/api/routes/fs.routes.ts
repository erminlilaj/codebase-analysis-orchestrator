import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { FastifyInstance } from 'fastify';

export type FsEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
};

export type FsListResponse = {
  path: string;
  parent: string | null;
  entries: FsEntry[];
};

// Local-only, single-user. Lists directory contents on the server filesystem
// so the web UI can drive a path picker for project.repoPath.
export async function fsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { path?: string } }>('/fs/list', async (req, reply) => {
    const target = req.query.path?.trim() || os.homedir();
    let abs: string;
    try {
      abs = path.resolve(target);
      const stat = await fs.stat(abs);
      if (!stat.isDirectory()) {
        return reply.code(400).send({ error: `Not a directory: ${target}` });
      }
    } catch {
      return reply.code(404).send({ error: `Path not found: ${target}` });
    }

    let dirents;
    try {
      dirents = await fs.readdir(abs, { withFileTypes: true });
    } catch {
      return reply.code(403).send({ error: `Cannot read directory: ${target}` });
    }

    const entries: FsEntry[] = dirents
      .filter((d) => !d.name.startsWith('.')) // hide dotfiles by default
      .map((d) => ({
        name: d.name,
        path: path.join(abs, d.name),
        isDirectory: d.isDirectory(),
        isFile: d.isFile(),
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    const parent = path.dirname(abs);
    const response: FsListResponse = {
      path: abs,
      parent: parent !== abs ? parent : null,
      entries,
    };
    return response;
  });

  app.get('/fs/home', async () => ({ path: os.homedir() }));
}
