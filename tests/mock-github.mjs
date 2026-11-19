#!/usr/bin/env node
// A tiny in-memory stand-in for github.com + api.github.com, for testing the admin page
// locally (`node tests/mock-github.mjs`, then `wrangler dev` with GITHUB_API/GITHUB_WEB
// pointed at it). Seeded from this checkout's site.config.json, sessionize.json and archive/.
//
// OAuth: /login/oauth/authorize?...&login=<code> redirects back with code=<code>.
//   code "admin" → token with push access, "viewer" → token without push access.
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const PORT = Number(process.env.PORT || 9999);
const REPO = process.env.REPO || 'jerdog/kc-community-days';
const root = resolve(import.meta.dirname, '..');
const sha = (s) => createHash('sha1').update(s).digest('hex');

const blobs = new Map(); // sha -> base64
const trees = new Map(); // sha -> Map(path -> blobSha)
const commits = new Map(); // sha -> { tree, parents, message }
const refs = new Map(); // branch -> commit sha
export const log = [];

function putBlob(b64) {
  const s = sha(`blob:${b64}`);
  blobs.set(s, b64);
  return s;
}
function putTree(map) {
  const s = sha(`tree:${JSON.stringify([...map].sort())}`);
  trees.set(s, map);
  return s;
}
function putCommit(c) {
  const s = sha(`commit:${JSON.stringify(c)}:${Math.random()}`);
  commits.set(s, c);
  return s;
}
const ancestors = (s) => {
  const out = new Set();
  const stack = [s];
  while (stack.length) {
    const c = stack.pop();
    if (!c || out.has(c)) continue;
    out.add(c);
    stack.push(...(commits.get(c)?.parents || []));
  }
  return out;
};

// Seed
const seed = new Map();
for (const p of ['site.config.json', 'src/data/sessionize.json']) seed.set(p, putBlob(Buffer.from(await readFile(resolve(root, p))).toString('base64')));
for (const y of await readdir(resolve(root, 'archive')).catch(() => [])) {
  for (const f of await readdir(resolve(root, 'archive', y))) seed.set(`archive/${y}/${f}`, putBlob(Buffer.from(await readFile(resolve(root, 'archive', y, f))).toString('base64')));
}
refs.set('main', putCommit({ tree: putTree(seed), parents: [], message: 'seed' }));

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
};
const readBody = (req) => new Promise((ok) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => ok(d ? JSON.parse(d) : {})); });

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : {};
  log.push(`${req.method} ${p}`);

  // ---- OAuth (github.com)
  if (p === '/login/oauth/authorize') {
    const back = new URL(url.searchParams.get('redirect_uri'));
    back.searchParams.set('code', url.searchParams.get('login') || 'admin');
    back.searchParams.set('state', url.searchParams.get('state'));
    res.writeHead(302, { location: back.toString() });
    return res.end();
  }
  if (p === '/login/oauth/access_token') return send(res, 200, { access_token: `tok-${body.code}`, scope: 'public_repo', token_type: 'bearer' });
  if (p === '/__state') return send(res, 200, { refs: Object.fromEntries(refs), log: log.slice(-50) });
  if (p === '/__file') {
    const ref = refs.get(url.searchParams.get('ref') || 'main');
    const b = ref && trees.get(commits.get(ref).tree).get(url.searchParams.get('path'));
    return b ? send(res, 200, { text: Buffer.from(blobs.get(b), 'base64').toString('utf8') }) : send(res, 404, { message: 'Not Found' });
  }

  // ---- REST API
  if (!token.startsWith('tok-')) return send(res, 401, { message: 'Bad credentials' });
  if (p === '/user') return send(res, 200, { login: token === 'tok-admin' ? 'test-admin' : 'test-viewer', name: 'Test Person', avatar_url: '' });
  const base = `/repos/${REPO}`;
  if (p === base) return send(res, 200, { full_name: REPO, permissions: { push: token === 'tok-admin', pull: true } });
  if (token !== 'tok-admin' && req.method !== 'GET') return send(res, 403, { message: 'Resource not accessible' });

  let m;
  if ((m = p.match(new RegExp(`^${base}/git/ref/heads/(.+)$`)))) {
    const s = refs.get(decodeURIComponent(m[1]));
    return s ? send(res, 200, { object: { sha: s } }) : send(res, 404, { message: 'Not Found' });
  }
  if (p === `${base}/git/refs` && req.method === 'POST') {
    const b = body.ref.replace('refs/heads/', '');
    if (refs.has(b)) return send(res, 422, { message: 'Reference already exists' });
    refs.set(b, body.sha);
    return send(res, 201, { ref: body.ref, object: { sha: body.sha } });
  }
  if ((m = p.match(new RegExp(`^${base}/git/refs/heads/(.+)$`)))) {
    const b = decodeURIComponent(m[1]);
    if (req.method === 'DELETE') return refs.delete(b) ? send(res, 204) : send(res, 422, { message: 'Reference does not exist' });
    if (req.method === 'PATCH') {
      const cur = refs.get(b);
      if (!body.force && !ancestors(body.sha).has(cur)) return send(res, 422, { message: 'Update is not a fast forward' });
      refs.set(b, body.sha);
      return send(res, 200, { object: { sha: body.sha } });
    }
  }
  if ((m = p.match(new RegExp(`^${base}/contents/(.+)$`)))) {
    const ref = refs.get(url.searchParams.get('ref')) || url.searchParams.get('ref');
    const tree = commits.get(ref) && trees.get(commits.get(ref).tree);
    if (!tree) return send(res, 404, { message: 'No commit found for the ref' });
    const path = decodeURIComponent(m[1]);
    if (tree.has(path)) {
      const b64 = blobs.get(tree.get(path));
      return send(res, 200, { type: 'file', encoding: 'base64', content: b64, sha: tree.get(path), size: Buffer.from(b64, 'base64').length });
    }
    const kids = new Map();
    for (const k of tree.keys()) if (k.startsWith(`${path}/`)) { const rest = k.slice(path.length + 1); const [name, ...more] = rest.split('/'); kids.set(name, more.length ? 'dir' : 'file'); }
    return kids.size ? send(res, 200, [...kids].map(([name, type]) => ({ name, type }))) : send(res, 404, { message: 'Not Found' });
  }
  if ((m = p.match(new RegExp(`^${base}/git/blobs/(.+)$`))) && req.method === 'GET') return send(res, 200, { content: blobs.get(m[1]), encoding: 'base64' });
  if (p === `${base}/git/blobs` && req.method === 'POST') return send(res, 201, { sha: putBlob(body.content) });
  if ((m = p.match(new RegExp(`^${base}/git/commits/(.+)$`))) && req.method === 'GET') {
    const c = commits.get(m[1]);
    return c ? send(res, 200, { sha: m[1], tree: { sha: c.tree } }) : send(res, 404, { message: 'Not Found' });
  }
  if (p === `${base}/git/trees` && req.method === 'POST') {
    const map = new Map(trees.get(body.base_tree));
    for (const e of body.tree) {
      if (e.sha === null) map.delete(e.path);
      else map.set(e.path, e.sha || putBlob(Buffer.from(e.content, 'utf8').toString('base64')));
    }
    return send(res, 201, { sha: putTree(map) });
  }
  if (p === `${base}/git/commits` && req.method === 'POST') return send(res, 201, { sha: putCommit({ tree: body.tree, parents: body.parents, message: body.message }) });
  if ((m = p.match(new RegExp(`^${base}/compare/(.+)\\.\\.\\.(.+)$`)))) {
    const [bs, hs] = [refs.get(decodeURIComponent(m[1])), refs.get(decodeURIComponent(m[2]))];
    const [ba, ha] = [ancestors(bs), ancestors(hs)];
    const ahead = [...ha].filter((c) => !ba.has(c));
    const changed = new Set();
    for (const c of ahead) {
      const t = trees.get(commits.get(c).tree);
      const pt = trees.get(commits.get(commits.get(c).parents[0])?.tree) || new Map();
      for (const [k, v] of t) if (pt.get(k) !== v) changed.add(k);
    }
    return send(res, 200, { ahead_by: ahead.length, behind_by: [...ba].filter((c) => !ha.has(c)).length, files: [...changed].map((filename) => ({ filename })), commits: ahead.reverse().map((c) => ({ sha: c, commit: { message: commits.get(c).message, author: { name: 'test-admin' } }, author: { login: 'test-admin' } })) });
  }
  if (p === `${base}/merges` && req.method === 'POST') {
    const [bs, hs] = [refs.get(body.base), refs.get(body.head)];
    if (ancestors(bs).has(hs)) return send(res, 204);
    if (ancestors(hs).has(bs)) {
      const s = putCommit({ tree: commits.get(hs).tree, parents: [bs, hs], message: body.commit_message });
      refs.set(body.base, s);
      return send(res, 201, { sha: s });
    }
    return send(res, 409, { message: 'Merge conflict' });
  }
  send(res, 404, { message: `mock: no route for ${req.method} ${p}` });
}).listen(PORT, () => console.log(`mock GitHub on http://localhost:${PORT} (repo ${REPO})`));
