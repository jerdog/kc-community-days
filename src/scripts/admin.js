// Admin page: edits site.config.json through the /admin/api endpoints in worker/admin/routes.js.
// The form is generated from SECTIONS below; every field has a visible label, optional help
// text, and an error message tied to it (aria-describedby / aria-invalid).
import { validateConfig, contrast, FEATURES } from '../lib/config-schema.js';

// ---------------------------------------------------------------- field definitions
const f = (type, key, label, opts = {}) => ({ type, key, label, ...opts });
const featureOptions = [['', 'Always shown'], ...FEATURES.map((k) => [k, k])];

const SECTIONS = [
  {
    id: 'event', title: 'Event', fields: [
      f('text', 'event.name', 'Event name'),
      f('text', 'event.tagline', 'Tagline', { help: 'Shown under the event name on the homepage.' }),
      f('textarea', 'event.description', 'Description', { help: 'Used on the About page and in search results.' }),
      f('number', 'event.year', 'Year', { min: 2000, max: 2100 }),
      f('date', 'event.start', 'First day', { help: 'Leave empty until dates are set; the site says “dates coming soon”.' }),
      f('date', 'event.end', 'Last day'),
      f('text', 'event.timezone', 'Time zone', { help: 'For example America/Chicago.' }),
      f('text', 'event.venue.host', 'Venue host', { help: 'For example Lifted Logic.' }),
      f('text', 'event.venue.name', 'Building'),
      f('text', 'event.venue.street', 'Street address'),
      f('text', 'event.venue.city', 'City and state'),
      f('url', 'event.venue.mapUrl', 'Map link'),
    ],
  },
  {
    id: 'switches', title: 'What the site shows', fields: [
      f('bool', 'features.callForSpeakers', 'Call for speakers is open', { help: 'Shows a “Submit a talk” button in the homepage hero. Needs the call-for-speakers link.' }),
      f('bool', 'features.registration', 'Registration is open', { help: 'Shows ticket prices and “Get your badge”. Needs the ticket link and at least one ticket tier.' }),
      f('bool', 'features.program', 'Show the program', { help: 'Before talks are imported, the program says “coming soon”.' }),
      f('bool', 'features.speakers', 'Show speakers', { help: 'Before this year’s speakers are imported, last year’s are shown (labelled).' }),
      f('select', 'homepage.mode', 'Homepage mode', { options: [['auto', 'Automatic (switches after the last day)'], ['upcoming', 'Always “upcoming”'], ['past', 'Always “thanks for coming”']] }),
    ],
  },
  {
    id: 'links', title: 'Links', fields: [
      f('url', 'links.tickets', 'Ticket link', { help: 'Opens in a new tab from the ticket buttons.' }),
      f('url', 'links.callForSpeakers', 'Call-for-speakers link', { help: 'Your Sessionize call for speakers. Opens in a new tab.' }),
      f('url', 'links.prospectus', 'Sponsor prospectus', { help: 'A full link, or a path to a file on the site such as /files/prospectus.pdf.' }),
      f('email', 'links.contactEmail', 'Contact email', { help: 'Shown in the footer of every page.' }),
      f('email', 'links.conductEmail', 'Code of conduct email'),
    ],
  },
  {
    id: 'tickets', title: 'Tickets', fields: [
      f('text', 'tickets.note', 'Ticket note', { help: 'For example “One badge covers both days and every room.”' }),
      f('list', 'tickets.tiers', 'Ticket tiers', {
        item: 'Tier', title: (t) => t.name || 'New tier', blank: () => ({ name: '', price: 0, until: null }),
        help: 'In order. The price shown is the first tier whose last day hasn’t passed.',
        fields: [f('text', 'name', 'Name'), f('number', 'price', 'Price (USD)', { min: 0 }), f('date', 'until', 'Last day on sale', { help: 'Leave empty on the last tier.' })],
      }),
    ],
  },
  { id: 'program', title: 'Program (Sessionize)', custom: 'program' },
  {
    id: 'lineup', title: 'Homepage community list', fields: [
      f('select', 'lineup.order', 'Order', { options: [['talks', 'Most talks first'], ['alphabetical', 'Alphabetical'], ['listed', 'As listed under Communities']] }),
      f('number', 'lineup.mobileCount', 'Communities shown on phones before “Show all”', { min: 1, max: 50 }),
      f('featured', 'lineup.featured', 'Always list first'),
    ],
  },
  {
    id: 'communities', title: 'Communities', fields: [
      f('list', 'communities', 'Communities', {
        item: 'Community', title: (c) => c.name || 'New community', blank: () => ({ name: '', slug: '', tag: '', color: '#303086' }),
        fields: [
          f('text', 'name', 'Name'),
          f('text', 'slug', 'Web address name', { help: 'Lowercase with dashes; the page is /communities/<this>/.' }),
          f('text', 'tag', 'Sessionize group', { help: 'Exactly as the “group” category is spelled in Sessionize.' }),
          f('color', 'color', 'Ribbon color'),
          f('text', 'fullName', 'Full name (optional)'),
          f('url', 'url', 'Website (optional)'),
          f('image', 'logo', 'Logo (optional)', { kind: 'community' }),
        ],
      }),
    ],
  },
  {
    id: 'sponsors', title: 'Sponsors', fields: [
      f('list', 'sponsors', 'Sponsor tiers', {
        item: 'Tier', title: (t) => t.tier || 'New tier', blank: () => ({ tier: '', badge: '', ribbon: '#303086', items: [] }),
        help: 'Highest tier first.',
        fields: [
          f('text', 'tier', 'Tier name', { help: 'For example Gold.' }),
          f('text', 'badge', 'Badge label', { help: 'Shown on the badge strip, for example GOLD SPONSOR.' }),
          f('color', 'ribbon', 'Ribbon color'),
          f('bool', 'gold', 'Gold badge strip'),
          f('bool', 'hero', 'Show in the homepage hero (“Presented with support from”)'),
          f('list', 'items', 'Sponsors in this tier', {
            item: 'Sponsor', title: (s) => s.name || 'New sponsor', blank: () => ({ name: '', logo: '', url: '' }),
            fields: [f('text', 'name', 'Name'), f('image', 'logo', 'Logo', { kind: 'sponsor', help: 'Dark artwork on a transparent or white background works best.' }), f('url', 'url', 'Website (optional)')],
          }),
        ],
      }),
    ],
  },
  {
    id: 'team', title: 'Organizers', fields: [
      f('list', 'team', 'Organizers', {
        item: 'Organizer', title: (p) => p.name || 'New organizer', blank: () => ({ name: '', role: '', photo: '' }),
        fields: [f('text', 'name', 'Name'), f('text', 'role', 'Role'), f('image', 'photo', 'Photo', { kind: 'team' }), f('url', 'url', 'Profile link (optional)')],
      }),
    ],
  },
  {
    id: 'nav', title: 'Main menu', fields: [
      f('list', 'nav', 'Menu links', {
        item: 'Link', title: (n) => n.label || 'New link', blank: () => ({ href: '/', label: '' }),
        fields: [f('text', 'label', 'Label'), f('text', 'href', 'Path', { help: 'For example /program/.' }), f('select', 'feature', 'Hide when this is turned off', { options: featureOptions })],
      }),
    ],
  },
  { id: 'years', title: 'Years', custom: 'years' },
  { id: 'backups', title: 'Backups', custom: 'backups' },
];

// ---------------------------------------------------------------- state + helpers
let state = null; // response of GET /admin/api/state
let cfg = null; // config being edited
let dirty = false;
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const idOf = (path) => `f-${path.replace(/[^a-zA-Z0-9]+/g, '-')}`;
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
function set(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] ??= {};
  o[keys.at(-1)] = value;
}
const announce = (msg, error = false) => {
  const el = $('#announce');
  el.textContent = msg;
  el.classList.toggle('is-error', error);
};

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/admin/api/${path}`, {
    method,
    headers: method === 'GET' ? {} : { 'content-type': 'application/json', 'x-admin': '1' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({ error: 'Unexpected response from the server.' }));
  if (res.status === 401) location.href = '/admin/sign-in/';
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed.'), { errors: data.errors, status: res.status });
  return data;
}

// ---------------------------------------------------------------- rendering
function fieldHtml(fd, path, value) {
  const id = idOf(path);
  const help = fd.help ? `<p class="help" id="${id}-help">${esc(fd.help)}</p>` : '';
  const desc = `${fd.help ? `${id}-help ` : ''}${id}-err`;
  const err = `<p class="field-err" id="${id}-err" hidden></p>`;
  const common = `id="${id}" data-path="${esc(path)}" data-type="${fd.type}" aria-describedby="${desc}"`;
  switch (fd.type) {
    case 'bool':
      return `<div class="field check"><input type="checkbox" ${common} ${value ? 'checked' : ''}><label for="${id}">${esc(fd.label)}</label>${help}${err}</div>`;
    case 'textarea':
      return `<div class="field"><label for="${id}">${esc(fd.label)}</label>${help}<textarea ${common} rows="3">${esc(value)}</textarea>${err}</div>`;
    case 'select':
      return `<div class="field"><label for="${id}">${esc(fd.label)}</label>${help}<select ${common}>${fd.options.map(([v, l]) => `<option value="${esc(v)}" ${String(value ?? '') === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>${err}</div>`;
    case 'color': {
      const ok = /^#[0-9a-f]{6}$/i.test(value || '');
      const ratio = ok ? contrast(value) : 0;
      return `<div class="field color"><label for="${id}">${esc(fd.label)}</label>${help}
        <div class="color-row"><input type="color" value="${ok ? value : '#303086'}" data-mirror="${id}" aria-label="${esc(fd.label)} picker">
        <input type="text" ${common} value="${esc(value)}" spellcheck="false" autocomplete="off" inputmode="text" pattern="#[0-9a-fA-F]{6}">
        <span class="ribbon-preview" style="--c:${ok ? value : '#303086'}">Ribbon text</span>
        <span class="ratio ${ratio >= 4.5 ? 'pass' : 'fail'}" id="${id}-ratio">${ok ? `${ratio.toFixed(1)}:1 ${ratio >= 4.5 ? 'passes' : 'too light, needs 4.5:1'}` : ''}</span></div>${err}</div>`;
    }
    case 'image':
      return `<div class="field"><label for="${id}">${esc(fd.label)}</label>${help}
        <div class="image-row"><input type="text" ${common} value="${esc(value)}" placeholder="/images/…" spellcheck="false">
        <label class="btn outline small upload">Upload<span class="visually-hidden"> ${esc(fd.label)}</span><input type="file" accept="image/png,image/jpeg,image/webp" data-upload="${id}" data-kind="${fd.kind}" class="visually-hidden"></label></div>${err}</div>`;
    case 'featured': {
      const chosen = new Set(value || []);
      return `<fieldset class="field" id="${id}" data-path="${esc(path)}" data-type="featured" aria-describedby="${id}-err"><legend>${esc(fd.label)}</legend>
        <p class="help">These communities are listed first, in the order ticked. Leave all unticked to use the order above.</p>
        <div class="checks">${(cfg.communities || []).map((c) => `<label><input type="checkbox" value="${esc(c.slug)}" ${chosen.has(c.slug) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')}</div>${err}</fieldset>`;
    }
    case 'list':
      return listHtml(fd, path, value || []);
    default: {
      const t = { number: 'number', date: 'date', url: 'url', email: 'email' }[fd.type] || 'text';
      const extra = fd.type === 'number' ? `min="${fd.min ?? ''}" max="${fd.max ?? ''}" step="1"` : fd.type === 'email' ? 'autocomplete="email"' : fd.type === 'url' ? 'spellcheck="false" placeholder="https://…"' : '';
      return `<div class="field"><label for="${id}">${esc(fd.label)}</label>${help}<input type="${t}" ${common} value="${esc(value)}" ${extra}>${err}</div>`;
    }
  }
}

function listHtml(fd, path, items) {
  const id = idOf(path);
  return `<fieldset class="list" id="${id}" data-list="${esc(path)}" aria-describedby="${id}-err"><legend>${esc(fd.label)}</legend>
    ${fd.help ? `<p class="help">${esc(fd.help)}</p>` : ''}<p class="field-err" id="${id}-err" hidden></p>
    <ol class="items">${items.map((item, i) => `<li class="item">
      <h4 class="item-h" id="${id}-${i}-h" tabindex="-1">${esc(fd.item)} ${i + 1}: ${esc(fd.title(item))}</h4>
      ${fd.fields.map((sub) => fieldHtml(sub, `${path}.${i}.${sub.key}`, item[sub.key])).join('')}
      <div class="item-actions">
        <button type="button" class="btn outline small" data-move="${esc(path)}" data-i="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>Move up<span class="visually-hidden"> ${esc(fd.title(item))}</span></button>
        <button type="button" class="btn outline small" data-move="${esc(path)}" data-i="${i}" data-dir="1" ${i === items.length - 1 ? 'disabled' : ''}>Move down<span class="visually-hidden"> ${esc(fd.title(item))}</span></button>
        <button type="button" class="btn outline small danger" data-remove="${esc(path)}" data-i="${i}">Remove<span class="visually-hidden"> ${esc(fd.title(item))}</span></button>
      </div></li>`).join('')}</ol>
    <button type="button" class="btn outline small" data-add="${esc(path)}">Add ${esc(fd.item.toLowerCase())}</button></fieldset>`;
}

function sectionHtml(sec) {
  let inner;
  if (sec.custom === 'program') inner = programHtml();
  else if (sec.custom === 'years') inner = yearsHtml();
  else if (sec.custom === 'backups') inner = backupsHtml();
  else inner = sec.fields.map((fd) => fieldHtml(fd, fd.key, get(cfg, fd.key))).join('') + `<p><button type="submit" class="btn">Save to draft</button></p>`;
  return `<section class="admin-sec" id="sec-${sec.id}" aria-labelledby="sec-${sec.id}-h"><h2 id="sec-${sec.id}-h">${esc(sec.title)}</h2>${inner}</section>`;
}

function programHtml() {
  const p = state.program;
  const status = p?.eventId
    ? `Imported from Sessionize event <code>${esc(p.eventId)}</code>: ${p.speakers} speakers, ${p.sessions} sessions${p.importedAt ? `, on ${new Date(p.importedAt).toLocaleString()}` : ''}.`
    : 'No program imported for this year yet.';
  return `<p>${status}</p>
    ${fieldHtml(f('text', 'sessionize.eventId', 'Sessionize event ID', { help: 'From Sessionize → API / Embed. Letters and numbers, like 295atto3. Set it once talks are selected.' }), 'sessionize.eventId', cfg.sessionize?.eventId)}
    <p class="btn-row"><button type="button" class="btn" id="import">Import from Sessionize</button></p>
    <p class="help">Importing replaces this year’s speakers and sessions in the draft. Saves any change to the event ID too.</p>`;
}

function yearsHtml() {
  const y = cfg.event.year;
  return `<p>Current year: <strong>${y}</strong>.${state.archives.length ? ` Archived: ${state.archives.map((a) => `<a href="/${a}/" target="_blank" rel="noopener">${a}<span class="visually-hidden"> (opens in a new tab)</span></a>`).join(', ')}.` : ' No archived years yet.'}</p>
    <h3>Start a new year</h3>
    <p>First saves a backup (in the database, and downloaded to your computer as a JSON file). Then archives ${y} at <code>/${y}/</code> and resets the settings for the new year: call for speakers and registration off, no Sessionize event, sponsor lists emptied (tiers kept), ticket deadlines moved forward a year. Communities carry over. Like every change, it goes to the draft first.</p>
    <div class="inline-fields">
      ${fieldHtml(f('number', 'ny.year', 'New year', { min: y + 1, max: 2100 }), 'ny.year', y + 1)}
      ${fieldHtml(f('date', 'ny.start', 'First day (optional)'), 'ny.start', '')}
      ${fieldHtml(f('date', 'ny.end', 'Last day (optional)'), 'ny.end', '')}
    </div>
    <p class="btn-row"><button type="button" class="btn" id="new-year">Archive ${y} and start the new year</button></p>
    <div id="ny-confirm" class="confirm" hidden></div>`;
}

function backupsHtml() {
  const rows = state.backups;
  const list = rows === null
    ? `<p class="warn">Backups aren’t available right now (the database couldn’t be reached).</p>`
    : rows.length === 0
      ? '<p>No backups yet.</p>'
      : `<div class="table-wrap" tabindex="0" role="region" aria-label="Saved backups"><table class="backups">
          <thead><tr><th scope="col">Saved</th><th scope="col">By</th><th scope="col">Why</th><th scope="col">Contents</th><th scope="col">Actions</th></tr></thead>
          <tbody>${rows.map((b) => `<tr>
            <td>#${b.id}<br><span class="sub">${esc(new Date(b.created_at).toLocaleString())}</span></td>
            <td>${esc(b.created_by)}</td><td>${esc(b.reason)}</td><td>${esc(b.summary || '')}</td>
            <td class="btn-row"><a class="btn outline small" href="/admin/api/backups/${b.id}/download" download>Download<span class="visually-hidden"> backup #${b.id}</span></a>
              <button type="button" class="btn outline small" data-restore-id="${b.id}">Restore to draft<span class="visually-hidden"> backup #${b.id}</span></button></td>
          </tr>`).join('')}</tbody></table></div>`;
  return `<p>A backup holds the site settings, this year’s Sessionize program and every archived year. Backups are kept in the database (the newest 50) and can be downloaded as JSON. A backup is saved automatically before starting a new year and before every restore.</p>
    <p class="btn-row"><button type="button" class="btn" id="backup-now">Back up now</button></p>
    ${list}
    <div id="restore-confirm" class="confirm" hidden></div>
    <h3>Restore from a file</h3>
    <p class="help">A backup JSON downloaded here, or made with <code>npm run backup</code>. Restoring goes to the draft, so you can check the preview before publishing.</p>
    <div class="image-row"><label class="btn outline small upload">Choose backup file<input type="file" accept="application/json,.json" id="restore-file" class="visually-hidden"></label><span id="restore-file-name" class="sub"></span></div>`;
}

const download = (url) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.append(a);
  a.click();
  a.remove();
};

function draftHtml() {
  const d = state.draft;
  if (!d.exists || !d.ahead) {
    return `<p><strong>Everything is published.</strong> Changes you save go to a draft with its own preview before anything goes live.</p>`;
  }
  const preview = d.previewUrl ? `<a class="btn outline" href="${esc(d.previewUrl)}" target="_blank" rel="noopener">Open preview<span aria-hidden="true" class="nt">↗</span><span class="visually-hidden"> (opens in a new tab)</span></a>` : '';
  return `<p><strong>${d.ahead} unpublished change${d.ahead === 1 ? '' : 's'} in the draft.</strong> The preview rebuilds about 2 minutes after each save.</p>
    <ul class="draft-commits">${d.commits.map((c) => `<li>${esc(c.message)}${c.author ? ` <span class="sub">(@${esc(c.author)})</span>` : ''}</li>`).join('')}</ul>
    ${d.behind ? `<p class="warn">The live site has changed since this draft started; publishing will combine both.</p>` : ''}
    <p class="btn-row">${preview}<button type="button" class="btn" id="publish">Publish to the live site</button><button type="button" class="btn outline danger" id="discard">Discard draft</button></p>
    <div id="draft-confirm" class="confirm" hidden></div>`;
}

function render() {
  $('#who').textContent = `Signed in as @${state.user.login}`;
  $('#draft').innerHTML = `<h2 id="draft-h" class="visually-hidden">Draft status</h2>${draftHtml()}`;
  $('#toc').innerHTML = SECTIONS.map((s) => `<li><a href="#sec-${s.id}">${esc(s.title)}</a></li>`).join('');
  $('#settings').innerHTML = SECTIONS.map(sectionHtml).join('');
}

// Re-render one list in place and move focus somewhere sensible.
function rerenderList(path, focusId) {
  const sec = SECTIONS.find((s) => s.fields?.some((fd) => path === fd.key || path.startsWith(`${fd.key}.`)));
  const el = sec && document.getElementById(`sec-${sec.id}`);
  if (el) el.outerHTML = sectionHtml(sec);
  const target = focusId && document.getElementById(focusId);
  if (target) target.focus();
}

// ---------------------------------------------------------------- reading inputs
function readInput(el) {
  const { path, type } = el.dataset;
  if (!path || path.startsWith('ny.')) return;
  let v;
  if (type === 'bool') v = el.checked;
  else if (type === 'number') v = el.value === '' ? null : Number(el.value);
  else if (type === 'date') v = el.value || null;
  else v = el.value.trim() === '' ? (['url', 'image'].includes(type) || /\.(url|fullName|feature|until)$/.test(path) || path.startsWith('links.') || path === 'sessionize.eventId' ? null : '') : el.value;
  if (v === null && /\.(url|fullName|feature)$/.test(path)) {
    // optional keys: remove instead of storing null
    const parent = get(cfg, path.split('.').slice(0, -1).join('.'));
    if (parent) delete parent[path.split('.').at(-1)];
  } else set(cfg, path, v);
  dirty = true;
}

function clearErrors() {
  document.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
  document.querySelectorAll('.field-err').forEach((el) => { el.hidden = true; el.textContent = ''; });
  $('#error-summary').hidden = true;
}

function showErrors(errors, heading) {
  clearErrors();
  const items = errors.map((e) => {
    // Point at the field if it exists, else at the nearest list or section.
    let path = e.path;
    let el = document.getElementById(idOf(path));
    while (!el && path.includes('.')) {
      path = path.split('.').slice(0, -1).join('.');
      el = document.getElementById(idOf(path));
    }
    const id = el ? el.id : '';
    const errEl = el && document.getElementById(`${id}-err`);
    if (errEl) {
      errEl.textContent = e.message;
      errEl.hidden = false;
      el.setAttribute('aria-invalid', 'true');
    }
    return `<li>${id ? `<a href="#${id}">${esc(e.path)}: ${esc(e.message)}</a>` : `${esc(e.path)}: ${esc(e.message)}`}</li>`;
  });
  const box = $('#error-summary');
  box.innerHTML = `<h2>${esc(heading)}</h2><ul>${items.join('')}</ul>`;
  box.hidden = false;
  box.focus();
}

// ---------------------------------------------------------------- actions
async function load(message) {
  state = await call('state');
  cfg = structuredClone(state.config);
  dirty = false;
  render();
  if (message) announce(message);
}

async function save() {
  const errors = validateConfig(cfg);
  if (errors.length) return showErrors(errors, `${errors.length} setting${errors.length === 1 ? '' : 's'} need${errors.length === 1 ? 's' : ''} fixing before saving`);
  clearErrors();
  announce('Saving…');
  try {
    const r = await call('config', { method: 'PUT', body: { config: cfg, head: state.head } });
    await load(r.message);
  } catch (e) {
    if (e.errors) showErrors(e.errors, e.message);
    else announce(e.message, true);
  }
}

function confirmBox(boxId, text, yesLabel, onYes) {
  const box = document.getElementById(boxId);
  box.innerHTML = `<p>${esc(text)}</p><p class="btn-row"><button type="button" class="btn" data-yes>${esc(yesLabel)}</button><button type="button" class="btn outline" data-no>Cancel</button></p>`;
  box.hidden = false;
  box.querySelector('[data-yes]').focus();
  box.querySelector('[data-yes]').onclick = async () => { box.hidden = true; await onYes(); };
  box.querySelector('[data-no]').onclick = () => { box.hidden = true; box.previousElementSibling?.querySelector('button')?.focus(); };
}

async function action(path, body, busy) {
  if (dirty && !['config'].includes(path)) {
    announce('You have unsaved changes. Save them to the draft first, or reload the page to drop them.', true);
    return;
  }
  announce(busy);
  try {
    const r = await call(path, { method: 'POST', body: { head: state.head, ...body } });
    if (r.backup?.download) download(r.backup.download);
    await load(r.backup?.download ? `${r.message} The backup is downloading.` : r.message);
    return r;
  } catch (e) {
    if (e.errors) showErrors(e.errors, e.message);
    else announce(e.message, true);
  }
}

async function upload(input) {
  const file = input.files[0];
  if (!file) return;
  const target = document.getElementById(input.dataset.upload);
  if (file.size > 1.5 * 1024 * 1024) return announce('Images must be smaller than 1.5 MB.', true);
  const data = await new Promise((ok) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.readAsDataURL(file);
  });
  announce('Uploading…');
  try {
    const name = file.name.replace(/\.[^.]+$/, '');
    const r = await call('upload', { method: 'POST', body: { kind: input.dataset.kind, name, type: file.type, data, head: state.head } });
    state.head = r.head;
    target.value = r.path;
    readInput(target);
    announce(`${r.message} (${r.path})`);
    target.focus();
  } catch (e) {
    announce(e.message, true);
  }
}

async function importSessionize() {
  const eventId = (get(cfg, 'sessionize.eventId') || '').trim();
  if (!eventId) return showErrors([{ path: 'sessionize.eventId', message: 'Enter the Sessionize event ID first.' }], 'Can’t import yet');
  if (dirty) return announce('Save your other changes to the draft first, then import.', true);
  const btn = $('#import');
  btn.disabled = true;
  try {
    announce('Fetching sessions from Sessionize…');
    const { overview } = await call('import/overview', { method: 'POST', body: { eventId } });
    const ids = overview.speakers.map((s) => s.id);
    const bios = {};
    for (let i = 0; i < ids.length; i += 40) {
      announce(`Fetching speaker bios ${Math.min(i + 40, ids.length)} of ${ids.length}…`);
      Object.assign(bios, (await call('import/bios', { method: 'POST', body: { eventId, ids: ids.slice(i, i + 40) } })).bios);
    }
    announce('Saving the program to the draft…');
    const r = await call('import/save', { method: 'POST', body: { eventId, overview, bios, head: state.head } });
    await load(r.message);
  } catch (e) {
    announce(e.message, true);
  } finally {
    if (document.body.contains(btn)) btn.disabled = false;
  }
}

// ---------------------------------------------------------------- events
const form = $('#settings');
form.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.mirror) {
    const text = document.getElementById(el.dataset.mirror);
    text.value = el.value;
    readInput(text);
    updateColor(text);
    return;
  }
  if (el.closest('[data-type="featured"]')) {
    const fs = el.closest('[data-type="featured"]');
    const order = get(cfg, fs.dataset.path) || [];
    const next = el.checked ? [...order.filter((s) => s !== el.value), el.value] : order.filter((s) => s !== el.value);
    set(cfg, fs.dataset.path, next);
    dirty = true;
    return;
  }
  if (el.dataset.path) {
    readInput(el);
    if (el.dataset.type === 'color') updateColor(el);
  }
});
function updateColor(text) {
  const v = text.value.trim();
  const ok = /^#[0-9a-f]{6}$/i.test(v);
  const row = text.closest('.color-row');
  const ratio = ok ? contrast(v) : 0;
  const out = row.querySelector('.ratio');
  out.textContent = ok ? `${ratio.toFixed(1)}:1 ${ratio >= 4.5 ? 'passes' : 'too light, needs 4.5:1'}` : 'Use a color like #b3261e';
  out.className = `ratio ${ratio >= 4.5 ? 'pass' : 'fail'}`;
  if (ok) {
    row.querySelector('.ribbon-preview').style.setProperty('--c', v);
    row.querySelector('input[type=color]').value = v;
  }
}
form.addEventListener('change', async (e) => {
  if (e.target.dataset.upload) upload(e.target);
  if (e.target.id === 'restore-file') {
    const file = e.target.files[0];
    if (!file) return;
    let backup;
    try {
      backup = JSON.parse(await file.text());
    } catch {
      return announce('That file isn’t valid JSON.', true);
    }
    $('#restore-file-name').textContent = file.name;
    confirmBox('restore-confirm', `Restore ${file.name} (saved ${String(backup.createdAt || '?').slice(0, 10)}) into the draft? The current state is backed up first.`, 'Yes, restore to draft', () => action('backups/restore-file', { backup }, 'Restoring…'));
  }
});
form.addEventListener('submit', (e) => {
  e.preventDefault();
  save();
});
form.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.add) {
    const fd = findListField(b.dataset.add);
    const list = get(cfg, b.dataset.add) || set(cfg, b.dataset.add, []) || get(cfg, b.dataset.add);
    list.push(fd.blank());
    dirty = true;
    rerenderList(b.dataset.add, `${idOf(b.dataset.add)}-${list.length - 1}-h`);
    announce(`${fd.item} ${list.length} added.`);
  } else if (b.dataset.remove) {
    const list = get(cfg, b.dataset.remove);
    const fd = findListField(b.dataset.remove);
    const [gone] = list.splice(Number(b.dataset.i), 1);
    dirty = true;
    const next = Math.min(Number(b.dataset.i), list.length - 1);
    rerenderList(b.dataset.remove, next >= 0 ? `${idOf(b.dataset.remove)}-${next}-h` : null);
    announce(`Removed ${fd.title(gone)}. Save to the draft to keep this change.`);
  } else if (b.dataset.move) {
    const list = get(cfg, b.dataset.move);
    const i = Number(b.dataset.i);
    const j = i + Number(b.dataset.dir);
    [list[i], list[j]] = [list[j], list[i]];
    dirty = true;
    rerenderList(b.dataset.move, `${idOf(b.dataset.move)}-${j}-h`);
    announce(`Moved to position ${j + 1}.`);
  } else if (b.id === 'import') importSessionize();
  else if (b.id === 'backup-now') action('backups', { reason: 'Manual backup' }, 'Saving a backup…');
  else if (b.dataset.restoreId) {
    confirmBox('restore-confirm', `Restore backup #${b.dataset.restoreId} into the draft? The current state is backed up first, and nothing goes live until you publish.`, 'Yes, restore to draft', () => action(`backups/${b.dataset.restoreId}/restore`, {}, 'Restoring…'));
  }
  else if (b.id === 'new-year') {
    const year = Number($(`#${idOf('ny.year')}`).value);
    const start = $(`#${idOf('ny.start')}`).value || null;
    const end = $(`#${idOf('ny.end')}`).value || null;
    confirmBox('ny-confirm', `Archive ${cfg.event.year} and set up ${year} in the draft? You can check the preview before publishing.`, `Yes, start ${year}`, () => action('new-year', { year, start, end }, `Archiving ${cfg.event.year} and setting up ${year}…`));
  }
});
function findListField(path) {
  const parts = path.split('.').filter((p) => !/^\d+$/.test(p));
  let fields = SECTIONS.flatMap((s) => s.fields || []);
  let fd;
  let key = '';
  for (const part of parts) {
    key = key ? `${key}.${part}` : part;
    fd = fields.find((x) => x.key === key || x.key === part);
    if (fd?.fields) { fields = fd.fields; key = ''; }
  }
  return fd;
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('#draft button');
  if (!b) return;
  if (b.id === 'publish') confirmBox('draft-confirm', `Publish ${state.draft.ahead} change${state.draft.ahead === 1 ? '' : 's'} to the live site? It updates about 2 minutes later.`, 'Yes, publish', () => action('publish', {}, 'Publishing…'));
  if (b.id === 'discard') confirmBox('draft-confirm', 'Discard every unpublished change in the draft? This can’t be undone.', 'Yes, discard', () => action('discard', {}, 'Discarding…'));
});
window.addEventListener('beforeunload', (e) => {
  if (dirty) e.preventDefault();
});

load().catch((e) => announce(`Couldn’t load the settings: ${e.message}`, true));
