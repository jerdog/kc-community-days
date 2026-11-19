#!/usr/bin/env node
// Pulls speakers, sessions and the schedule grid from Sessionize and writes
// them to src/data/sessionize.json so the site can be built statically.
//
// Usage: npm run import:sessionize            (event ID from site.config.js)
//        npm run import:sessionize -- <id>    (one-off override)
//
// The current Sessionize ID only exposes the HTML "embed" views, so this script
// parses those. If you enable a JSON endpoint in Sessionize (API / Embed ->
// JSON -> "All Data"), it can be swapped for a single fetch of /view/All.

import { writeFile, mkdir } from 'node:fs/promises';
import { parse } from 'node-html-parser';
import config from '../site.config.js';

const EVENT_ID = process.argv[2] || process.env.SESSIONIZE_ID || config.sessionize.eventId;
if (!EVENT_ID) {
  console.error('No Sessionize event set. Put the event ID in sessionize.eventId in site.config.js (once talks are selected), then run this again.');
  process.exit(1);
}
const BASE = `https://sessionize.com/api/v2/${EVENT_ID}`;
const OUT = new URL('../src/data/sessionize.json', import.meta.url);

const text = (el) => (el ? el.text.replace(/\s+/g, ' ').trim() : '');

async function get(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return parse(await res.text());
}

// Split a <p> containing <br> runs into paragraphs.
function paragraphs(el) {
  if (!el) return [];
  return el.innerHTML
    .split(/<br\s*\/?>/i)
    .map((s) => parse(s).text.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function parseSztz(attr) {
  // e.g. "DayTime|en-US|2026-05-28T14:00:00.0000000Z|2026-05-28T14:30:00.0000000Z"
  if (!attr) return {};
  const [, , start, end] = attr.split('|');
  return { startsAt: start?.replace('.0000000', ''), endsAt: end?.replace('.0000000', '') };
}

async function main() {
  console.log(`Importing Sessionize event ${EVENT_ID}…`);

  // Speakers
  const wall = await get(`${BASE}/view/SpeakerWall?under=True`);
  const speakers = [];
  for (const li of wall.querySelectorAll('li.sz-speaker')) {
    const id = li.getAttribute('data-speakerid');
    const modal = await get(`${BASE}/speaker?id=${id}`, { method: 'POST' });
    speakers.push({
      id,
      name: text(li.querySelector('.sz-speaker__name')),
      tagline: text(li.querySelector('.sz-speaker__tagline')),
      photo: li.querySelector('img')?.getAttribute('src') || null,
      bio: paragraphs(modal.querySelector('.sz-speaker__bio')),
      links: modal
        .querySelectorAll('.sz-speaker__links a')
        .map((a) => ({ title: text(a), url: a.getAttribute('href') })),
    });
  }

  // Sessions
  const list = await get(`${BASE}/view/Sessions?under=True`);
  const sessions = list.querySelectorAll('li.sz-session').map((li) => ({
    id: li.getAttribute('data-sessionid'),
    title: text(li.querySelector('.sz-session__title')),
    description: paragraphs(li.querySelector('.sz-session__description')),
    speakers: li.querySelectorAll('.sz-session__speakers li').map((s) => s.getAttribute('data-speakerid')),
    room: text(li.querySelector('.sz-session__room')) || null,
    ...parseSztz(li.querySelector('.sz-session__time')?.getAttribute('data-sztz')),
    tags: li.querySelectorAll('.sz-session__tags li').map((t) => ({
      category: t.getAttribute('data-categoryname'),
      name: text(t),
    })),
    service: false,
  }));

  // Service sessions (Opening, Lunch, …) only appear on the grid.
  const grid = await get(`${BASE}/view/GridSmart?under=True`);
  const known = new Set(sessions.map((s) => s.id));
  for (const el of grid.querySelectorAll('.sz-session--service')) {
    const id = el.getAttribute('data-sessionid');
    if (known.has(id)) continue;
    known.add(id);
    sessions.push({
      id,
      title: text(el.querySelector('.sz-session__title')),
      description: [],
      speakers: [],
      room: text(el.querySelector('.sz-session__room')) || null,
      ...parseSztz(el.querySelector('.sz-session__time')?.getAttribute('data-sztz')),
      tags: [],
      service: true,
      plenum: el.classList.contains('sz-session--plenum'),
    });
  }

  const rooms = [...new Set(grid.querySelectorAll('.sz-session__room').map(text))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
  sessions.sort((a, b) => (a.startsAt || '').localeCompare(b.startsAt || '') || (a.room || '').localeCompare(b.room || '', undefined, { numeric: true }));

  const data = { eventId: EVENT_ID, importedAt: new Date().toISOString(), rooms, speakers, sessions };
  await mkdir(new URL('.', OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(data, null, 2) + '\n');
  console.log(`Wrote ${speakers.length} speakers, ${sessions.length} sessions, ${rooms.length} rooms → src/data/sessionize.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
