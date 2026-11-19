// Hand-edited content for communitydays.info.
// Speakers, sessions and the schedule come from Sessionize (src/data/sessionize.json).

export const event = {
  name: 'CommunityDays KC',
  year: 2026,
  tagline: "Kansas City's meetups, under one roof.",
  description:
    "CommunityDays KC is a two-day event celebrating the strength and diversity of Kansas City's tech community. It brings the city's meetup groups together to collaborate on content and build community.",
  dates: { start: '2026-05-28', end: '2026-05-29', label: 'May 28–29, 2026', days: 'Thu–Fri' },
  venue: {
    host: 'Lifted Logic',
    name: 'Bel Air Building',
    street: '5600 W 95th St',
    city: 'Overland Park, KS',
    mapUrl: 'https://maps.google.com/?q=5600+W+95th+St,+Overland+Park,+KS',
  },
  timezone: 'America/Chicago',
  ticketsUrl: 'https://ti.to/kansas-city-developers-conference/communitydays-kc-2026',
  prospectusUrl: '/files/CommunityDays-2026-Sponsor-Prospectus.pdf',
  contactEmail: 'communitydays@kcdc.info',
  conductEmail: 'staff@kcdc.info',
};

export const nav = [
  { href: '/program/', label: 'Program' },
  { href: '/speakers/', label: 'Speakers' },
  { href: '/communities/', label: 'Communities' },
  { href: '/attend/', label: 'Attend' },
  { href: '/sponsor/', label: 'Sponsor' },
];

export const tickets = {
  note: 'One badge covers both days and every room.',
  tiers: [
    { name: 'Early-bird', price: 60, note: 'Available until April 27' },
    { name: 'Full price', price: 100, note: 'Available after April 27' },
  ],
};

// Participating communities.
// - tag:   the "group" name used in Sessionize, to match talks to the community
// - tier:  lineup type size on the homepage (1 = largest, 3 = smallest). Set by the
//          organizers; it is a layout choice, not a ranking. Defaults give short names
//          more room so the lineup sets well.
// - color: ribbon color. Must keep 4.5:1+ contrast with white text.
export const communities = [
  { name: 'Agile KC', slug: 'agile-kc', tag: 'Agile KC', tier: 1, color: '#00687a' },
  { name: 'Data Science KC', slug: 'data-science-kc', tag: 'Data Science KC', tier: 2, color: '#0b6e4f', url: 'https://datasciencekc.org/', logo: '/images/groups/data-science-kc.webp' },
  { name: 'DevOpsDays KC', slug: 'devopsdays-kc', tag: 'DevOpsDays KC', tier: 2, color: '#b3261e', url: 'https://www.meetup.com/devops-kansas-city/', logo: '/images/groups/devopsdays-kc.webp' },
  { name: 'GDG KC', slug: 'gdg-kc', tag: 'GDG KC', tier: 1, color: '#4d5e10' },
  { name: 'Global AI KC', slug: 'global-ai-kc', tag: 'Global AI KC', tier: 2, color: '#1d5bb8', url: 'https://globalai.community/chapters/kansas-city/', logo: '/images/groups/global-ai-kc.webp' },
  { name: 'IIBA Kansas City', slug: 'iiba-kc', tag: 'IIBA Kansas City', tier: 3, color: '#8e1f5f' },
  { name: 'KC AI Club', slug: 'kc-ai-club', tag: 'KC AI Club', tier: 2, color: '#3b4a6b' },
  { name: 'KC Data Professionals', slug: 'kc-data-professionals', tag: 'KC Data Professionals', tier: 3, color: '#2e6b30', url: 'https://kcdataprofessionals.org/', logo: '/images/groups/kc-data-professionals.webp' },
  { name: 'KC Postgres', slug: 'kc-postgres', tag: 'KC Postgres', tier: 1, color: '#6d4c2f', url: 'https://www.meetup.com/kansas-city-postgres-user-group/', logo: '/images/groups/kc-postgres.png' },
  { name: 'KC Tech Enthusiasts', slug: 'kc-tech-enthusiasts', tag: 'KC Tech Enthusiasts', tier: 3, color: '#7a4a8c', url: 'https://kctechenthusiasts.com/', logo: '/images/groups/kc-tech-enthusiasts.png' },
  { name: 'KCDNUG', slug: 'kcdnug', tag: 'KCDNUG', tier: 1, color: '#5b2a9e' },
  { name: 'KCJUG', fullName: 'Kansas City Java Users Group', slug: 'kcjug', tag: 'KCJUG', tier: 1, color: '#a34700', url: 'https://www.meetup.com/kansascityjug', logo: '/images/groups/kcjug.png' },
];

export const sponsors = [
  {
    tier: 'Gold',
    items: [
      { name: 'groundcover', logo: '/images/sponsors/groundcover.png', url: 'https://www.groundcover.com/' },
      { name: 'USDA', logo: '/images/sponsors/usda.webp', url: 'https://www.usda.gov/' },
    ],
  },
  { tier: 'Bronze', items: [{ name: 'Vindex', logo: '/images/sponsors/vindex.png' }] },
  { tier: 'Community partner', items: [{ name: 'Surya Consulting', logo: '/images/sponsors/surya-consulting.jpg' }] },
];

export const team = [
  { name: 'Nathan Mills', role: 'Executive Director', photo: '/images/team/nathan-mills.jpg', url: 'https://twitter.com/N4teM' },
  { name: 'Billy Korando', role: 'Co-Organizer', photo: '/images/team/billy-korando.webp', url: 'https://twitter.com/BillyKorando' },
  { name: 'Jeff Stephens', role: 'Co-Organizer', photo: '/images/team/jeff-stephens.webp' },
  { name: 'Jeremy Meiss', role: 'Co-Organizer', photo: '/images/team/jeremy-meiss.jpg' },
  { name: 'Jonathan Mills', role: 'Co-Organizer', photo: '/images/team/jonathan-mills.webp', url: 'https://twitter.com/jonathanfmills' },
];
