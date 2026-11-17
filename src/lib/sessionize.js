import data from '../data/sessionize.json';
import { event, communities } from '../data/site.js';

const tz = event.timezone;

export const slugify = (str) =>
  str
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .slice(0, 80)
    .replace(/-$/, '');

// Give every record a unique, stable slug.
function withSlugs(items, key) {
  const seen = new Map();
  return items.map((item) => {
    const base = slugify(item[key]) || item.id;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return { ...item, slug: n === 1 ? base : `${base}-${n}` };
  });
}

export const speakers = withSlugs([...data.speakers].sort((a, b) => a.name.localeCompare(b.name)), 'name');
export const speakerById = new Map(speakers.map((s) => [s.id, s]));

const communityByTag = new Map(communities.map((c) => [c.tag, c]));
export const communityOf = (session) => {
  const tag = session.tags.find((t) => t.category === 'group')?.name;
  return tag ? communityByTag.get(tag) || { name: tag, slug: slugify(tag), color: '#303086' } : null;
};

export const sessions = withSlugs(data.sessions, 'title').map((s) => ({
  ...s,
  community: communityOf(s),
  speakerList: s.speakers.map((id) => speakerById.get(id)).filter(Boolean),
}));
export const talks = sessions.filter((s) => !s.service);
export const rooms = data.rooms;

export const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }).replace(/\s?(AM|PM)/, (m) => ' ' + m.trim().toLowerCase());
export const fmtClock = (iso) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz }).replace(/\s?(AM|PM)/, '');
export const fmtDay = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz });
export const fmtWeekday = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'long', timeZone: tz });
export const fmtShortDay = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', timeZone: tz });
export const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: tz });
export const minutes = (s) => Math.round((new Date(s.endsAt) - new Date(s.startsAt)) / 60000);

export const talksBySpeaker = (id) => talks.filter((s) => s.speakers.includes(id));
export const talksByCommunity = (slug) => talks.filter((s) => s.community?.slug === slug);
export const speakersByCommunity = (slug) => {
  const ids = new Set(talksByCommunity(slug).flatMap((s) => s.speakers));
  return speakers.filter((s) => ids.has(s.id));
};
export const primaryCommunity = (speakerId) => talksBySpeaker(speakerId)[0]?.community || null;

export function days() {
  const map = new Map();
  for (const s of sessions) {
    if (!s.startsAt) continue;
    const key = dayKey(s.startsAt);
    if (!map.has(key)) map.set(key, { key, label: fmtDay(s.startsAt), weekday: fmtWeekday(s.startsAt), sessions: [] });
    map.get(key).sessions.push(s);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

// RFC 5545 calendar file for one session.
export function icsFor(session, url) {
  const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const who = session.speakerList.map((p) => p.name).join(', ');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CommunityDays KC//communitydays.info//EN',
    'BEGIN:VEVENT',
    `UID:${session.id}@communitydays.info`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(session.startsAt)}`,
    `DTEND:${stamp(session.endsAt)}`,
    `SUMMARY:${esc(session.title)}`,
    `DESCRIPTION:${esc([who, url].filter(Boolean).join('\n'))}`,
    `LOCATION:${esc(`${session.room}, ${event.venue.name}, ${event.venue.street}, ${event.venue.city}`)}`,
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}
