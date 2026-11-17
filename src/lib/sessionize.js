import data from '../data/sessionize.json';
import { event } from '../data/site.js';

const tz = event.timezone;
export const speakers = [...data.speakers].sort((a, b) => a.name.localeCompare(b.name));
export const speakerById = new Map(data.speakers.map((s) => [s.id, s]));
export const sessions = data.sessions;
export const rooms = data.rooms;

export const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }).toLowerCase();
export const fmtDay = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz });
export const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: tz });
export const minutes = (s) => Math.round((new Date(s.endsAt) - new Date(s.startsAt)) / 60000);
export const groupOf = (s) => s.tags.find((t) => t.category === 'group')?.name;
export const speakersOf = (s) => s.speakers.map((id) => speakerById.get(id)).filter(Boolean);
export const sessionsBySpeaker = (id) => sessions.filter((s) => s.speakers.includes(id));
export const slug = (str) => str.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-');

// [{ day, label, slots: [{ time, sessions: [...] }] }]
export function scheduleByDay() {
  const days = new Map();
  for (const s of sessions) {
    if (!s.startsAt) continue;
    const key = dayKey(s.startsAt);
    if (!days.has(key)) days.set(key, { day: key, label: fmtDay(s.startsAt), slots: new Map() });
    const slots = days.get(key).slots;
    if (!slots.has(s.startsAt)) slots.set(s.startsAt, { startsAt: s.startsAt, time: fmtTime(s.startsAt), sessions: [] });
    slots.get(s.startsAt).sessions.push(s);
  }
  return [...days.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({ ...d, slots: [...d.slots.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt)) }));
}
