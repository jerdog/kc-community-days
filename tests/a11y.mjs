#!/usr/bin/env node
// WCAG 2.2 AA check of every built page with axe-core, at desktop and 320px widths.
// Usage: npm run test:a11y            (builds first)
//        node tests/a11y.mjs file.html (check a single local HTML file)
import { readdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const axeSource = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf' };

async function pagesIn(dir, base = dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await pagesIn(p, base)));
    else if (e.name.endsWith('.html')) out.push('/' + p.slice(base.length + 1).replace(/index\.html$/, ''));
  }
  return out.sort();
}

function serve(root) {
  const server = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    try {
      const body = await readFile(join(root, p));
      res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((r) => server.listen(0, () => r(server)));
}

const single = process.argv[2];
const root = single ? resolve(single, '..') : resolve('dist');
const pages = single ? ['/' + single.split('/').pop()] : await pagesIn(root);
const server = await serve(root);
const origin = `http://localhost:${server.address().port}`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

let failures = 0;
const CONCURRENCY = 6;
async function check(width, path) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(origin + path, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.addScriptTag({ content: axeSource });
    const { violations } = await page.evaluate((tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags } }), TAGS);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    const issues = violations.flatMap((v) => v.nodes.map((n) => `  [${v.impact}] ${v.id}: ${n.target.join(' ')}\n      ${n.failureSummary.split('\n').slice(1, 2).join('').trim()}`));
    if (overflow && width === 320) issues.push('  [serious] reflow: page scrolls horizontally at 320px (1.4.10)');
    failures += issues.length;
    console.log(`${issues.length ? '✗' : '✓'} ${width}px ${path}`);
    if (issues.length) console.log(issues.join('\n'));
    await page.close();
}
const jobs = [1280, 320].flatMap((w) => pages.map((p) => [w, p]));
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (jobs.length) await check(...jobs.shift());
}));
await browser.close();
server.close();
console.log(failures ? `\n${failures} accessibility issue(s).` : '\nNo WCAG 2.2 AA issues found by axe.');
process.exit(failures ? 1 : 0);
