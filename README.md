# communitydays.info

Website for **CommunityDays KC**, migrated from Squarespace to [Astro](https://astro.build) on **Cloudflare Workers**.

## How it fits together

| Piece | What it does |
| --- | --- |
| `src/pages/` | Home, Program (+ a page and `.ics` per talk), Speakers (+ a page each), Communities (+ a page each), Attend, Sponsor, About, Code of Conduct, Feedback |
| `site.config.js` | **The one file to edit.** Event dates and venue, ticket tiers, links, Sessionize event ID, homepage lineup, communities, sponsors and organizers. Has a new-year checklist at the top. |
| `src/lib/site.js` | Derives date labels, the current ticket tier and pre/post-event mode from the config |
| `src/data/sessionize.json` | Speakers, sessions and schedule from Sessionize (generated) |
| `src/styles/site.css` | The "Lineup" design system |
| `worker/index.js` | Worker entry. Static files come from the assets binding; only `/api/*` runs code |
| `migrations/` | D1 schema for the signup, sponsor inquiry and feedback forms |
| `public/_redirects` | 301s for old Squarespace URLs |
| `tests/a11y.mjs` | WCAG 2.2 AA check of every page at 1280px and 320px |

The homepage switches from "buy tickets" to "save the date" once the event's end date has passed, and the ticket price follows the tier deadlines (both decided at build time, so a deploy after a deadline picks it up). Preview with `EVENT_STATE=upcoming npm run build` or `SITE_TODAY=2026-03-01 npm run build`.

If `site.config.js` names a different Sessionize event than the imported data, the program, speaker and community pages show "coming soon" instead of the old talks.

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
npm run import:sessionize            # uses sessionize.eventId from site.config.js
npm run import:sessionize -- <id>    # one-off override
```

Commit the updated `src/data/sessionize.json`. Sessionize is the source of truth; nothing is entered twice.

## Deploying

Pushing to the production branch deploys automatically through **Workers Builds** (Cloudflare dashboard → the `communitydays` Worker → **Settings → Builds**):

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |
| Preview command | `npm run deploy:preview` |

`npm run deploy` builds the site, applies any new D1 migrations to the live database, then deploys the Worker. If a migration fails, the deploy stops and the old version keeps serving. Branch previews use a separate database, `communitydays-preview`, so testing a form on a preview never touches production data. `npm run deploy:preview` applies new migrations to that database first, so migrations get tried on previews before they reach production.

The build token Workers Builds created needs **Account → D1 → Edit** added (My Profile → API Tokens → the Workers Builds token → Edit), or the migration step fails with an authentication error.

You can run the same thing by hand: `npx wrangler login`, then `npm run deploy`.

## Database changes (migrations)

Schema changes go in `migrations/` as numbered SQL files. Each runs once, in order, on the next deploy.

**From a browser (GitHub web editor):** add a file named with the next number, e.g. `migrations/0002_add_speaker_signups.sql`, containing the SQL. Commit to the production branch.

**From a terminal or Claude Code:** `npm run db:new -- add_speaker_signups` creates the numbered file for you. Test it with `npm run db:migrate:local`.

Rules that keep this safe:

- Never edit or rename a migration that has already been deployed. Add a new one instead.
- Prefer additive changes (`CREATE TABLE`, `ADD COLUMN`). Migrations run *before* the new code goes live, so the old code briefly runs against the new schema.
- D1 takes a backup before applying; restore with Time Travel if needed.
- See what has been applied with `npm run db:migrations`.

Reading form submissions:

```bash
npx wrangler d1 execute DB --remote --command "SELECT * FROM sponsor_inquiries ORDER BY created_at DESC"
```
