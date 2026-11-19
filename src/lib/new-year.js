// Start a new event year: pure function shared by `npm run new-year` and the admin page.
//
// Returns the files to write:
//   archive/<oldYear>/config.json      the finishing year's settings
//   archive/<oldYear>/sessionize.json  its Sessionize data
//   site.config.json                   reset for the new year
//   src/data/sessionize.json           emptied until the new program is imported
//
// The new config keeps communities, lineup, nav, team, links' emails and sponsor tier
// settings. It clears dates (unless given), the Sessionize event, ticket and call-for-
// speakers links, and sponsor items; turns call for speakers and registration off; and
// moves ticket deadlines forward a year.

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const plusYear = (d) => (d ? `${Number(d.slice(0, 4)) + 1}${d.slice(4)}` : d);

export function startNewYear(config, data, { year, start = null, end = null }, existingArchives = []) {
  const oldYear = Number(config.event.year);
  const newYear = Number(year);
  if (!Number.isInteger(newYear)) throw new Error('Enter the new year, like 2027.');
  if (newYear <= oldYear) throw new Error(`The site is already on ${oldYear}; the new year must be later.`);
  if ((start && !DATE.test(start)) || (end && !DATE.test(end))) throw new Error('Dates must look like 2027-06-03.');
  if (Boolean(start) !== Boolean(end)) throw new Error('Give both the first and last day, or neither.');
  if (start && start > end) throw new Error('The first day is after the last day.');
  if (start && Number(start.slice(0, 4)) !== newYear) throw new Error(`The first day isn't in ${newYear}.`);
  if (existingArchives.map(Number).includes(oldYear)) throw new Error(`${oldYear} is already archived.`);

  const archiveConfig = {
    event: config.event,
    links: { tickets: config.links?.tickets ?? null, prospectus: config.links?.prospectus ?? null, callForSpeakers: config.links?.callForSpeakers ?? null },
    sessionize: config.sessionize,
    tickets: config.tickets,
    lineup: config.lineup,
    communities: config.communities,
    sponsors: config.sponsors,
  };

  const next = structuredClone(config);
  next.event = { ...next.event, year: newYear, start: start || null, end: end || null };
  next.features = { ...next.features, callForSpeakers: false, registration: false };
  next.homepage = { ...next.homepage, mode: 'auto' };
  next.links = { ...next.links, tickets: null, callForSpeakers: null };
  next.sessionize = { ...next.sessionize, eventId: null };
  next.tickets = { ...next.tickets, tiers: (next.tickets?.tiers || []).map((t) => (t.until ? { ...t, until: plusYear(t.until) } : t)) };
  next.sponsors = (next.sponsors || []).map((t) => ({ ...t, items: [] }));

  return {
    oldYear,
    newYear,
    files: {
      [`archive/${oldYear}/config.json`]: archiveConfig,
      [`archive/${oldYear}/sessionize.json`]: data,
      'site.config.json': next,
      'src/data/sessionize.json': { eventId: null, importedAt: null, rooms: [], speakers: [], sessions: [] },
    },
  };
}

export const toJson = (v) => JSON.stringify(v, null, 2) + '\n';
