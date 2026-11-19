// /admin: sign in with GitHub, then edit site.config.json through a draft branch.
//
// Who can sign in: GitHub users with write (push) access to ADMIN_REPO, optionally
// narrowed by ADMIN_USERS (comma-separated logins). Every change is made with the
// admin's own GitHub token, so commits show who made them.
//
// Changes are saved to ADMIN_DRAFT_BRANCH (which Workers Builds turns into a preview),
// then "Publish" merges the draft into ADMIN_BRANCH (main), which deploys the site.
import { seal, unseal, readCookie, cookie } from './session.js';
import { github, GitHubError } from './github.js';
import { setupPage } from './page.js';
import { validateConfig } from '../../src/lib/config-schema.js';
import { startNewYear, toJson } from '../../src/lib/new-year.js';
import { fetchOverview, fetchBios, assemble } from '../../src/lib/sessionize-import.js';
import { checkBackup, backupFileName, summary } from '../../src/lib/backup.js';
import { saveBackup, listBackups, getBackup, filesAt } from './backups.js';

const SESSION = 'cdkc_admin';
const STATE = 'cdkc_oauth_state';
const SESSION_TTL = 8 * 60 * 60;
const CONFIG = 'site.config.json';
const DATA = 'src/data/sessionize.json';
const UPLOAD_DIRS = { sponsor: 'sponsors', community: 'groups', team: 'team' };
const IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const MAX_UPLOAD = 1.5 * 1024 * 1024;

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const redirect = (to, headers = {}) => new Response(null, { status: 302, headers: { location: to, 'cache-control': 'no-store', ...headers } });
const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'image';

function settings(env) {
  return {
    branch: env.ADMIN_BRANCH || 'main',
    draft: env.ADMIN_DRAFT_BRANCH || 'admin-draft',
    users: (env.ADMIN_USERS || '').split(',').map((u) => u.trim().toLowerCase()).filter(Boolean),
    previewUrl: (branch) => (env.PREVIEW_URL_TEMPLATE || '').replace('{branch}', branch.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
  };
}

// Admin only answers on the production origin (and localhost for development),
// so preview copies of the site can't be used to edit the real repository.
function allowedOrigin(url, env) {
  if (['localhost', '127.0.0.1'].includes(url.hostname)) return true;
  return Boolean(env.ADMIN_ORIGIN) && url.origin === env.ADMIN_ORIGIN;
}

export async function handleAdmin(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/admin';

  if (!allowedOrigin(url, env)) return env.ASSETS.fetch(new Request(new URL('/404.html', url), request)).then((r) => new Response(r.body, { status: 404, headers: r.headers }));
  const missing = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'SESSION_SECRET', 'ADMIN_REPO'].filter((k) => !env[k]);
  if (missing.length) return setupPage(missing);

  // ---- Sign-in flow (public) ----
  if (path === '/admin/sign-in') return env.ASSETS.fetch(request);
  if (path === '/admin/login') {
    const state = crypto.randomUUID();
    const auth = new URL('/login/oauth/authorize', env.GITHUB_WEB || 'https://github.com');
    auth.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
    auth.searchParams.set('redirect_uri', `${url.origin}/admin/auth/callback`);
    auth.searchParams.set('scope', env.GITHUB_OAUTH_SCOPE || 'public_repo');
    auth.searchParams.set('state', state);
    auth.searchParams.set('allow_signup', 'false');
    return redirect(auth.toString(), { 'set-cookie': cookie(STATE, state, { maxAge: 600 }) });
  }
  if (path === '/admin/auth/callback') return callback(request, env, url);
  if (path === '/admin/logout' && request.method === 'POST') {
    return redirect('/admin/sign-in/?signed-out=1', { 'set-cookie': cookie(SESSION, '', { maxAge: 0 }) });
  }

  // ---- Everything else needs a session ----
  const session = await unseal(readCookie(request, SESSION) || '', env.SESSION_SECRET);
  if (!session) {
    if (path.startsWith('/admin/api/')) return json({ error: 'Your session has ended. Sign in again.' }, 401);
    return redirect('/admin/sign-in/');
  }
  if (!path.startsWith('/admin/api/')) return env.ASSETS.fetch(request);

  // State-changing API calls must come from the admin page itself.
  if (request.method !== 'GET') {
    if (request.headers.get('origin') !== url.origin || request.headers.get('x-admin') !== '1') return json({ error: 'Request blocked.' }, 403);
  }
  try {
    return await api(request, env, url, path, session);
  } catch (e) {
    if (e instanceof GitHubError) return json({ error: e.message }, e.status === 409 ? 409 : e.status === 401 ? 401 : 502);
    if (e instanceof UserError) return json({ error: e.message, errors: e.errors }, 400);
    console.error('admin api failed', e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
}

class UserError extends Error {
  constructor(message, errors) {
    super(message);
    this.errors = errors;
  }
}

async function callback(request, env, url) {
  const fail = (code) => redirect(`/admin/sign-in/?error=${code}`, { 'set-cookie': cookie(STATE, '', { maxAge: 0 }) });
  const state = readCookie(request, STATE);
  if (!state || url.searchParams.get('state') !== state) return fail('state');
  const code = url.searchParams.get('code');
  if (!code) return fail('denied');

  const res = await fetch(new URL('/login/oauth/access_token', env.GITHUB_WEB || 'https://github.com'), {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'communitydays-admin' },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: `${url.origin}/admin/auth/callback` }),
  });
  const tok = await res.json().catch(() => ({}));
  if (!tok.access_token) return fail('token');

  const gh = github(tok.access_token, env);
  const [user, repo] = await Promise.all([gh.user(), gh.repo().catch(() => null)]);
  const { users } = settings(env);
  if (!repo?.permissions?.push || (users.length && !users.includes(user.login.toLowerCase()))) return fail('access');

  const session = await seal({ login: user.login, name: user.name || user.login, avatar: user.avatar_url, token: tok.access_token }, env.SESSION_SECRET, SESSION_TTL);
  return new Response(null, {
    status: 302,
    headers: [
      ['location', '/admin/'],
      ['cache-control', 'no-store'],
      ['set-cookie', cookie(SESSION, session, { maxAge: SESSION_TTL })],
      ['set-cookie', cookie(STATE, '', { maxAge: 0 })],
    ],
  });
}

async function api(request, env, url, path, session) {
  const gh = github(session.token, env);
  const s = settings(env);
  const body = request.method === 'GET' ? null : await request.json().catch(() => ({}));
  const who = `@${session.login}`;

  // Where edits go: the draft branch, created from main on first save.
  const refs = async () => {
    const [main, draft] = await Promise.all([gh.refSha(s.branch), gh.refSha(s.draft)]);
    return { main, draft, head: draft || main };
  };
  // Make sure the draft exists and still matches what the admin loaded.
  async function draftParent(expectedHead) {
    const r = await refs();
    if (expectedHead && expectedHead !== r.head) throw new GitHubError(409, 'Someone else saved changes in the meantime. Reload to see them, then make your change again.');
    if (!r.draft) await gh.createRef(s.draft, r.main);
    return r.head;
  }
  const readJson = async (file, ref) => {
    const text = await gh.readText(file, ref);
    return text ? JSON.parse(text) : null;
  };

  if (path === '/admin/api/state' && request.method === 'GET') {
    const r = await refs();
    const [config, data, archiveDir, diff] = await Promise.all([
      readJson(CONFIG, r.head),
      readJson(DATA, r.head),
      gh.listDir('archive', r.head),
      r.draft ? gh.compare(s.branch, s.draft) : null,
    ]);
    return json({
      user: { login: session.login, name: session.name, avatar: session.avatar },
      repo: env.ADMIN_REPO,
      head: r.head,
      draft: r.draft
        ? { exists: true, branch: s.draft, previewUrl: s.previewUrl(s.draft), ahead: diff.ahead, behind: diff.behind, files: diff.files, commits: diff.commits }
        : { exists: false, branch: s.draft, previewUrl: s.previewUrl(s.draft) },
      config,
      program: data ? { eventId: data.eventId, importedAt: data.importedAt, speakers: data.speakers.length, sessions: data.sessions.length } : null,
      archives: archiveDir.filter((d) => d.type === 'dir' && /^\d{4}$/.test(d.name)).map((d) => Number(d.name)).sort((a, b) => b - a),
      backups: await listBackups(env).catch((e) => (console.error('backups unavailable', e), null)),
    });
  }

  if (path === '/admin/api/config' && request.method === 'PUT') {
    const errors = validateConfig(body.config);
    if (errors.length) throw new UserError('Some settings need fixing before they can be saved.', errors);
    const parent = await draftParent(body.head);
    const before = await readJson(CONFIG, parent);
    const changed = Object.keys(body.config).filter((k) => JSON.stringify(body.config[k]) !== JSON.stringify(before?.[k]));
    if (!changed.length) return json({ ok: true, head: parent, message: 'No changes to save.' });
    const head = await gh.commit(s.draft, parent, [{ path: CONFIG, text: toJson(body.config) }], `Admin: update ${changed.join(', ')}\n\nSaved by ${who} in the admin page.`);
    return json({ ok: true, head, message: `Saved to the draft (${changed.join(', ')}).` });
  }

  if (path === '/admin/api/upload' && request.method === 'POST') {
    const dir = UPLOAD_DIRS[body.kind];
    const ext = IMAGE_TYPES[body.type];
    if (!dir) throw new UserError('Unknown upload type.');
    if (!ext) throw new UserError('Upload a PNG, JPEG or WebP image.');
    const size = Math.floor((String(body.data || '').length * 3) / 4);
    if (!size || size > MAX_UPLOAD) throw new UserError('Images must be smaller than 1.5 MB.');
    const file = `public/images/${dir}/${slug(body.name)}-${Date.now().toString(36)}.${ext}`;
    const parent = await draftParent(body.head);
    const head = await gh.commit(s.draft, parent, [{ path: file, base64: body.data }], `Admin: upload ${file.split('/').pop()}\n\nUploaded by ${who} in the admin page.`);
    return json({ ok: true, head, path: file.replace(/^public/, ''), message: 'Image uploaded to the draft. Save your settings to use it.' });
  }

  if (path === '/admin/api/new-year' && request.method === 'POST') {
    const parent = await draftParent(body.head);
    const [config, data, archiveDir] = await Promise.all([readJson(CONFIG, parent), readJson(DATA, parent), gh.listDir('archive', parent)]);
    let result;
    try {
      result = startNewYear(config, data, { year: body.year, start: body.start || null, end: body.end || null }, archiveDir.map((d) => d.name));
    } catch (e) {
      throw new UserError(e.message);
    }
    const errors = validateConfig(result.files[CONFIG]);
    if (errors.length) throw new UserError('The new year would have invalid settings.', errors);
    // Back up first; if that fails, change nothing.
    let saved;
    try {
      saved = await saveBackup(env, gh, parent, { createdBy: who, reason: `Before starting ${result.newYear}` });
    } catch (e) {
      console.error('backup before new year failed', e);
      throw new UserError('Couldn’t save a backup, so nothing was changed. Try again, or back up from the Backups section first.');
    }
    const files = Object.entries(result.files).map(([p, v]) => ({ path: p, text: toJson(v) }));
    const head = await gh.commit(s.draft, parent, files, `Admin: start ${result.newYear}, archive ${result.oldYear}\n\nStarted by ${who} in the admin page (backup #${saved.id} saved first).`);
    return json({ ok: true, head, backup: { id: saved.id, download: `/admin/api/backups/${saved.id}/download` }, message: `Backup #${saved.id} saved. ${result.oldYear} is archived and the draft is set up for ${result.newYear}. Check the preview, then publish.` });
  }

  // Sessionize import in three steps so each request stays within Cloudflare's fetch limit.
  if (path === '/admin/api/import/overview' && request.method === 'POST') {
    if (!/^[a-z0-9]+$/i.test(body.eventId || '')) throw new UserError('Enter the Sessionize event ID (letters and numbers, like 295atto3).');
    try {
      return json({ ok: true, overview: await fetchOverview(body.eventId) });
    } catch (e) {
      throw new UserError(e.message);
    }
  }
  if (path === '/admin/api/import/bios' && request.method === 'POST') {
    const ids = (body.ids || []).slice(0, 40);
    try {
      return json({ ok: true, bios: await fetchBios(body.eventId, ids) });
    } catch (e) {
      throw new UserError(e.message);
    }
  }
  if (path === '/admin/api/import/save' && request.method === 'POST') {
    const { eventId, overview, bios } = body;
    if (!Array.isArray(overview?.speakers) || !Array.isArray(overview?.sessions) || !Array.isArray(overview?.rooms)) throw new UserError('Import data is incomplete. Start the import again.');
    const data = assemble(eventId, overview, bios || {});
    const parent = await draftParent(body.head);
    const config = await readJson(CONFIG, parent);
    const files = [{ path: DATA, text: toJson(data) }];
    if (config.sessionize?.eventId !== eventId) files.push({ path: CONFIG, text: toJson({ ...config, sessionize: { ...config.sessionize, eventId } }) });
    const head = await gh.commit(s.draft, parent, files, `Admin: import Sessionize ${eventId} (${data.speakers.length} speakers, ${data.sessions.length} sessions)\n\nImported by ${who} in the admin page.`);
    return json({ ok: true, head, message: `Imported ${data.speakers.length} speakers and ${data.sessions.length} sessions into the draft.` });
  }

  // ---- Backups
  if (path === '/admin/api/backups' && request.method === 'POST') {
    const r = await refs();
    const saved = await saveBackup(env, gh, r.head, { createdBy: who, reason: String(body.reason || '').slice(0, 200) || 'Manual backup' });
    return json({ ok: true, backup: { id: saved.id, download: `/admin/api/backups/${saved.id}/download` }, message: `Backup #${saved.id} saved (${summary(saved.backup)}).` });
  }
  let m;
  if ((m = path.match(/^\/admin\/api\/backups\/(\d+)\/download$/)) && request.method === 'GET') {
    const backup = await getBackup(env, Number(m[1]));
    if (!backup) return json({ error: 'Backup not found.' }, 404);
    return new Response(JSON.stringify(backup, null, 2) + '\n', {
      headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="${backupFileName(backup)}"`, 'cache-control': 'no-store' },
    });
  }
  const restore = async (backup, label) => {
    const problems = checkBackup(backup);
    if (problems.length) throw new UserError('This backup can’t be restored.', problems.map((message) => ({ path: 'backup', message })));
    const parent = await draftParent(body.head);
    const safety = await saveBackup(env, gh, parent, { createdBy: who, reason: `Before restoring ${label}` });
    const current = Object.keys(await filesAt(gh, parent));
    const files = [
      ...Object.entries(backup.files).map(([p, v]) => ({ path: p, text: toJson(v) })),
      ...current.filter((p) => p.startsWith('archive/') && !(p in backup.files)).map((p) => ({ path: p, remove: true })),
    ];
    const head = await gh.commit(s.draft, parent, files, `Admin: restore ${label} (${summary(backup)})\n\nRestored by ${who} in the admin page (backup #${safety.id} of the previous state saved first).`);
    return json({ ok: true, head, message: `Restored ${label} into the draft. The previous state is saved as backup #${safety.id}. Check the preview, then publish.` });
  };
  if ((m = path.match(/^\/admin\/api\/backups\/(\d+)\/restore$/)) && request.method === 'POST') {
    const backup = await getBackup(env, Number(m[1]));
    if (!backup) return json({ error: 'Backup not found.' }, 404);
    return restore(backup, `backup #${m[1]} from ${backup.createdAt.slice(0, 10)}`);
  }
  if (path === '/admin/api/backups/restore-file' && request.method === 'POST') {
    return restore(body.backup, `an uploaded backup from ${String(body.backup?.createdAt || 'an unknown date').slice(0, 10)}`);
  }

  if (path === '/admin/api/publish' && request.method === 'POST') {
    const r = await refs();
    if (!r.draft) throw new UserError('There are no draft changes to publish.');
    if (body.head && body.head !== r.draft) throw new GitHubError(409, 'The draft changed since you loaded it. Reload, check the preview, then publish.');
    const sha = await gh.merge(s.branch, s.draft, `Admin: publish draft\n\nPublished by ${who} in the admin page.`);
    await gh.deleteRef(s.draft);
    return json({ ok: true, sha, message: 'Published. The live site updates in about 2 minutes.' });
  }

  if (path === '/admin/api/discard' && request.method === 'POST') {
    await gh.deleteRef(s.draft);
    return json({ ok: true, message: 'Draft discarded.' });
  }

  return json({ error: 'Not found' }, 404);
}
