// Read the current files into a backup and write it to backups/ (git-ignored).
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { makeBackup, backupFileName, CONFIG, DATA } from '../../src/lib/backup.js';

export const root = resolve(import.meta.dirname, '..', '..');
const readJson = async (p) => JSON.parse(await readFile(resolve(root, p), 'utf8'));

export async function currentFiles() {
  const files = { [CONFIG]: await readJson(CONFIG), [DATA]: await readJson(DATA) };
  for (const y of (await readdir(resolve(root, 'archive')).catch(() => [])).filter((d) => /^\d{4}$/.test(d))) {
    for (const f of ['config.json', 'sessionize.json']) {
      try {
        files[`archive/${y}/${f}`] = await readJson(`archive/${y}/${f}`);
      } catch {}
    }
  }
  return files;
}

export async function writeLocalBackup(reason) {
  let who = 'local';
  let commit = null;
  try {
    who = execSync('git config user.name', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || who;
    commit = execSync('git rev-parse HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {}
  const backup = makeBackup(await currentFiles(), { createdBy: who, reason, commit });
  await mkdir(resolve(root, 'backups'), { recursive: true });
  // Never overwrite an earlier backup.
  let name = backupFileName(backup);
  for (let n = 2; await access(resolve(root, 'backups', name)).then(() => true, () => false); n++) name = backupFileName(backup).replace(/\.json$/, `-${n}.json`);
  await writeFile(resolve(root, 'backups', name), JSON.stringify(backup, null, 2) + '\n');
  return { backup, path: `backups/${name}` };
}
