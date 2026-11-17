// All non-Sessionize content migrated from the Squarespace site.
// Edit this file to update the event, groups, sponsors and team.

export const event = {
  name: 'CommunityDays KC',
  year: 2026,
  tagline: "A two-day event celebrating the strength and diversity of Kansas City's tech community.",
  dates: { start: '2026-05-28', end: '2026-05-29', label: 'May 28 & 29, 2026' },
  venue: {
    host: 'Lifted Logic',
    name: 'Bel Air Building',
    address: '5600 W 95th St, Overland Park, KS',
    mapUrl: 'https://maps.google.com/?q=5600+W+95th+St,+Overland+Park,+KS',
  },
  timezone: 'America/Chicago',
  ticketsUrl: 'https://ti.to/kansas-city-developers-conference/communitydays-kc-2026',
  prospectusUrl: '/files/CommunityDays-2026-Sponsor-Prospectus.pdf',
  contactEmail: 'communitydays@kcdc.info',
  conductEmail: 'staff@kcdc.info',
};

export const nav = [
  { href: '/about/', label: 'About' },
  { href: '/schedule/', label: 'Schedule' },
  { href: '/sessions/', label: 'Sessions' },
  { href: '/speakers/', label: 'Speakers' },
  { href: '/sponsors/', label: 'Sponsors' },
  { href: '/code-of-conduct/', label: 'Code of Conduct' },
  { href: '/stay-informed/', label: 'Stay Informed' },
];

export const tickets = {
  note: 'One ticket to experience the whole event!',
  tiers: [
    { name: 'Early-Bird', price: 60, note: 'Available until April 27th' },
    { name: 'Full-Price', price: 100, note: 'Available after April 27th' },
  ],
};

// Participating meetup groups. `logo`/`url` are optional.
export const groups = [
  { name: 'Agile KC' },
  { name: 'Data Science KC', url: 'https://datasciencekc.org/', logo: '/images/groups/data-science-kc.webp' },
  { name: 'KC Data Professionals', url: 'https://kcdataprofessionals.org/', logo: '/images/groups/kc-data-professionals.webp' },
  { name: 'DevOpsDays KC', url: 'https://www.meetup.com/devops-kansas-city/', logo: '/images/groups/devopsdays-kc.webp' },
  { name: 'GDG KC' },
  { name: 'Global AI KC', url: 'https://globalai.community/chapters/kansas-city/', logo: '/images/groups/global-ai-kc.webp' },
  { name: 'IIBA Kansas City' },
  { name: 'KC AI Club' },
  { name: 'KCDNUG' },
  { name: 'Kansas City Java Users Group', short: 'KCJUG', url: 'https://www.meetup.com/kansascityjug', logo: '/images/groups/kcjug.png' },
  { name: 'KC Postgres', url: 'https://www.meetup.com/kansas-city-postgres-user-group/', logo: '/images/groups/kc-postgres.png' },
  { name: 'KC Tech Enthusiasts', url: 'https://kctechenthusiasts.com/', logo: '/images/groups/kc-tech-enthusiasts.png' },
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
  { tier: 'Community Partner', items: [{ name: 'Surya Consulting', logo: '/images/sponsors/surya-consulting.jpg' }] },
];

export const team = [
  { name: 'Nathan Mills', role: 'Executive Director', photo: '/images/team/nathan-mills.jpg', url: 'https://twitter.com/N4teM' },
  { name: 'Billy Korando', role: 'Co-Organizer', photo: '/images/team/billy-korando.webp', url: 'https://twitter.com/BillyKorando' },
  { name: 'Jeff Stephens', role: 'Co-Organizer', photo: '/images/team/jeff-stephens.webp' },
  { name: 'Jeremy Meiss', role: 'Co-Organizer', photo: '/images/team/jeremy-meiss.jpg' },
  { name: 'Jonathan Mills', role: 'Co-Organizer', photo: '/images/team/jonathan-mills.webp', url: 'https://twitter.com/jonathanfmills' },
];
