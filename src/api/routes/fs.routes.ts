import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { FastifyInstance } from 'fastify';

async function dirExists(p: string): Promise<boolean> {
  try { return (await fs.stat(p)).isDirectory(); } catch { return false; }
}

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

export type FsRoot = { label: string; path: string };

// Local-only, single-user. Lists directory contents on the server filesystem
// so the web UI can drive a path picker for project.repoPath.
export async function fsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { path?: string; showHidden?: string } }>('/fs/list', async (req, reply) => {
    const target = req.query.path?.trim() || os.homedir();
    const showHidden = req.query.showHidden === 'true';

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
      .filter((d) => showHidden || !d.name.startsWith('.'))
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

  // Returns useful quick-access roots: home directory, /repositories (Docker
  // bind mount point for repos), and — when WINDOWS_HOME is mounted at
  // /windows/home — the Windows home plus Desktop/Documents/Downloads.
  app.get('/fs/roots', async () => {
    const roots: FsRoot[] = [{ label: 'Home', path: os.homedir() }];

    if (await dirExists('/repositories')) {
      roots.push({ label: 'Repositories', path: '/repositories' });
    }

    const winHome = '/windows/home';
    if (await dirExists(winHome)) {
      // Only advertise if the directory actually contains something — the
      // placeholder created when WINDOWS_HOME is unset is empty.
      const entries = await fs.readdir(winHome).catch(() => [] as string[]);
      if (entries.length > 0) {
        roots.push({ label: 'Windows Home', path: winHome });
        for (const sub of ['Desktop', 'Documents', 'Downloads']) {
          if (await dirExists(`${winHome}/${sub}`)) {
            roots.push({ label: sub, path: `${winHome}/${sub}` });
          }
        }
      }
    }

    return roots;
  });
}
