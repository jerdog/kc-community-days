#!/usr/bin/env node
// npm run restore -- <backup.json>
// Writes the backup's files back (site.config.json, Sessionize data, archives) and removes
// archived years the backup doesn't have. Backs up the current state first.
import { readFile, readdir, rm, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { checkBackup, summary } from '../src/lib/backup.js';
import { writeLocalBackup, root } from './lib/local-backup.mjs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run restore -- backups/<file>.json');
  process.exit(1);
}
const backup = JSON.parse(await readFile(resolve(process.cwd(), file), 'utf8'));
const problems = checkBackup(backup);
if (problems.length) {
  console.error(`restore: can’t restore ${file}:\n${problems.map((p) => `  • ${p}`).join('\n')}`);
  process.exit(1);
}
const safety = await writeLocalBackup(`Before restoring ${file}`);
console.log(`Saved the current state first → ${safety.path}`);

const keepYears = new Set(Object.keys(backup.files).filter((p) => p.startsWith('archive/')).map((p) => p.split('/')[1]));
for (const y of (await readdir(resolve(root, 'archive')).catch(() => [])).filter((d) => /^\d{4}$/.test(d) && !keepYears.has(d))) {
  await rm(resolve(root, 'archive', y), { recursive: true });
  console.log(`Removed archive/${y}/ (not in the backup)`);
}
for (const [p, value] of Object.entries(backup.files)) {
  await mkdir(dirname(resolve(root, p)), { recursive: true });
  await writeFile(resolve(root, p), JSON.stringify(value, null, 2) + '\n');
}
console.log(`Restored ${summary(backup)} from ${backup.createdAt} (${backup.reason}).`);
