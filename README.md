# communitydays.info

Website for **CommunityDays KC**, migrated from Squarespace to [Astro](https://astro.build) on **Cloudflare Workers**.

## How it fits together

| Piece | What it does |
| --- | --- |
| `src/pages/` | Home, Program (+ a page and `.ics` per talk), Speakers (+ a page each), Communities (+ a page each), Attend, Sponsor, About, Code of Conduct, Feedback |
| `src/data/site.js` | Event details, tickets, communities (lineup tier and ribbon color), sponsors and organizers. **Edit this to update the site.** |
| `src/data/sessionize.json` | Speakers, sessions and schedule from Sessionize (generated) |
| `src/styles/site.css` | The "Lineup" design system |
| `worker/index.js` | Worker entry. Static files come from the assets binding; only `/api/*` runs code |
| `migrations/` | D1 schema for the signup, sponsor inquiry and feedback forms |
| `public/_redirects` | 301s for old Squarespace URLs |
| `tests/a11y.mjs` | WCAG 2.2 AA check of every page at 1280px and 320px |

The homepage switches from "buy tickets" to "save the date" once the event's end date has passed (decided at build time). Preview the pre-event version with `EVENT_STATE=upcoming npm run build`.

## Develop

```bash
npm install
npm run dev                 # Astro dev server (pages only)
npm run db:migrate:local    # once, creates the local D1 tables
npm run preview             # build + wrangler dev: full site incl. /api forms on :8787
npm run test:a11y           # WCAG 2.2 AA check; run before committing UI changes
```

## Update speakers and schedule from Sessionize

```bash
npm run import:sessionize            # default event id 295atto3
npm run import:sessionize -- <newId> # next year's event
```

Commit the updated `src/data/sessionize.json`. Sessionize is the source of truth; nothing is entered twice.

## Deploy (first time)

```bash
npx wrangler login
npx wrangler d1 create communitydays   # paste database_id into wrangler.jsonc
npm run db:migrate
npm run deploy
```

Then uncomment the `routes` block in `wrangler.jsonc` and redeploy to attach `communitydays.info` once DNS is on Cloudflare.

Reading form submissions:

```bash
npx wrangler d1 execute communitydays --remote --command "SELECT * FROM sponsor_inquiries ORDER BY created_at DESC"
```
