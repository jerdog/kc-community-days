// Admin backups, stored gzip-compressed in the D1 `backups` table (migrations/0002_backups.sql).
import { makeBackup, isBackedUpPath, summary, CONFIG, DATA } from '../../src/lib/backup.js';

const KEEP = 50; // newest backups kept; older ones are deleted when a new one is saved

async function gzip(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

// Every backed-up file at a git ref.
export async function filesAt(gh, ref) {
  const files = {};
  const read = async (p) => {
    const t = await gh.readText(p, ref);
    if (t != null) files[p] = JSON.parse(t);
  };
  await Promise.all([read(CONFIG), read(DATA)]);
  const years = (await gh.listDir('archive', ref)).filter((d) => d.type === 'dir' && /^\d{4}$/.test(d.name));
  for (const y of years) {
    for (const f of await gh.listDir(`archive/${y.name}`, ref)) {
      const p = `archive/${y.name}/${f.name}`;
      if (f.type === 'file' && isBackedUpPath(p)) await read(p);
    }
  }
  return files;
}

export async function saveBackup(env, gh, ref, { createdBy, reason }) {
  const backup = makeBackup(await filesAt(gh, ref), { createdBy, reason, commit: ref });
  const json = JSON.stringify(backup);
  const data = await gzip(json);
  const row = await env.DB.prepare('INSERT INTO backups (created_by, reason, commit_sha, summary, size, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id')
    .bind(createdBy, reason, ref, summary(backup), json.length, data, backup.createdAt)
    .first();
  await env.DB.prepare('DELETE FROM backups WHERE id NOT IN (SELECT id FROM backups ORDER BY created_at DESC LIMIT ?)').bind(KEEP).run();
  return { id: row.id, backup };
}

export async function listBackups(env) {
  const { results } = await env.DB.prepare('SELECT id, created_at, created_by, reason, commit_sha, summary, size FROM backups ORDER BY created_at DESC LIMIT ?').bind(KEEP).all();
  return results;
}

export async function getBackup(env, id) {
  const row = await env.DB.prepare('SELECT data FROM backups WHERE id = ?').bind(id).first();
  if (!row) return null;
  return JSON.parse(await gunzip(new Uint8Array(row.data)));
}
