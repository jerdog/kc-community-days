// Cloudflare Worker entry. Static pages are served from ./dist by the assets
// binding; only /api/* reaches this code (see run_worker_first in wrangler.jsonc).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX = 4000;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function htmlPage(message, referer) {
  let back = '/';
  try {
    if (referer) back = new URL(referer).pathname;
  } catch {}
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CommunityDays KC</title></head>` +
      `<body style="font:18px/1.5 system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;color:#16153f">` +
      `<p role="status">${escapeHtml(message)}</p><p><a href="${escapeHtml(back)}">Go back</a></p></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
  );
}

const clean = (v, max = MAX) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

async function readBody(request) {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) return request.json();
  const data = {};
  for (const [k, v] of await request.formData()) data[k] = k in data ? [].concat(data[k], v) : v;
  return data;
}

const handlers = {
  // Stay Informed
  async subscribe(data, env) {
    const email = clean(data.email, 254);
    if (!EMAIL_RE.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
    await env.DB.prepare('INSERT INTO subscribers (name, email) VALUES (?, ?) ON CONFLICT(email) DO NOTHING')
      .bind(clean(data.name, 200) || null, email)
      .run();
    return json({ ok: true, message: "You're on the list. We'll email you with event news." });
  },

  // Sponsors page inquiry
  async 'sponsor-inquiry'(data, env) {
    const name = clean(data.name, 200);
    const email = clean(data.email, 254);
    const company = clean(data.company, 200);
    if (!name || !company || !EMAIL_RE.test(email)) {
      return json({ error: 'Name, company and a valid email are required.' }, 400);
    }
    await env.DB.prepare(
      'INSERT INTO sponsor_inquiries (name, email, company, phone, message) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(name, email, company, clean(data.phone, 40) || null, clean(data.message) || null)
      .run();
    return json({ ok: true, message: 'Thanks! An organizer will reach out with sponsorship details.' });
  },

  // Post-conference feedback
  async feedback(data, env) {
    const email = clean(data.email, 254);
    if (email && !EMAIL_RE.test(email)) return json({ error: 'That email address looks wrong.' }, 400);
    const rating = Number.parseInt(data.content_rating, 10);
    const groups = Array.isArray(data.groups) ? data.groups.map((g) => clean(g, 100)).join(', ') : clean(data.groups, 1000);
    await env.DB.prepare(
      `INSERT INTO feedback (event_year, name, email, content_rating, enjoyed, improve, groups, contact_ok)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        Number.parseInt(data.event_year, 10) || new Date().getFullYear(),
        clean(data.name, 200) || null,
        email || null,
        rating >= 1 && rating <= 5 ? rating : null,
        clean(data.enjoyed) || null,
        clean(data.improve) || null,
        groups || null,
        data.contact_ok === true || data.contact_ok === 'on' || data.contact_ok === 'yes' ? 1 : 0
      )
      .run();
    return json({ ok: true, message: 'Thank you for the feedback!' });
  },
};

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const name = pathname.replace(/^\/api\//, '').replace(/\/$/, '');
    const handler = handlers[name];

    if (!handler) return json({ error: 'Not found' }, 404);
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    let data;
    try {
      data = await readBody(request);
    } catch {
      return json({ error: 'Could not read the form submission.' }, 400);
    }
    // Honeypot: real people never fill the hidden "website" field.
    if (clean(data.website)) return json({ ok: true, message: 'Thanks!' });

    try {
      const res = await handler(data, env);
      // Plain HTML form posts (JavaScript off) get a readable page instead of JSON.
      if (!(request.headers.get('content-type') || '').includes('application/json')) {
        const body = await res.json();
        return htmlPage(body.message || body.error, request.headers.get('referer'));
      }
      return res;
    } catch (err) {
      console.error(`api/${name} failed`, err);
      return json({ error: 'Something went wrong saving that. Please try again or email communitydays@kcdc.info.' }, 500);
    }
  },
};
