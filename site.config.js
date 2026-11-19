// ─────────────────────────────────────────────────────────────────────────────
// CommunityDays KC: site configuration
//
// This is the one file to edit for a new year or a content change. Everything
// else (date labels, the current ticket price, "save the date" mode, next-year
// wording, counts) is worked out from it when the site builds.
//
// New year checklist:
//   1. Update `event` (start/end dates, venue) and `tickets`.
//   2. Set `sessionize.eventId` to the new Sessionize event, then run
//      `npm run import:sessionize`. Until you do, the program and speaker pages
//      show "coming soon" instead of last year's talks.
//   3. Update `links.tickets`, `links.prospectus`, `communities` and `sponsors`.
// Dates are written as YYYY-MM-DD in the event's local time zone.
// ─────────────────────────────────────────────────────────────────────────────

export default {
  event: {
    name: 'CommunityDays KC',
    tagline: "Kansas City's meetups, under one roof.",
    description:
      "CommunityDays KC is a two-day event celebrating the strength and diversity of Kansas City's tech community. It brings the city's meetup groups together to collaborate on content and build community.",
    start: '2026-05-28',
    end: '2026-05-29',
    timezone: 'America/Chicago',
    venue: {
      host: 'Lifted Logic',
      name: 'Bel Air Building',
      street: '5600 W 95th St',
      city: 'Overland Park, KS',
      mapUrl: 'https://maps.google.com/?q=5600+W+95th+St,+Overland+Park,+KS',
    },
  },

  // Homepage mode: 'auto' switches to "save the date" the day after `event.end`.
  // Force it with 'upcoming' or 'past' (e.g. while announcing next year early).
  homepage: { mode: 'auto' },

  links: {
    tickets: 'https://ti.to/kansas-city-developers-conference/communitydays-kc-2026',
    prospectus: '/files/CommunityDays-2026-Sponsor-Prospectus.pdf',
    callForSpeakers: null, // e.g. 'https://sessionize.com/communitydays-kc-2027/'
    contactEmail: 'communitydays@kcdc.info',
    conductEmail: 'staff@kcdc.info',
  },

  // Sessionize event that `npm run import:sessionize` pulls from.
  sessionize: { eventId: '295atto3' },

  tickets: {
    note: 'One badge covers both days and every room.',
    // Tiers in order. `until` is the last day a tier is on sale; leave it off the last tier.
    tiers: [
      { name: 'Early-bird', price: 60, until: '2026-04-27' },
      { name: 'Full price', price: 100 },
    ],
  },

  // Homepage list of communities (shown as ribbons).
  lineup: {
    // Order of the list: 'talks' (most talks first), 'alphabetical', or 'listed'
    // (the order of `communities` below).
    order: 'talks',
    // Communities to put first, by slug, before the rest of the order applies.
    // Example: ['devopsdays-kc', 'kcjug']
    featured: [],
    // On phones, show this many and a "Show all" button for the rest.
    mobileCount: 5,
  },

  nav: [
    { href: '/program/', label: 'Program' },
    { href: '/speakers/', label: 'Speakers' },
    { href: '/communities/', label: 'Communities' },
    { href: '/attend/', label: 'Attend' },
    { href: '/sponsor/', label: 'Sponsor' },
  ],

  // Participating communities.
  // - tag:   the "group" name used in Sessionize, to match talks to the community
  // - color: ribbon color. Must keep 4.5:1+ contrast with white text
  //          (check at https://webaim.org/resources/contrastchecker/).
  communities: [
    { name: 'Agile KC', slug: 'agile-kc', tag: 'Agile KC', color: '#00687a' },
    { name: 'Data Science KC', slug: 'data-science-kc', tag: 'Data Science KC', color: '#0b6e4f', url: 'https://datasciencekc.org/', logo: '/images/groups/data-science-kc.webp' },
    { name: 'DevOpsDays KC', slug: 'devopsdays-kc', tag: 'DevOpsDays KC', color: '#b3261e', url: 'https://www.meetup.com/devops-kansas-city/', logo: '/images/groups/devopsdays-kc.webp' },
    { name: 'GDG KC', slug: 'gdg-kc', tag: 'GDG KC', color: '#4d5e10' },
    { name: 'Global AI KC', slug: 'global-ai-kc', tag: 'Global AI KC', color: '#1d5bb8', url: 'https://globalai.community/chapters/kansas-city/', logo: '/images/groups/global-ai-kc.webp' },
    { name: 'IIBA Kansas City', slug: 'iiba-kc', tag: 'IIBA Kansas City', color: '#8e1f5f' },
    { name: 'KC AI Club', slug: 'kc-ai-club', tag: 'KC AI Club', color: '#3b4a6b' },
    { name: 'KC Data Professionals', slug: 'kc-data-professionals', tag: 'KC Data Professionals', color: '#2e6b30', url: 'https://kcdataprofessionals.org/', logo: '/images/groups/kc-data-professionals.webp' },
    { name: 'KC Postgres', slug: 'kc-postgres', tag: 'KC Postgres', color: '#6d4c2f', url: 'https://www.meetup.com/kansas-city-postgres-user-group/', logo: '/images/groups/kc-postgres.png' },
    { name: 'KC Tech Enthusiasts', slug: 'kc-tech-enthusiasts', tag: 'KC Tech Enthusiasts', color: '#7a4a8c', url: 'https://kctechenthusiasts.com/', logo: '/images/groups/kc-tech-enthusiasts.png' },
    { name: 'KCDNUG', slug: 'kcdnug', tag: 'KCDNUG', color: '#5b2a9e' },
    { name: 'KCJUG', fullName: 'Kansas City Java Users Group', slug: 'kcjug', tag: 'KCJUG', color: '#a34700', url: 'https://www.meetup.com/kansascityjug', logo: '/images/groups/kcjug.png' },
  ],

  // Sponsors by tier, highest first.
  // - badge:  text on the sponsor badge's top strip (homepage)
  // - gold:   true gives the badge a gold strip
  // - ribbon: ribbon color under the badge; must keep 4.5:1+ contrast with white text
  // - hero:   true lists this tier's logos in the homepage hero ("Presented with support from")
  // Logos sit on a white backing, so dark artwork on a transparent or white background works best.
  sponsors: [
    {
      tier: 'Gold',
      badge: 'GOLD SPONSOR',
      gold: true,
      ribbon: '#7a5a00',
      hero: true,
      items: [
        { name: 'groundcover', logo: '/images/sponsors/groundcover.png', url: 'https://www.groundcover.com/' },
        { name: 'USDA', logo: '/images/sponsors/usda.webp', url: 'https://www.usda.gov/' },
      ],
    },
    {
      tier: 'Bronze',
      badge: 'BRONZE SPONSOR',
      ribbon: '#8a4b20',
      items: [{ name: 'Vindex', logo: '/images/sponsors/vindex.png' }],
    },
    {
      tier: 'Community partner',
      badge: 'PARTNER',
      ribbon: '#303086',
      items: [{ name: 'Surya Consulting', logo: '/images/sponsors/surya-consulting.png' }],
    },
  ],

  team: [
    { name: 'Nathan Mills', role: 'Executive Director', photo: '/images/team/nathan-mills.jpg', url: 'https://twitter.com/N4teM' },
    { name: 'Billy Korando', role: 'Co-Organizer', photo: '/images/team/billy-korando.webp', url: 'https://twitter.com/BillyKorando' },
    { name: 'Jeff Stephens', role: 'Co-Organizer', photo: '/images/team/jeff-stephens.webp' },
    { name: 'Jeremy Meiss', role: 'Co-Organizer', photo: '/images/team/jeremy-meiss.jpg' },
    { name: 'Jonathan Mills', role: 'Co-Organizer', photo: '/images/team/jonathan-mills.webp', url: 'https://twitter.com/jonathanfmills' },
  ],
};
