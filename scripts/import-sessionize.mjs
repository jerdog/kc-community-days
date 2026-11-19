#!/usr/bin/env node
// Pulls speakers, sessions and the schedule grid from Sessionize into
// src/data/sessionize.json. (The admin page has an "Import from Sessionize" button
// that does the same.)
//
// Usage: npm run import:sessionize            (event ID from site.config.json)
//        npm run import:sessionize -- <id>    (one-off override)
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fetchOverview, fetchBios, assemble } from '../src/lib/sessionize-import.js';

const config = JSON.parse(readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'));
const EVENT_ID = process.argv[2] || process.env.SESSIONIZE_ID || config.sessionize.eventId;
if (!EVENT_ID) {
  console.error('No Sessionize event set. Put the event ID in sessionize.eventId in site.config.json (or in the admin page), then run this again.');
  process.exit(1);
}
const OUT = new URL('../src/data/sessionize.json', import.meta.url);

try {
  console.log(`Importing Sessionize event ${EVENT_ID}…`);
  const overview = await fetchOverview(EVENT_ID);
  const bios = await fetchBios(EVENT_ID, overview.speakers.map((s) => s.id));
  const data = assemble(EVENT_ID, overview, bios);
  await mkdir(new URL('.', OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(data, null, 2) + '\n');
  console.log(`Wrote ${data.speakers.length} speakers, ${data.sessions.length} sessions, ${data.rooms.length} rooms → src/data/sessionize.json`);
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
