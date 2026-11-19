// Turns one year's config + Sessionize data into everything the pages need.
// Used for the current year (site.config.js) and for each archived year (archive/<year>/).

const day = (ymd) => new Date(`${ymd}T12:00:00Z`);
const fmt = (ymd, opts) => day(ymd).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });
const weekday = (ymd) => fmt(ymd, { weekday: 'short' });

function dateLabel(start, end) {
  const [s, e] = [day(start), day(end)];
  const year = fmt(end, { year: 'numeric' });
  if (start === end) return fmt(start, { month: 'long', day: 'numeric', year: 'numeric' });
  if (s.getUTCMonth() === e.getUTCMonth()) return `${fmt(start, { month: 'long' })} ${s.getUTCDate()}–${e.getUTCDate()}, ${year}`;
  return `${fmt(start, { month: 'long', day: 'numeric' })} – ${fmt(end, { month: 'long', day: 'numeric' })}, ${year}`;
}

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

function withSlugs(items, key) {
  const seen = new Map();
  return items.map((item) => {
    const base = slugify(item[key]) || item.id;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return { ...item, slug: n === 1 ? base : `${base}-${n}` };
  });
}

const EMPTY = { eventId: null, speakers: [], sessions: [], rooms: [] };

/**
 * @param {object} config   one year's settings (shape of site.config.js)
 * @param {object} raw      that year's sessionize.json, or null
 * @param {object} opts     { base: '' | '/2026', archived: boolean, today: 'YYYY-MM-DD' }
 */
export function makeYear(config, raw, { base = '', archived = false, today } = {}) {
  const ev = config.event;
  const tz = ev.timezone || 'America/Chicago';
  const { start = null, end = null } = ev;
  const year = Number(ev.year || String(start || '').slice(0, 4));
  if (!year) throw new Error('site.config.js: set event.year (or event.start).');
  const features = { registration: true, callForSpeakers: false, program: true, speakers: true, ...config.features };
  if (archived) Object.assign(features, { registration: false, callForSpeakers: false, program: true, speakers: true });

  // Only use Sessionize data that belongs to the event this config names.
  const eventId = config.sessionize?.eventId || null;
  const matches = raw && eventId && raw.eventId === eventId;
  if (raw && eventId && raw.eventId !== eventId && !archived) {
    console.warn(`[sessionize] src/data/sessionize.json is for event ${raw.eventId}, but site.config.js names ${eventId}. Run npm run import:sessionize. Showing no program for now.`);
  }
  const data = matches ? raw : EMPTY;

  const event = {
    ...ev,
    year,
    dates: start && end
      ? {
          start, end, known: true,
          label: dateLabel(start, end),
          days: start === end ? weekday(start) : `${weekday(start)}–${weekday(end)}`,
          count: Math.round((day(end) - day(start)) / 86400000) + 1,
        }
      : { start: null, end: null, known: false, label: `${year} · dates coming soon`, days: null, count: null },
    timezoneLabel:
      new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longGeneric' })
        .formatToParts(day(start || `${year}-06-01`)).find((p) => p.type === 'timeZoneName')?.value || tz,
    ticketsUrl: config.links?.tickets || null,
    prospectusUrl: config.links?.prospectus || null,
    callForSpeakersUrl: config.links?.callForSpeakers || null,
    contactEmail: config.links?.contactEmail,
    conductEmail: config.links?.conductEmail,
  };

  const mode = archived ? 'past' : process.env.EVENT_STATE || config.homepage?.mode || 'auto';
  const isPast = mode === 'auto' ? Boolean(end && today > end) : mode === 'past';

  const tierList = (config.tickets?.tiers || []).map((t, i, all) => {
    const prev = all[i - 1];
    const after = prev?.until ? fmt(prev.until, { month: 'long', day: 'numeric' }) : null;
    const until = t.until ? fmt(t.until, { month: 'long', day: 'numeric' }) : null;
    return { ...t, untilLabel: until, note: until ? `Available until ${until}` : after ? `Available after ${after}` : 'Available now' };
  });
  const ci = Math.max(0, tierList.findIndex((t) => !t.until || today <= t.until));
  const tickets = { note: config.tickets?.note || '', tiers: tierList, current: tierList[ci] || null, next: tierList[ci + 1] || null };

  // ---- Program data ----
  const communities = config.communities || [];
  const speakers = withSlugs([...data.speakers].sort((a, b) => a.name.localeCompare(b.name)), 'name');
  const speakerById = new Map(speakers.map((s) => [s.id, s]));
  const byTag = new Map(communities.map((c) => [c.tag, c]));
  const communityOf = (s) => {
    const tag = s.tags.find((t) => t.category === 'group')?.name;
    return tag ? byTag.get(tag) || { name: tag, slug: slugify(tag), color: '#303086' } : null;
  };
  const sessions = withSlugs(data.sessions, 'title').map((s) => ({
    ...s,
    community: communityOf(s),
    speakerList: s.speakers.map((id) => speakerById.get(id)).filter(Boolean),
  }));
  const talks = sessions.filter((s) => !s.service);
  const hasProgram = talks.length > 0;

  const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }).replace(/\s?(AM|PM)/, (m) => ' ' + m.trim().toLowerCase());
  const fmtClock = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz }).replace(/\s?(AM|PM)/, '');
  const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz });
  const fmtWeekday = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'long', timeZone: tz });
  const fmtShortDay = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', timeZone: tz });
  const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: tz });
  const minutes = (s) => Math.round((new Date(s.endsAt) - new Date(s.startsAt)) / 60000);

  const talksBySpeaker = (id) => talks.filter((s) => s.speakers.includes(id));
  const talksByCommunity = (slug) => talks.filter((s) => s.community?.slug === slug);
  const primaryCommunity = (speakerId) => talksBySpeaker(speakerId)[0]?.community || null;

  function days() {
    const map = new Map();
    for (const s of sessions) {
      if (!s.startsAt) continue;
      const key = dayKey(s.startsAt);
      if (!map.has(key)) map.set(key, { key, label: fmtDay(s.startsAt), weekday: fmtWeekday(s.startsAt), sessions: [] });
      map.get(key).sessions.push(s);
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  }

  const lineupConfig = { order: 'talks', featured: [], mobileCount: 5, ...config.lineup };
  function lineup() {
    const count = (c) => talksByCommunity(c.slug).length;
    const featured = lineupConfig.featured.map((slug) => communities.find((c) => c.slug === slug)).filter(Boolean);
    const rest = communities.filter((c) => !featured.includes(c));
    if (lineupConfig.order === 'alphabetical' || (lineupConfig.order === 'talks' && !hasProgram)) rest.sort((a, b) => a.name.localeCompare(b.name));
    else if (lineupConfig.order === 'talks') rest.sort((a, b) => count(b) - count(a) || a.name.localeCompare(b.name));
    return [...featured, ...rest];
  }

  function icsFor(session, url) {
    const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const who = session.speakerList.map((p) => p.name).join(', ');
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CommunityDays KC//communitydays.info//EN', 'BEGIN:VEVENT',
      `UID:${session.id}@communitydays.info`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(session.startsAt)}`, `DTEND:${stamp(session.endsAt)}`,
      `SUMMARY:${esc(session.title)}`,
      `DESCRIPTION:${esc([who, url].filter(Boolean).join('\n'))}`,
      `LOCATION:${esc(`${session.room}, ${event.venue.name}, ${event.venue.street}, ${event.venue.city}`)}`,
      `URL:${url}`, 'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n') + '\r\n';
  }

  return {
    year, base, archived, features, event, isPast, tickets,
    nextYear: year + 1,
    communities, sponsors: config.sponsors || [], hasSponsors: (config.sponsors || []).some((t) => t.items.length),
    lineupConfig, lineup,
    speakers, sessions, talks, rooms: data.rooms, hasProgram,
    talksBySpeaker, talksByCommunity, primaryCommunity, days, icsFor,
    fmtTime, fmtClock, fmtDay, fmtShortDay, minutes,
    // Link inside this year's pages: link('/program/') → '/2026/program/' for archives
    link: (path) => `${base}${path}`,
  };
}
