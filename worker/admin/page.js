// Shown at /admin until the GitHub OAuth app and secrets are configured.
export function setupPage(missing) {
  const items = missing.map((m) => `<li><code>${m}</code></li>`).join('');
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Admin not set up · CommunityDays KC</title></head>
<body style="font:17px/1.55 system-ui,sans-serif;max-width:42rem;margin:3rem auto;padding:0 1rem;color:#16153f;background:#eeecf6">
<main><h1 style="font-size:1.6rem">The admin page isn't set up yet</h1>
<p>Add these to the <strong>communitydays</strong> Worker (Settings → Variables and Secrets), then reload:</p><ul>${items}</ul>
<p>The README's “Admin page” section has the steps.</p></main></body></html>`,
    { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
  );
}
