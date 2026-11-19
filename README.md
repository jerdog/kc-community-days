# communitydays.info

Website for **CommunityDays KC**, migrated from Squarespace to [Astro](https://astro.build) on **Cloudflare Workers**.

## How it fits together

| Piece | What it does |
| --- | --- |
| `src/pages/` | Home, Program (+ a page and `.ics` per talk), Speakers (+ a page each), Communities (+ a page each), Attend, Sponsor, About, Code of Conduct, Feedback |
| `site.config.json` | **The one file to edit.** Event dates and venue, ticket tiers, links, Sessionize event ID, homepage lineup, communities, sponsors and organizers. Has a new-year checklist at the top. |
| `src/lib/site.js` | Derives date labels, the current ticket tier and pre/post-event mode from the config |
| `src/data/sessionize.json` | Speakers, sessions and schedule from Sessionize (generated) |
| `src/styles/site.css` | The "Lineup" design system |
| `worker/index.js` | Worker entry. Static files come from the assets binding; only `/api/*` runs code |
| `migrations/` | D1 schema for the signup, sponsor inquiry and feedback forms |
| `public/_redirects` | 301s for old Squarespace URLs |
| `tests/a11y.mjs` | WCAG 2.2 AA check of every page at 1280px and 320px |

The homepage switches from "buy tickets" to "save the date" once the event's end date has passed, and the ticket price follows the tier deadlines (both decided at build time, so a deploy after a deadline picks it up). Preview with `EVENT_STATE=upcoming npm run build` or `SITE_TODAY=2026-03-01 npm run build`.

If `site.config.json` names a different Sessionize event than the imported data, the program, speaker and community pages show "coming soon" instead of the old talks.

## Admin page (`/admin`)

Organizers edit everything in `site.config.json` at **https://communitydays.jerdog.workers.dev/admin/**: event details, the call-for-speakers and registration switches, links, ticket tiers, the homepage community list, communities (with a live ribbon-contrast check), sponsors and logos, organizers and the menu. It can also import the program from Sessionize and start a new year (archiving the current one).

- **Sign-in:** GitHub. Anyone with write access to this repository can sign in; set `ADMIN_USERS` in `wrangler.jsonc` to narrow it to specific GitHub usernames.
- **Drafts:** every save is committed (with the admin's GitHub name) to the `admin-draft` branch, which Workers Builds turns into a preview. **Publish** merges the draft into `main`, which deploys the site; **Discard** deletes the draft.
- **Security:** the session is an encrypted, HttpOnly cookie that expires after 8 hours. The admin only works on `ADMIN_ORIGIN` (not on previews), and changes are made with the admin's own GitHub token, so GitHub's own permissions apply.

### One-time setup

1. Create a GitHub OAuth app at **github.com → Settings → Developer settings → OAuth Apps → New OAuth App**:
   - Homepage URL: `https://communitydays.jerdog.workers.dev`
   - Authorization callback URL: `https://communitydays.jerdog.workers.dev/admin/auth/callback`
2. Put its **Client ID** in `wrangler.jsonc` → `vars.GITHUB_CLIENT_ID` (it isn't secret).
3. In Cloudflare: **Workers & Pages → communitydays → Settings → Variables and Secrets**, add two **Secrets**:
   - `GITHUB_CLIENT_SECRET`: generate one in the OAuth app
   - `SESSION_SECRET`: a long random string, e.g. the output of `openssl rand -base64 32`
4. Deploy (push to `main`). Until all of these exist, `/admin` shows which ones are missing.

When the site moves to `communitydays.info`, change `ADMIN_ORIGIN` and the OAuth app's URLs to match.

### Testing the admin locally

```bash
node tests/mock-github.mjs          # stand-in for GitHub on :9999
npm run build && npx wrangler dev    # with .dev.vars (see tests/admin-e2e.mjs) on :8787
node tests/admin-e2e.mjs             # add --import to also run a real Sessionize import
```

`.dev.vars` for local testing:

```
GITHUB_CLIENT_ID=test-client
GITHUB_CLIENT_SECRET=test-secret
SESSION_SECRET=local-dev-only-session-secret
GITHUB_API=http://localhost:9999
GITHUB_WEB=http://localhost:9999
```

## Starting a new year

From the admin page: **Years → Start a new year** (recommended). Or from GitHub: **Actions → Start new year → Run workflow**, enter the year (and dates if known). It opens a pull request; review `site.config.json` and merge. (One-time setting: Settings → Actions → General → allow GitHub Actions to create pull requests.)

From a terminal: `npm run new-year -- 2027` or `npm run new-year -- 2027 2027-06-03 2027-06-04`.

Either way the current year is archived to `archive/<year>/` and served at `/<year>/`, old talk and speaker links redirect there, and `site.config.json` is reset with the call for speakers and registration off. Then, as the year goes on, flip the switches in `site.config.json` (`features`): open the call for speakers, add dates, open registration, and set `sessionize.eventId` + run `npm run import:sessionize` once talks are selected. Until then the site shows last year's speakers and sponsors, clearly labelled.

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
npm run import:sessionize            # uses sessionize.eventId from site.config.json
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
