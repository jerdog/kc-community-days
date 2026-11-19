// Backups of everything the admin page and `npm run new-year` can change.
// One JSON object, the same whether made by the CLI or the admin page, so either can restore it:
//   { type, version, createdAt, createdBy, reason, commit, files: { "<path>": <parsed JSON> } }
// Files: site.config.json, src/data/sessionize.json, archive/<year>/config.json + sessionize.json.
import { validateConfig } from './config-schema.js';

export const BACKUP_TYPE = 'communitydays-backup';
export const CONFIG = 'site.config.json';
export const DATA = 'src/data/sessionize.json';
export const isBackedUpPath = (p) => p === CONFIG || p === DATA || /^archive\/\d{4}\/(config|sessionize)\.json$/.test(p);

export function makeBackup(files, { createdBy = 'unknown', reason = 'Manual backup', commit = null } = {}) {
  return { type: BACKUP_TYPE, version: 1, createdAt: new Date().toISOString(), createdBy, reason, commit, files };
}

// Returns a list of problems; empty means the backup can be restored.
export function checkBackup(b) {
  if (!b || b.type !== BACKUP_TYPE || b.version !== 1 || typeof b.files !== 'object') return ['This isn’t a CommunityDays backup file.'];
  const problems = [];
  const paths = Object.keys(b.files);
  for (const p of paths) if (!isBackedUpPath(p)) problems.push(`Unexpected file in backup: ${p}`);
  if (!b.files[CONFIG]) problems.push(`The backup has no ${CONFIG}.`);
  else for (const e of validateConfig(b.files[CONFIG])) problems.push(`${CONFIG}: ${e.path}: ${e.message}`);
  for (const p of paths.filter((x) => /^archive\/\d{4}\/config\.json$/.test(x))) {
    const year = Number(p.split('/')[1]);
    const cfg = b.files[p];
    for (const e of validateConfig({ ...cfg, event: { ...cfg.event, year } }, { archived: true })) problems.push(`${p}: ${e.path}: ${e.message}`);
  }
  return problems;
}

export const backupFileName = (b) => `communitydays-backup-${b.createdAt.replace(/[:.]/g, '-')}.json`;
export const summary = (b) => {
  const years = Object.keys(b.files).filter((p) => p.endsWith('/config.json')).map((p) => p.split('/')[1]);
  return `${b.files[CONFIG]?.event?.year ?? '?'} settings${years.length ? `, archives ${years.sort().join(', ')}` : ''}`;
};
