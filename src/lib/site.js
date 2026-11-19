// Everything the pages need, derived from site.config.js at build time.
// Edit site.config.js, not this file.
import config from '../../site.config.js';

const tz = config.event.timezone;

// Date-only strings ("2026-05-28") are formatted at noon UTC so no time zone can shift the day.
const day = (ymd) => new Date(`${ymd}T12:00:00Z`);
const fmt = (ymd, opts) => day(ymd).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });

// "Today" in the event's time zone. Override with SITE_TODAY=YYYY-MM-DD to preview another date.
export const today = process.env.SITE_TODAY || new Date().toLocaleDateString('en-CA', { timeZone: tz });

function dateLabel(start, end) {
  const [s, e] = [day(start), day(end)];
  const year = fmt(end, { year: 'numeric' });
  if (start === end) return fmt(start, { month: 'long', day: 'numeric', year: 'numeric' });
  if (s.getUTCMonth() === e.getUTCMonth()) return `${fmt(start, { month: 'long' })} ${s.getUTCDate()}–${e.getUTCDate()}, ${year}`;
  return `${fmt(start, { month: 'long', day: 'numeric' })} – ${fmt(end, { month: 'long', day: 'numeric' })}, ${year}`;
}
const weekday = (ymd) => fmt(ymd, { weekday: 'short' });

const { start, end } = config.event;
export const event = {
  ...config.event,
  year: Number(start.slice(0, 4)),
  dates: {
    start,
    end,
    label: dateLabel(start, end),
    days: start === end ? weekday(start) : `${weekday(start)}–${weekday(end)}`,
    count: Math.round((day(end) - day(start)) / 86400000) + 1,
  },
  // e.g. "Central Time" for America/Chicago
  timezoneLabel: new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longGeneric' }).formatToParts(day(start)).find((p) => p.type === 'timeZoneName')?.value || tz,
  ticketsUrl: config.links.tickets,
  prospectusUrl: config.links.prospectus,
  callForSpeakersUrl: config.links.callForSpeakers,
  contactEmail: config.links.contactEmail,
  conductEmail: config.links.conductEmail,
};
export const nextYear = event.year + 1;

// Homepage mode. EVENT_STATE=upcoming|past still overrides for previews.
const mode = process.env.EVENT_STATE || config.homepage?.mode || 'auto';
export const eventState = mode === 'auto' ? (today > end ? 'past' : 'upcoming') : mode;
export const isPast = eventState === 'past';

// Ticket tiers with readable availability, and the one on sale today.
const tiers = config.tickets.tiers.map((t, i, all) => {
  const prev = all[i - 1];
  const after = prev?.until ? fmt(prev.until, { month: 'long', day: 'numeric' }) : null;
  const until = t.until ? fmt(t.until, { month: 'long', day: 'numeric' }) : null;
  return {
    ...t,
    untilLabel: until,
    note: until ? `Available until ${until}` : after ? `Available after ${after}` : 'Available now',
  };
});
const currentIndex = Math.max(0, tiers.findIndex((t) => !t.until || today <= t.until));
export const tickets = {
  note: config.tickets.note,
  tiers,
  current: tiers[currentIndex],
  next: tiers[currentIndex + 1] || null,
};

export const nav = config.nav;
export const communities = config.communities;
export const sponsors = config.sponsors;
export const team = config.team;
export const lineupConfig = { order: 'talks', featured: [], mobileCount: 5, ...config.lineup };
export const sessionizeEventId = config.sessionize.eventId;
