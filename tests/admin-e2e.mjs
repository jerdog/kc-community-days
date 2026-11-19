#!/usr/bin/env node
// End-to-end test of /admin against tests/mock-github.mjs.
//   1. node tests/mock-github.mjs            (port 9999)
//   2. npm run build && npx wrangler dev     (port 8787, with .dev.vars pointing GITHUB_API/GITHUB_WEB at the mock)
//   3. node tests/admin-e2e.mjs [--import]   (--import also runs a real Sessionize import)
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const SITE = process.env.SITE || 'http://localhost:8787';
const MOCK = process.env.MOCK || 'http://localhost:9999';
const require = createRequire(import.meta.url);
const axeSource = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
const mockFile = async (path, ref = 'main') => {
  const r = await fetch(`${MOCK}/__file?path=${encodeURIComponent(path)}&ref=${ref}`);
  return r.ok ? (await r.json()).text : null;
};
const refs = async () => (await (await fetch(`${MOCK}/__state`)).json()).refs;

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures++;
};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const announce = () => page.locator('#announce').textContent();
const waitAnnounce = (re) => page.waitForFunction((src) => new RegExp(src).test(document.querySelector('#announce')?.textContent || ''), re.source, { timeout: 120000 });

// Sign in
await page.goto(`${SITE}/admin/`);
check(page.url().endsWith('/admin/sign-in/'), 'signed-out visitors are sent to the sign-in page');
await page.getByRole('link', { name: 'Sign in with GitHub' }).click();
await page.waitForURL(`${SITE}/admin/`);
await page.waitForSelector('#sec-event');
check((await page.locator('#who').textContent()).includes('@test-admin'), 'signed in as the GitHub user');
check(await page.getByText('Everything is published.').isVisible(), 'draft bar says everything is published');

// Accessibility of the loaded admin page
await page.addScriptTag({ content: axeSource });
const axe = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }));
check(axe.violations.length === 0, `admin page has no axe WCAG 2.2 AA violations${axe.violations.length ? `: ${axe.violations.map((v) => `${v.id} (${v.nodes.length})`).join(', ')}` : ''}`);

// Save a change → draft
await page.getByLabel('Tagline').fill('Kansas City’s meetups, one roof. (admin test)');
await page.locator('#sec-event').getByRole('button', { name: 'Save to draft' }).click();
await waitAnnounce(/Saved to the draft/);
check((await refs())['admin-draft'], 'saving creates the draft branch');
check((await mockFile('site.config.json', 'admin-draft')).includes('(admin test)'), 'the change is committed to the draft');
check(!(await mockFile('site.config.json', 'main')).includes('(admin test)'), 'main is unchanged until publishing');
check(await page.getByText('1 unpublished change in the draft').isVisible(), 'draft bar shows 1 unpublished change');

// Validation: a ribbon color that fails contrast is refused, with the error tied to the field
const color = page.locator('#f-communities-0-color');
await color.fill('#ffff00');
await page.locator('#sec-communities').getByRole('button', { name: 'Save to draft' }).click();
await page.waitForSelector('#error-summary:not([hidden])');
check((await page.locator('#error-summary').textContent()).includes('4.5:1'), 'too-light ribbon color is reported in the error summary');
check((await color.getAttribute('aria-invalid')) === 'true', 'the color field is marked invalid');
check((await page.evaluate(() => document.activeElement.id)) === 'error-summary', 'focus moves to the error summary');
await page.reload();
await page.waitForSelector('#sec-event');

// Add and remove list items with announcements
await page.locator('#sec-team').getByRole('button', { name: 'Add organizer' }).click();
check((await announce()).includes('Organizer 6 added'), 'adding an organizer is announced');
check((await page.evaluate(() => document.activeElement.textContent)).startsWith('Organizer 6'), 'focus moves to the new organizer');
await page.locator('#sec-team').getByRole('button', { name: /Remove New organizer/ }).click();
check((await announce()).includes('Removed New organizer'), 'removing is announced');
await page.reload();
await page.waitForSelector('#sec-event');

// Publish
await page.getByRole('button', { name: 'Publish to the live site' }).click();
await page.getByRole('button', { name: 'Yes, publish' }).click();
await waitAnnounce(/Published/);
check((await mockFile('site.config.json', 'main')).includes('(admin test)'), 'publishing merges the draft into main');
check(!(await refs())['admin-draft'], 'publishing removes the draft branch');

// Upload a logo (1×1 PNG)
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
await page.locator('[data-upload="f-sponsors-1-items-0-logo"]').setInputFiles({ name: 'New Logo.png', mimeType: 'image/png', buffer: png });
await waitAnnounce(/Image uploaded/);
const logoPath = await page.locator('#f-sponsors-1-items-0-logo').inputValue();
check(/^\/images\/sponsors\/new-logo-[a-z0-9]+\.png$/.test(logoPath), `uploaded logo path filled in (${logoPath})`);
check(Boolean(await mockFile(`public${logoPath}`, 'admin-draft')), 'logo committed to the draft');
await page.locator('#sec-sponsors').getByRole('button', { name: 'Save to draft' }).click();
await waitAnnounce(/Saved to the draft/);

// Discard
await page.getByRole('button', { name: 'Discard draft' }).click();
await page.getByRole('button', { name: 'Yes, discard' }).click();
await waitAnnounce(/Draft discarded/);
check(!(await refs())['admin-draft'], 'discarding removes the draft branch');

// New year
await page.locator('#f-ny-year').fill('2027');
await page.getByRole('button', { name: /Archive 2026 and start/ }).click();
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Yes, start 2027' }).click()]);
await waitAnnounce(/archived and the draft is set up for 2027/);
const dlPath = await dl.path();
const dlBackup = JSON.parse(await readFile(dlPath, 'utf8'));
check(dlBackup.type === 'communitydays-backup' && dlBackup.files['site.config.json'].event.year === 2026 && dlBackup.reason === 'Before starting 2027', `starting a new year downloads a backup first (${dl.suggestedFilename()})`);
check((await page.locator('#sec-backups').textContent()).includes('Before starting 2027'), 'and saves it in the database');
const ny = JSON.parse(await mockFile('site.config.json', 'admin-draft'));
check(ny.event.year === 2027 && ny.event.start === null && ny.sessionize.eventId === null && ny.features.registration === false, 'new year resets the config in the draft');
check(Boolean(await mockFile('archive/2026/config.json', 'admin-draft')) && Boolean(await mockFile('archive/2026/sessionize.json', 'admin-draft')), 'new year archives 2026 in the draft');
check((await page.locator('#sec-years').textContent()).includes('Current year: 2027'), 'page reloads showing 2027');

// Backups: back up now, restore the pre-new-year backup, restore from a file, reject a bad file
await page.getByRole('button', { name: 'Back up now' }).click();
await waitAnnounce(/Backup #\d+ saved/);
check((await page.locator('#sec-backups tbody tr').count()) >= 2, 'Back up now adds a backup to the list');
const preNy = page.locator('#sec-backups tbody tr', { hasText: 'Before starting 2027' }).first();
await preNy.getByRole('button', { name: /Restore to draft/ }).click();
await page.getByRole('button', { name: 'Yes, restore to draft' }).click();
await waitAnnounce(/Restored backup #\d+/);
const restored = JSON.parse(await mockFile('site.config.json', 'admin-draft'));
check(restored.event.year === 2026 && restored.sessionize.eventId === '295atto3', 'restoring the pre-new-year backup brings back the 2026 settings');
check(!(await mockFile('archive/2026/config.json', 'admin-draft')), 'and removes the archive it created');
check((await page.locator('#sec-backups').textContent()).includes('Before restoring backup'), 'restoring saves a backup of the replaced state first');
await page.locator('#restore-file').setInputFiles(dlPath);
await page.getByRole('button', { name: 'Yes, restore to draft' }).click();
await waitAnnounce(/Restored an uploaded backup/);
check(JSON.parse(await mockFile('site.config.json', 'admin-draft')).event.year === 2026, 'restoring from a downloaded file works');
await page.locator('#restore-file').setInputFiles({ name: 'nope.json', mimeType: 'application/json', buffer: Buffer.from('{"type":"nope"}') });
await page.getByRole('button', { name: 'Yes, restore to draft' }).click();
await page.waitForSelector('#error-summary:not([hidden])');
check((await page.locator('#error-summary').textContent()).includes('isn’t a CommunityDays backup'), 'a file that isn’t a backup is refused');
await page.reload();
await page.waitForSelector('#sec-event');

// Sessionize import (real network), optional
if (process.argv.includes('--import')) {
  await page.locator('#f-sessionize-eventId').fill('295atto3');
  await page.locator('#sec-program').getByRole('button', { name: 'Import from Sessionize' }).click();
  await page.locator('#sec-program');
  check((await announce()).includes('Save your other changes'), 'import asks to save unsaved edits first');
  await page.reload();
  await page.waitForSelector('#sec-event');
  await page.evaluate(() => { const i = document.querySelector('#f-sessionize-eventId'); i.value = '295atto3'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#sec-switches').getByRole('button', { name: 'Save to draft' }).click();
  await waitAnnounce(/Saved to the draft|No changes to save/);
  await page.locator('#sec-program').getByRole('button', { name: 'Import from Sessionize' }).click();
  await waitAnnounce(/Imported \d+ speakers/);
  const data = JSON.parse(await mockFile('src/data/sessionize.json', 'admin-draft'));
  check(data.eventId === '295atto3' && data.speakers.length > 50 && data.speakers.every((s) => Array.isArray(s.bio)), `Sessionize import committed (${data.speakers.length} speakers with bios)`);
}

// Request forgery: state-changing calls without the admin header are refused
const forged = await page.evaluate(async () => (await fetch('/admin/api/discard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status);
check(forged === 403, 'POST without the admin header is refused (403)');

// Sign out, then a GitHub user without write access is turned away
await page.getByRole('button', { name: 'Sign out' }).click();
await page.waitForURL(/signed-out/);
check(await page.getByText('You’re signed out.').isVisible(), 'sign-out works');
await page.goto(`${SITE}/admin/auth/callback?code=admin&state=forged`);
await page.waitForURL(/sign-in/);
check(page.url().includes('error=state'), 'a callback with a mismatched state is refused');
const ctx2 = await browser.newContext();
const start = await ctx2.request.get(`${SITE}/admin/login`, { maxRedirects: 0 });
const authUrl = new URL(start.headers().location);
authUrl.searchParams.set('login', 'viewer');
const p2 = await ctx2.newPage();
await p2.goto(authUrl.toString());
await p2.waitForURL(/sign-in/);
check(p2.url().includes('error=access') && (await p2.getByText('doesn’t have write access').isVisible()), 'a GitHub user without write access is turned away');
const viewerApi = await ctx2.request.get(`${SITE}/admin/api/state`);
check(viewerApi.status() === 401, 'and gets no session');

await browser.close();
console.log(failures ? `\n${failures} check(s) failed.` : '\nAll admin checks passed.');
process.exit(failures ? 1 : 0);
