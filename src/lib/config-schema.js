// Validation for site.config.json and archive/<year>/config.json.
// Shared by the build (src/lib/years.js), the admin Worker and the CLI scripts.
// Returns a list of { path, message } — empty when the config is valid.

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEX = /^#[0-9a-f]{6}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const FEATURES = ['callForSpeakers', 'registration', 'program', 'speakers'];
export const MODES = ['auto', 'upcoming', 'past'];
export const LINEUP_ORDERS = ['talks', 'alphabetical', 'listed'];

// WCAG relative luminance contrast between two #rrggbb colors.
export function contrast(a, b = '#ffffff') {
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const isUrl = (v) => typeof v === 'string' && (/^https?:\/\/[^\s]+$/.test(v) || /^\/[^\s]*$/.test(v));
const isDate = (v) => typeof v === 'string' && DATE.test(v) && !Number.isNaN(new Date(`${v}T12:00:00Z`).getTime());
const str = (v) => typeof v === 'string' && v.trim().length > 0;

export function validateConfig(c, { archived = false } = {}) {
  const errors = [];
  const err = (path, message) => errors.push({ path, message });
  const obj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  if (!obj(c)) return [{ path: '', message: 'Config must be an object.' }];

  // event
  const e = c.event || {};
  if (!str(e.name)) err('event.name', 'Enter the event name.');
  if (!Number.isInteger(e.year) || e.year < 2000 || e.year > 2100) err('event.year', 'Enter a four-digit year.');
  for (const k of ['start', 'end']) if (e[k] != null && !isDate(e[k])) err(`event.${k}`, 'Use a date like 2027-06-03, or leave empty.');
  if ((e.start == null) !== (e.end == null)) err(e.start == null ? 'event.start' : 'event.end', 'Set both the first and last day, or neither.');
  if (isDate(e.start) && isDate(e.end) && e.start > e.end) err('event.end', 'The last day is before the first day.');
  if (isDate(e.start) && Number.isInteger(e.year) && Number(e.start.slice(0, 4)) !== e.year) err('event.start', `The first day isn't in ${e.year}.`);
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: e.timezone || 'America/Chicago' });
  } catch {
    err('event.timezone', 'Use a time zone name like America/Chicago.');
  }
  if (e.venue?.mapUrl && !isUrl(e.venue.mapUrl)) err('event.venue.mapUrl', 'Enter a full https:// link.');

  // links
  const l = c.links || {};
  for (const k of ['tickets', 'prospectus', 'callForSpeakers']) if (l[k] != null && l[k] !== '' && !isUrl(l[k])) err(`links.${k}`, 'Enter a full https:// link, or a path starting with /.');
  for (const k of ['contactEmail', 'conductEmail']) if (!archived && !EMAIL.test(l[k] || '')) err(`links.${k}`, 'Enter an email address.');

  // sessionize
  const id = c.sessionize?.eventId;
  if (id != null && id !== '' && !/^[a-z0-9]+$/i.test(id)) err('sessionize.eventId', 'Sessionize IDs are letters and numbers only, like 295atto3.');

  // tickets
  const tiers = c.tickets?.tiers || [];
  tiers.forEach((t, i) => {
    if (!str(t.name)) err(`tickets.tiers.${i}.name`, 'Enter a tier name.');
    if (typeof t.price !== 'number' || t.price < 0) err(`tickets.tiers.${i}.price`, 'Enter a price of 0 or more.');
    if (t.until != null && !isDate(t.until)) err(`tickets.tiers.${i}.until`, 'Use a date like 2027-04-30, or leave empty.');
    if (t.until == null && i < tiers.length - 1) err(`tickets.tiers.${i}.until`, 'Only the last tier can be open-ended.');
    if (i > 0 && isDate(t.until) && isDate(tiers[i - 1].until) && t.until <= tiers[i - 1].until) err(`tickets.tiers.${i}.until`, 'Each tier must end after the one before it.');
  });

  if (!archived) {
    // features + their links
    const f = c.features || {};
    for (const k of FEATURES) if (typeof f[k] !== 'boolean') err(`features.${k}`, 'Turn this on or off.');
    if (f.callForSpeakers && !str(l.callForSpeakers)) err('links.callForSpeakers', 'Add the call-for-speakers link before turning it on.');
    if (f.registration && !str(l.tickets)) err('links.tickets', 'Add the ticket link before turning registration on.');
    if (f.registration && tiers.length === 0) err('tickets.tiers', 'Add at least one ticket tier before turning registration on.');
    if (!MODES.includes(c.homepage?.mode)) err('homepage.mode', `Choose ${MODES.join(', ')}.`);

    // lineup
    const lu = c.lineup || {};
    if (!LINEUP_ORDERS.includes(lu.order)) err('lineup.order', `Choose ${LINEUP_ORDERS.join(', ')}.`);
    if (!Number.isInteger(lu.mobileCount) || lu.mobileCount < 1 || lu.mobileCount > 50) err('lineup.mobileCount', 'Enter a number from 1 to 50.');
    for (const s of lu.featured || []) if (!(c.communities || []).some((x) => x.slug === s)) err('lineup.featured', `"${s}" isn't a community slug.`);

    // nav + team
    (c.nav || []).forEach((n, i) => {
      if (!str(n.label)) err(`nav.${i}.label`, 'Enter a label.');
      if (!isUrl(n.href)) err(`nav.${i}.href`, 'Enter a path like /program/.');
      if (n.feature != null && !FEATURES.includes(n.feature)) err(`nav.${i}.feature`, `Choose one of ${FEATURES.join(', ')}, or none.`);
    });
    (c.team || []).forEach((p, i) => {
      if (!str(p.name)) err(`team.${i}.name`, 'Enter a name.');
      if (!str(p.role)) err(`team.${i}.role`, 'Enter a role.');
      if (p.url && !isUrl(p.url)) err(`team.${i}.url`, 'Enter a full https:// link.');
    });
  }

  // communities
  const slugs = new Set();
  const tags = new Set();
  (c.communities || []).forEach((g, i) => {
    if (!str(g.name)) err(`communities.${i}.name`, 'Enter a name.');
    if (!SLUG.test(g.slug || '')) err(`communities.${i}.slug`, 'Use lowercase letters, numbers and dashes, like kc-postgres.');
    else if (slugs.has(g.slug)) err(`communities.${i}.slug`, 'Another community already uses this slug.');
    slugs.add(g.slug);
    if (!str(g.tag)) err(`communities.${i}.tag`, 'Enter the group name used in Sessionize.');
    else if (tags.has(g.tag)) err(`communities.${i}.tag`, 'Another community already uses this Sessionize group.');
    tags.add(g.tag);
    if (!HEX.test(g.color || '')) err(`communities.${i}.color`, 'Use a color like #b3261e.');
    else if (contrast(g.color) < 4.5) err(`communities.${i}.color`, `White text on this color is ${contrast(g.color).toFixed(1)}:1; it needs 4.5:1. Pick a darker color.`);
    if (g.url && !isUrl(g.url)) err(`communities.${i}.url`, 'Enter a full https:// link.');
  });

  // sponsors
  (c.sponsors || []).forEach((t, i) => {
    if (!str(t.tier)) err(`sponsors.${i}.tier`, 'Enter a tier name.');
    if (t.ribbon && !HEX.test(t.ribbon)) err(`sponsors.${i}.ribbon`, 'Use a color like #7a5a00.');
    else if (t.ribbon && contrast(t.ribbon) < 4.5) err(`sponsors.${i}.ribbon`, `White text on this color is ${contrast(t.ribbon).toFixed(1)}:1; it needs 4.5:1.`);
    (t.items || []).forEach((s, j) => {
      if (!str(s.name)) err(`sponsors.${i}.items.${j}.name`, 'Enter the sponsor name.');
      if (!str(s.logo)) err(`sponsors.${i}.items.${j}.logo`, 'Upload or enter a logo.');
      if (s.url && !isUrl(s.url)) err(`sponsors.${i}.items.${j}.url`, 'Enter a full https:// link.');
    });
  });

  return errors;
}
