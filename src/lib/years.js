// The current year (site.config.json) and every archived year (archive/<year>/).
import config from '../../site.config.json';
import raw from '../data/sessionize.json';
import { makeYear } from './year.js';
import { validateConfig } from './config-schema.js';

// Stop the build with a readable message if a config is invalid.
function check(cfg, file, opts) {
  const errors = validateConfig(cfg, opts);
  if (errors.length) throw new Error(`${file} has problems:\n${errors.map((e) => `  • ${e.path}: ${e.message}`).join('\n')}`);
}
check(config, 'site.config.json');

// "Today" in the event's time zone. Override with SITE_TODAY=YYYY-MM-DD to preview another date.
export const today = process.env.SITE_TODAY || new Date().toLocaleDateString('en-CA', { timeZone: config.event.timezone });

export const current = makeYear(config, raw, { today });

const archiveConfigs = import.meta.glob('../../archive/*/config.json', { eager: true, import: 'default' });
const archiveData = import.meta.glob('../../archive/*/sessionize.json', { eager: true, import: 'default' });

// Newest first. Archives never inherit the current year's feature switches.
export const archives = Object.entries(archiveConfigs)
  .map(([path, cfg]) => {
    const y = path.match(/archive\/(\d{4})\//)[1];
    check({ ...cfg, event: { ...cfg.event, year: Number(y) } }, `archive/${y}/config.json`, { archived: true });
    const data = archiveData[`../../archive/${y}/sessionize.json`] || null;
    return makeYear({ ...cfg, event: { ...cfg.event, year: Number(y) } }, data, { base: `/${y}`, archived: true, today });
  })
  .filter((a) => a.year !== current.year)
  .sort((a, b) => b.year - a.year);

// The most recent past year: used when the current year has no speakers or sponsors yet.
export const previous = archives[0] || null;

// Settings that are not tied to a year.
export const site = {
  nav: config.nav.filter((n) => !n.feature || current.features[n.feature] !== false),
  team: config.team,
};
