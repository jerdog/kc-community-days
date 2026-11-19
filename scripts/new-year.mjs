#!/usr/bin/env node
// Start a new event year from the command line (the admin page does the same).
//
//   npm run new-year -- 2027                         (dates not known yet)
//   npm run new-year -- 2027 2027-06-03 2027-06-04   (with dates)
//
// Archives the current year to archive/<year>/ (served at /<year>/) and resets
// site.config.json for the new year. See src/lib/new-year.js for exactly what changes.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { startNewYear, toJson } from '../src/lib/new-year.js';
import { validateConfig } from '../src/lib/config-schema.js';
import { writeLocalBackup } from './lib/local-backup.mjs';

const root = resolve(import.meta.dirname, '..');
const [year, start = null, end = null] = process.argv.slice(2);
const read = async (p) => JSON.parse(await readFile(resolve(root, p), 'utf8'));
const archives = await readdir(resolve(root, 'archive')).catch(() => []);

let result;
try {
  result = startNewYear(await read('site.config.json'), await read('src/data/sessionize.json'), { year, start, end }, archives);
} catch (e) {
  console.error(`new-year: ${e.message}`);
  process.exit(1);
}
const problems = validateConfig(result.files['site.config.json']);
if (problems.length) {
  console.error(`new-year: the new config would be invalid:\n${problems.map((p) => `  • ${p.path}: ${p.message}`).join('\n')}`);
  process.exit(1);
}
// Back up everything first; stop if that fails.
try {
  const { path } = await writeLocalBackup(`Before starting ${result.newYear}`);
  console.log(`Backed up the current site to ${path} (restore with: npm run restore -- ${path})`);
} catch (e) {
  console.error(`new-year: couldn’t write the backup, so nothing was changed: ${e.message}`);
  process.exit(1);
}
for (const [path, value] of Object.entries(result.files)) {
  await mkdir(dirname(resolve(root, path)), { recursive: true });
  await writeFile(resolve(root, path), toJson(value));
}
console.log(`Archived ${result.oldYear} to archive/${result.oldYear}/ (served at /${result.oldYear}/).
site.config.json is now set up for ${result.newYear}${start ? ` (${start} to ${end})` : ' (dates coming soon)'}.
Next, as the year goes on (in the admin page or site.config.json):
  • Call for speakers opens → links.callForSpeakers + features.callForSpeakers
  • Dates and venue set     → event.start / event.end / event.venue
  • Tickets on sale         → links.tickets, check tickets.tiers dates, features.registration
  • Talks selected          → sessionize.eventId, then import from Sessionize
  • Sponsors sign on        → sponsors[].items`);
