# communitydays.info

Website for **CommunityDays KC**, migrated from Squarespace to [Astro](https://astro.build) on **Cloudflare Workers**.

## How it fits together

| Piece | What it does |
| --- | --- |
| `src/pages/*.astro` | Every page, statically built into `dist/` |
| `src/data/site.js` | Event details, tickets, meetup groups, sponsors and team. **Edit this to update the site.** |
| `src/data/sessionize.json` | Speakers, sessions and schedule snapshot from Sessionize (generated) |
| `worker/index.js` | Worker entry. Static files come from the assets binding; only `/api/*` runs code |
| `migrations/` | D1 schema for the three forms (Stay Informed, sponsor inquiry, feedback) |
| `public/_redirects` | 301s for old Squarespace URLs |

## Develop

```bash
npm install
npm run dev                 # Astro dev server (pages only)
npm run db:migrate:local    # once, creates the local D1 tables
npm run preview             # build + wrangler dev: full site incl. /api forms on :8787
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
