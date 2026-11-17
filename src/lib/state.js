import { event } from '../data/site.js';

// "upcoming" before the event ends, "past" after. Decided at build time; override
// with EVENT_STATE=upcoming|past (e.g. to preview the pre-event homepage).
const end = new Date(`${event.dates.end}T23:59:59-05:00`);
export const eventState = process.env.EVENT_STATE || (Date.now() > end.getTime() ? 'past' : 'upcoming');
export const isPast = eventState === 'past';
