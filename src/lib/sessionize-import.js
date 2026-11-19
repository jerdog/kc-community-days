// Sessionize import, shared by `npm run import:sessionize` and the admin page.
// Uses the HTML "embed" views (the event's JSON API may not be enabled).
//
// Two phases so the admin Worker stays under Cloudflare's per-request fetch limit:
//   1. fetchOverview(id)       → speakers (without bios), sessions, rooms   (3 requests)
//   2. fetchBios(id, ids)      → { [speakerId]: { bio, links } }            (1 request per id)
// then assemble(id, overview, bios) → the object written to src/data/sessionize.json.
import { parse } from 'node-html-parser';

const base = (id) => `https://sessionize.com/api/v2/${encodeURIComponent(id)}`;
const text = (el) => (el ? el.text.replace(/\s+/g, ' ').trim() : '');

async function get(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Sessionize returned ${res.status} for ${url}`);
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

export async function fetchOverview(id) {
  const B = base(id);
  const wall = await get(`${B}/view/SpeakerWall?under=True`);
  const speakers = wall.querySelectorAll('li.sz-speaker').map((li) => ({
    id: li.getAttribute('data-speakerid'),
    name: text(li.querySelector('.sz-speaker__name')),
    tagline: text(li.querySelector('.sz-speaker__tagline')),
    photo: li.querySelector('img')?.getAttribute('src') || null,
  }));

  const list = await get(`${B}/view/Sessions?under=True`);
  const sessions = list.querySelectorAll('li.sz-session').map((li) => ({
    id: li.getAttribute('data-sessionid'),
    title: text(li.querySelector('.sz-session__title')),
    description: paragraphs(li.querySelector('.sz-session__description')),
    speakers: li.querySelectorAll('.sz-session__speakers li').map((s) => s.getAttribute('data-speakerid')),
    room: text(li.querySelector('.sz-session__room')) || null,
    ...parseSztz(li.querySelector('.sz-session__time')?.getAttribute('data-sztz')),
    tags: li.querySelectorAll('.sz-session__tags li').map((t) => ({ category: t.getAttribute('data-categoryname'), name: text(t) })),
    service: false,
  }));

  // Service sessions (Opening, Lunch, …) only appear on the grid.
  const grid = await get(`${B}/view/GridSmart?under=True`);
  const known = new Set(sessions.map((s) => s.id));
  for (const el of grid.querySelectorAll('.sz-session--service')) {
    const sid = el.getAttribute('data-sessionid');
    if (known.has(sid)) continue;
    known.add(sid);
    sessions.push({
      id: sid,
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
  const rooms = [...new Set(grid.querySelectorAll('.sz-session__room').map(text))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!speakers.length && !sessions.length) throw new Error(`Sessionize event ${id} has no published speakers or sessions. Check the ID and that the embed views are published.`);
  return { speakers, sessions, rooms };
}

export async function fetchBios(id, speakerIds) {
  const out = {};
  for (const sid of speakerIds) {
    const modal = await get(`${base(id)}/speaker?id=${encodeURIComponent(sid)}`, { method: 'POST' });
    out[sid] = {
      bio: paragraphs(modal.querySelector('.sz-speaker__bio')),
      links: modal.querySelectorAll('.sz-speaker__links a').map((a) => ({ title: text(a), url: a.getAttribute('href') })),
    };
  }
  return out;
}

export function assemble(id, overview, bios) {
  // Sessionize shuffles the speaker wall; sort so re-imports only change what really changed.
  const speakers = overview.speakers
    .map((s) => ({ ...s, bio: bios[s.id]?.bio || [], links: bios[s.id]?.links || [] }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const sessions = [...overview.sessions].sort(
    (a, b) => (a.startsAt || '').localeCompare(b.startsAt || '') || (a.room || '').localeCompare(b.room || '', undefined, { numeric: true })
  );
  return { eventId: id, importedAt: new Date().toISOString(), rooms: overview.rooms, speakers, sessions };
}
