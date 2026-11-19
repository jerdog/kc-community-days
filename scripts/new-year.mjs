#!/usr/bin/env node
// Start a new event year.
//
//   npm run new-year -- 2027                         (dates not known yet)
//   npm run new-year -- 2027 2027-06-03 2027-06-04   (with dates)
//
// 1. Archives the current year to archive/<year>/ (config + Sessionize data),
//    which the site serves at /<year>/.
// 2. Resets site.config.js for the new year: new year and dates, call for
//    speakers and registration turned off, no Sessionize event, sponsors
//    emptied (tiers kept), ticket deadlines moved forward a year.
//    Communities carry over.
// 3. Empties src/data/sessionize.json until the new program is imported.

import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const [newYearArg, start = null, end = null] = process.argv.slice(2);
const newYear = Number(newYearArg);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function fail(msg) {
  console.error(`new-year: ${msg}`);
  process.exit(1);
}
if (!newYear) fail('give the new year, e.g. npm run new-year -- 2027');
if ((start && !isDate(start)) || (end && !isDate(end))) fail('dates must be YYYY-MM-DD');
if ((start && !end) || (end && !start)) fail('give both a start and an end date, or neither');
if (start && start > end) fail('start date is after end date');

const configPath = resolve(root, 'site.config.js');
const config = (await import(pathToFileURL(configPath).href + `?t=${Date.now()}`)).default;
const oldYear = Number(config.event.year || String(config.event.start).slice(0, 4));
if (newYear <= oldYear) fail(`site.config.js is already on ${oldYear}; the new year must be later`);

const archiveDir = resolve(root, 'archive', String(oldYear));
if (await access(archiveDir).then(() => true, () => false)) fail(`archive/${oldYear} already exists`);

// ---- 1. Archive the current year ----
const snapshot = {
  event: config.event,
  links: config.links,
  sessionize: config.sessionize,
  tickets: config.tickets,
  lineup: config.lineup,
  communities: config.communities,
  sponsors: config.sponsors,
};
const dataPath = resolve(root, 'src/data/sessionize.json');
const data = JSON.parse(await readFile(dataPath, 'utf8'));
if (data.eventId && data.eventId !== config.sessionize?.eventId) {
  console.warn(`new-year: src/data/sessionize.json is for ${data.eventId}, not ${config.sessionize?.eventId}; archiving it anyway.`);
}
// ---- 2. Reset site.config.js ----
let src = await readFile(configPath, 'utf8');
function set(re, value, label) {
  if (!re.test(src)) fail(`could not find ${label} in site.config.js (was the file reformatted?). Nothing was changed.`);
  src = src.replace(re, value);
}
const q = (v) => (v ? `'${v}'` : 'null');
set(/(\n\s*year:\s*)\d{4}(,)/, `$1${newYear}$2`, 'event.year');
set(/(\n\s*start:\s*)(?:'[^']*'|null)(,)/, `$1${q(start)}$2`, 'event.start');
set(/(\n\s*end:\s*)(?:'[^']*'|null)(,)/, `$1${q(end)}$2`, 'event.end');
set(/(\n\s*callForSpeakers:\s*)(?:true|false)(,)/, '$1false$2', 'features.callForSpeakers');
set(/(\n\s*registration:\s*)(?:true|false)(,)/, '$1false$2', 'features.registration');
set(/(homepage:\s*\{\s*mode:\s*)'[^']*'/, "$1'auto'", 'homepage.mode');
set(/(\n\s*tickets:\s*)(?:'[^']*'|null)(,)/, '$1null$2', 'links.tickets');
set(/(\n\s*callForSpeakers:\s*)(?:'[^']*'|null)(,)/, '$1null$2', 'links.callForSpeakers');
set(/(sessionize:\s*\{\s*eventId:\s*)(?:'[^']*'|null)/, '$1null', 'sessionize.eventId');
// Ticket deadlines move forward one year (check them before turning registration on).
src = src.replace(/(until:\s*')(\d{4})(-\d{2}-\d{2}')/g, (_, a, y, b) => `${a}${Number(y) + 1}${b}`);
// Empty each sponsor tier's items, keeping the tier settings.
const sStart = src.indexOf('sponsors: [');
if (sStart < 0) fail('could not find sponsors in site.config.js');
let out = src.slice(0, sStart);
let i = sStart;
while (true) {
  const at = src.indexOf('items: [', i);
  const sEnd = src.indexOf('\n  ],', sStart);
  if (at < 0 || at > sEnd) break;
  let depth = 0, j = at + 'items: '.length;
  for (; j < src.length; j++) {
    if (src[j] === '[') depth++;
    else if (src[j] === ']' && --depth === 0) break;
  }
  out += src.slice(i, at) + 'items: []';
  i = j + 1;
}
src = out + src.slice(i);

// Every edit worked: now write the archive, the new config and empty program data.
await mkdir(archiveDir, { recursive: true });
await writeFile(
  resolve(archiveDir, 'config.js'),
  `// CommunityDays KC ${oldYear}, archived by scripts/new-year.mjs. Served at /${oldYear}/.\n// Edit to fix archived details; the current year lives in site.config.js.\nexport default ${JSON.stringify(snapshot, null, 2)};\n`
);
await writeFile(resolve(archiveDir, 'sessionize.json'), JSON.stringify(data, null, 2) + '\n');
await writeFile(configPath, src);

// ---- 3. Empty the program data ----
await writeFile(dataPath, JSON.stringify({ eventId: null, importedAt: null, rooms: [], speakers: [], sessions: [] }, null, 2) + '\n');

console.log(`Archived ${oldYear} to archive/${oldYear}/ (served at /${oldYear}/).
site.config.js is now set up for ${newYear}${start ? ` (${start} to ${end})` : ' (dates coming soon)'}.
Next, as the year goes on:
  • Call for speakers opens → links.callForSpeakers + features.callForSpeakers: true
  • Dates and venue set     → event.start / event.end / event.venue
  • Tickets on sale         → links.tickets, check tickets.tiers dates, features.registration: true
  • Talks selected          → sessionize.eventId, then npm run import:sessionize
  • Sponsors sign on        → sponsors[].items`);
