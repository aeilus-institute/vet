/* VET editor UI (TZ stages 1-4). Plain ES modules, no build step (ADR-001).
   Solo mode (no data-board): nothing is sent to the server (MO-2). Team mode (data-board = board id): vet-team.js
   syncs with /api/v1 (MO-5 ... MO-15). All user text goes to the page through textContent. */

const root = document.getElementById('vet');
const V = root.dataset.v || '1';
if (root.dataset.theme) document.documentElement.setAttribute('data-tools-theme', root.dataset.theme); // dark | auto (packages); the site stays light
const C = await import('./vet-core.js?v=' + V);
const HP = await import('./vet-helpers.js?v=' + V); // references, metrics and formulas, goals (HP-*)
const LANG = (document.documentElement.lang || 'en').slice(0, 2);
// I18N-1: the languages are the files in locales/; a page language without a file falls back to English
const loadLoc = (l) => (/^[a-z]{2}$/.test(l) ? fetch(new URL('./locales/' + l + '.json?v=' + V, import.meta.url)).then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null));
let STR = await loadLoc(LANG);
const LOC = STR ? LANG : 'en';
if (!STR) STR = (LANG === 'en' ? null : await loadLoc('en')) || {};
const EN = LOC === 'en' ? STR : await fetch(new URL('./locales/en.json?v=' + V, import.meta.url)).then((r) => r.json()).catch(() => ({}));
const plural = new Intl.PluralRules(LOC);

/** A11Y-3: text colour for a bucket colour. The lighter stripe (78% colour + white) decides, so the label keeps 4.5:1 with its backing chip. */
function inkOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return 'light';
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) * 0.78 + 255 * 0.22);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.3 ? 'dark' : 'light';
}

function t(key, vars = {}) {
  let s = STR[key] ?? EN[key];
  if (s && typeof s === 'object') s = s[plural.select(Number(vars.n ?? 0))] ?? s.other;
  if (s === undefined) s = key;
  return String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
}

// ---------- tiny DOM helpers ----------

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') { for (const [p, x] of Object.entries(v)) if (x !== null && x !== undefined) { if (p.startsWith('--')) el.style.setProperty(p, x); else el.style[p] = x; } }
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
}
const svgIcon = (d, size = 18) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('aria-hidden', 'true'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.innerHTML = d; return s; };
const ICON_MORE = '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>';
const ICON = {
  more: ICON_MORE,
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>', redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', paste: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>', upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>', play: '<path d="m6 4 14 8-14 8z"/>', swap: '<path d="M7 16V4M3 8l4-4 4 4M17 8v12M21 16l-4 4-4-4"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
};

// ---------- state ----------

let board = C.newBoard('');
const hist = new C.History(100);
let selected = null;             // item id shown in the card
let picked = new Set();          // rows ticked for bulk actions
let filter = { q: '', types: null, bucket: null, onlyShown: false, goal: null, refs: false };
let goalsOpen = false;
let dirty = false;
let lastTypeId = null;
let pendingScale = null;
const openStacks = new Set(); // axes where '+N' stacks are expanded
// VSS bridge state (VSS TZ section 9): set when VET runs inside the VSS editor (embed) or comes from it (?session=)
const bridge = { on: (root.dataset.embed === 'vss' || root.dataset.embed === 'ledger') && window.parent !== window, requestId: null, flowRef: null, ledgerRef: null, ledgerTitle: '', fp: null, revision: 0, mappings: [], session: root.dataset.session || '', ret: root.dataset.return || '' };
// Team mode (section 6.2): set up at the end of the file when the page names a board
let team = null;
let TV = null; // the institute's "Rate VET" and usage summary (vet-telemetry.js), only when the host asks for it (TV-6)
let A = null; // aevri-api.js, loaded only when the server is needed (solo stays without network code, ARCH-3)
const apiMod = async () => (A = A || await import(new URL('../../assets/aevri-api.js?v=' + V, import.meta.url).href));
// Host settings (packages, DL-4): data-api = API base, data-signin = sign-in URL prefix, data-share="off" = no team mode
const SIGNIN = root.dataset.signin || '';
const SHARE = root.dataset.share !== 'off';
const apiOf = async (id) => { const m = await apiMod(); return m.createApi({ base: root.dataset.api || '/api/v1', sessid: root.dataset.sessid || '', guest: () => (root.dataset.user || !id ? '' : m.guestStore.get(id)) }); };

/** Where a marker stands for me: my own estimate while I can estimate, else the team value (median, fixed final). */
/** Sets my estimate; a hand-made value on an axis with a formula is remembered as an override (HP-9). */
function setEst(id, key, v, source) {
  C.setEstimate(board, id, key, v, source);
  if ((source === 'drag' || source === 'input') && HP.formulaOf(board, key) && (!team || team.canEdit)) {
    const it = board.items.find((x) => x.id === id);
    if (it) it.manual = { ...(it.manual || {}), [key]: true };
  }
}

/** Puts the formula value of an item on the scales (HP-6); `force` also drops a manual override ("Back to formula"). */
function applyFormula(it, force = false) {
  for (const key of ['out', 'in']) {
    const fv = HP.formulaValue(board, it, key);
    if (!fv || fv.value === null) continue;
    if (it.manual && it.manual[key] && !force) continue;
    if (force && it.manual) { delete it.manual[key]; if (!Object.keys(it.manual).length) delete it.manual; }
    const v = key === 'out' && it.polarity === 'anti' ? Math.min(0, fv.value) : fv.value; // EL-1; no clamp to the scale, autoscale follows
    C.setEstimate(board, it.id, key, v, 'formula');
  }
}

function myPos(id, key) {
  if (team && team.canEstimate) { const e = C.estimateOf(board, id, key); return e ? e.value : null; }
  return C.valueOf(board, id, key);
}

function typeName(id, many = false) {
  const ty = C.typeById(board, id);
  const own = (many ? ty.pluralName : ty.name) || {};
  return own[LOC] || own[board.lang] || Object.values(own)[0] || (ty.lib ? t((many ? 'typeMany.' : 'type.') + ty.lib) : ty.prefix);
}
function axisName(key) { const l = board.axes[key].label || {}; return l[LOC] || l[board.lang] || Object.values(l)[0] || t('axis.' + key); }

/** Every change goes through here: snapshot for Undo (EL-5), then render, then the autoscale pass (AX-19, 500 ms). */
function change(fn, opts = {}) {
  const before = JSON.stringify(board);
  hist.push(before);
  fn();
  if (bridge.flowRef) board.items.forEach((it) => { if (!it.flowRef) it.flowRef = { ...bridge.flowRef }; }); // VS-1
  if (team && !team.allowed(board, JSON.parse(before))) { // the role does not allow this change: put it back
    board = JSON.parse(before); hist.past.pop();
    toast(team.closed ? t('team.closedHint') : t('team.notAllowed'));
    render();
    return;
  }
  board.updatedAt = new Date().toISOString();
  dirty = !team;
  render();
  if (team) team.queue(() => board);
  if (!opts.noScale) scheduleScale();
  if (TV) TV.note('estimates');
}
function scheduleScale() {
  clearTimeout(pendingScale);
  if (team && !team.canEdit) return; // the scale belongs to the facilitator; values outside it stay at the edge (AX-7)
  pendingScale = setTimeout(() => {
    let moved = false;
    for (const key of ['out', 'in']) {
      const b = C.autoscaleBounds(board, key);
      if (!b) continue;
      moved = true;
      C.applyBounds(board.axes[key], b); // part of the same Undo step (AX-19 rule 6): no new snapshot
      if (b.expanded) toast(t('toast.expanded', { axis: axisName(key), max: C.fmtNum(b.max, LANG) }), () => undo());
    }
    if (moved) render();
  }, 500);
}
function undo() { const s = hist.undo(JSON.stringify(board)); if (s) { board = JSON.parse(s); render(); if (team) team.queue(() => board); } }
function redo() { const s = hist.redo(JSON.stringify(board)); if (s) { board = JSON.parse(s); render(); if (team) team.queue(() => board); } }

// ---------- layout ----------

const ui = {};
function build() {
  root.innerHTML = '';
  ui.bar = h('div', { class: 'vet-toolbar' });
  ui.notice = h('p', { class: 'vet-notice', role: 'note' });
  ui.start = h('div', { class: 'vet-start' });
  ui.scales = h('section', { class: 'vet-scales', 'aria-label': t('scales.label') });
  ui.card = h('aside', { class: 'vet-card', 'aria-label': t('card.label') });
  ui.list = h('section', { class: 'vet-list', 'aria-label': t('list.label') });
  ui.toasts = h('div', { class: 'vet-toasts', 'aria-live': 'polite' });
  ui.live = h('div', { class: 'vet-sr', 'aria-live': 'polite' });
  root.append(ui.bar, ui.notice, ui.start, h('div', { class: 'vet-work' }, ui.scales, ui.card), ui.list, ui.toasts, ui.live);
}

function btn(label, onClick, { icon, cls = '', title, disabled, pressed } = {}) {
  const b = h('button', { type: 'button', class: 'vet-btn ' + cls, title: title || null, disabled: disabled || null, 'aria-pressed': pressed === undefined ? null : String(pressed), onclick: onClick });
  if (icon) b.append(svgIcon(ICON[icon]));
  if (label) b.append(h('span', { text: label }));
  if (icon && !label) b.setAttribute('aria-label', title || '');
  if (icon && label) b.setAttribute('aria-label', label); // the label hides on phones (CSS), the name stays
  return b;
}

/** A selector for the focused element that survives a re-render (markers, chips, list links by item id). */
function focusKey() {
  const el = document.activeElement;
  if (!el || !root.contains(el) || !el.dataset) return null;
  const host = el.closest('[data-id]');
  if (!host) return null;
  const cls = [...host.classList].find((c) => /^vet-(marker|pmarker|chip|ref)$/.test(c));
  const area = host.closest('.vet-scale[data-axis], .vet-plane, .vet-tray, .vet-table');
  const where = area ? (area.dataset.axis ? `.vet-scale[data-axis="${area.dataset.axis}"] ` : area.classList.contains('vet-plane') ? '.vet-plane ' : area.classList.contains('vet-table') ? '.vet-table ' : '') : '';
  if (host.tagName === 'TR') return `${where}tr[data-id="${host.dataset.id}"] ${el.tagName.toLowerCase()}${el.type === 'checkbox' ? '[type=checkbox]' : '.vet-link'}`;
  return cls ? `${where}.${cls}[data-id="${host.dataset.id}"]` : null;
}

function render() {
  const fk = focusKey();
  renderAll();
  if (fk) root.querySelector(fk)?.focus({ preventScroll: true });
}

function renderAll() {
  renderBar();
  renderNotice();
  renderStart();
  renderCard(); // before the scales: the card takes width, and the marker lanes are measured on the final width
  renderScales();
  renderList();
}

/** Solo: one quiet line about where the data lives, with the two ways to keep it. Team: role, mode, save state and who is here (MO-6, MO-9). */
function renderNotice() {
  ui.notice.classList.toggle('is-team', !!team);
  if (!team && (bridge.on || bridge.session)) { ui.notice.replaceChildren(); return; } // in VSS or the wallet the result goes back to the host
  if (!team) {
    const keep = [btn(t('export'), () => openExport(), { cls: 'vet-link-btn' }), !bridge.on && !bridge.session && SHARE ? btn(t('share'), () => shareSolo(), { cls: 'vet-link-btn' }) : null].filter(Boolean);
    ui.notice.replaceChildren(h('span', { class: 'vet-dot', 'aria-hidden': 'true' }), h('span', { text: t('notice.soloShort') }), ...keep);
    return;
  }
  const st = team.status;
  const state = h('span', { class: 'vet-save is-' + st, text: t('team.status.' + st) + (st === 'saved' && team.savedAt ? ' ' + team.savedAt.toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit' }) : '') });
  const people = h('span', { class: 'vet-people' }, (team.view.participants || []).slice(0, 12).map((p) => h('span', {
    class: 'vet-avatar' + (p.online ? ' is-online' : '') + (p.id === team.view.me.participantId ? ' is-me' : ''),
    title: `${p.name || '?'} · ${t('team.role.' + p.role)}${p.guest ? ' · ' + t('team.guest') : ''}`, text: initials(p.name) })));
  ui.notice.replaceChildren(
    h('strong', { text: t('team.board') }), ' · ', t('team.role.' + team.role), ' · ', t('team.mode.' + team.mode),
    team.mode === 'blind' ? ' (' + t(team.revealed ? 'team.revealed' : 'team.hidden') + ')' : '',
    team.closed ? h('span', { class: 'vet-closed', text: ' · ' + t('team.closed') }) : '', ' · ', state, h('span', { class: 'vet-grow' }), people,
    ...(root.dataset.user ? [h('a', { class: 'vet-link', href: localHref('/tools/vet/boards/'), text: t('team.myBoards') })] : []));
}
const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((x) => x[0] || '').join('').toUpperCase() || '?';
const localHref = (p) => { const m = location.pathname.match(/^\/([a-z]{2})\//); return m ? '/' + m[1] + p : p; };

/** A menu button with arrow keys, Home / End and Escape. items: [label, fn, { icon, danger }] or null. */
function menuButton(label, items, { icon = 'more' } = {}) {
  items = items.filter(Boolean);
  const list = h('div', { class: 'vet-menu', role: 'menu', hidden: true });
  const b = btn(label, () => toggle(), { icon });
  b.setAttribute('aria-haspopup', 'menu'); b.setAttribute('aria-expanded', 'false');
  const all = () => [...list.querySelectorAll('[role=menuitem]:not([disabled])')];
  const close = (focus) => { list.hidden = true; b.setAttribute('aria-expanded', 'false'); document.removeEventListener('pointerdown', outside, true); if (focus) b.focus(); };
  const outside = (e) => { if (!wrap.contains(e.target)) close(false); };
  const toggle = (first) => {
    if (!list.hidden) { close(false); return; }
    list.hidden = false; b.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', outside, true);
    if (first) all()[0]?.focus();
  };
  for (const [text, fn, o = {}] of items) list.append(h('button', { type: 'button', role: 'menuitem', class: 'vet-menu-item' + (o.danger ? ' is-danger' : ''), disabled: o.disabled ? true : null,
    onclick: () => { close(true); fn(); } }, o.icon ? svgIcon(ICON[o.icon], 16) : null, h('span', { text })));
  b.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) toggle(true); else all()[0]?.focus(); } });
  list.addEventListener('keydown', (e) => {
    const l = all(), i = l.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); l[(i + (e.key === 'ArrowDown' ? 1 : -1) + l.length) % l.length]?.focus(); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); (e.key === 'Home' ? l[0] : l[l.length - 1])?.focus(); }
    else if (e.key === 'Tab') close(false);
  });
  const wrap = h('div', { class: 'vet-menu-wrap' }, b, list);
  return wrap;
}

/** Toolbar (UX refactoring): title | Add, Paste | 1D/2D | Undo, Redo ... Export, Share, More. */
function renderBar() {
  const ro = team && !team.canEdit;
  const title = h('input', { class: 'vet-title', value: board.title, placeholder: t('board.untitled'), 'aria-label': t('board.title'), maxlength: '120', readonly: ro || null,
    onchange: (e) => change(() => { board.title = e.target.value.trim(); }, { noScale: true }) });
  const view = h('div', { class: 'vet-seg', role: 'group', 'aria-label': t('view.label') },
    btn('1D', () => change(() => { board.view = '1d'; }, { noScale: true }), { pressed: board.view === '1d' }),
    btn('2D', () => change(() => { board.view = '2d'; }, { noScale: true }), { pressed: board.view === '2d' }));
  const share = bridge.on || bridge.session ? null : team ? (team.role === 'facilitator' ? btn(t('share'), () => openShare(), { icon: 'share' }) : null)
    : SHARE ? btn(t('share'), () => shareSolo(), { icon: 'share' }) : null;
  const more = menuButton(t('more'), [
    ro ? null : [t('import'), () => openImport(), { icon: 'upload' }],
    team && !team.canEstimate ? null : [t('flow.start'), () => openFlow(), { icon: 'play', disabled: !board.items.length }],
    ro ? null : [t('settings'), () => openSettings(), { icon: 'gear' }],
    [t('csv.quick'), () => { download(C.toCSV(board, C.sortedItems(board), (id) => typeName(id)), C.fileName(board, 'csv'), 'text/csv'); if (TV) TV.note('export'); }, { icon: 'download' }],
    [t('keys.title'), openKeys],
    ro || !board.items.length ? null : [t('clear'), () => confirmBox(t('clear.ask'), t('clear'), clearBoard), { icon: 'trash', danger: true }],
  ]);
  ui.bar.replaceChildren(...[ // replaceChildren would print a null as text
    title,
    ro ? null : h('div', { class: 'vet-group' }, btn(t('add.short'), () => openAdd(), { icon: 'plus', cls: 'vet-btn-primary' }), btn(t('paste.short'), () => openPaste(), { icon: 'paste' })),
    view,
    h('div', { class: 'vet-group' }, btn('', undo, { icon: 'undo', title: t('undo') + ' (Ctrl+Z)', disabled: !hist.past.length }),
      btn('', redo, { icon: 'redo', title: t('redo') + ' (Ctrl+Shift+Z)', disabled: !hist.future.length })),
    h('span', { class: 'vet-grow' }),
    btn(t('export'), () => openExport(), { icon: 'download' }),
    share, more,
  ].filter(Boolean));
  if (bridge.flowRef || bridge.ledgerRef) ui.bar.prepend(bridgeBanner());
}

/** Keyboard shortcuts in one place (UX review). */
function openKeys() {
  const rows = ['keys.marker', 'keys.bucket', 'keys.plane', 'keys.delete', 'keys.tray', 'keys.flow', 'keys.undo', 'keys.add', 'keys.menu'].map((k) => {
    const [key, what] = t(k).split(' | ');
    return h('tr', {}, h('td', {}, h('kbd', { text: key })), h('td', { text: what || '' }));
  });
  const d = dialog(t('keys.title'), h('table', { class: 'vet-table is-small vet-keys' }, h('tbody', {}, rows)), [btn(t('close'), () => d.closeNow(), { cls: 'vet-btn-primary' })]);
}

function clearBoard() {
  change(() => {
    board.items = []; board.estimates = []; picked.clear(); selected = null;
    for (const key of ['out', 'in']) if (!board.axes[key].autoscale.manual) { const ax = board.axes[key]; const old = { ...ax.scale }; ax.scale.max = Math.max(ax.autoscale.minLength, 10 * ax.scale.step); if (ax.scale.min < 0) ax.scale.min = -ax.scale.max / 2; C.rebuildBuckets(ax, old); }
  });
}

/** Empty board: three steps to the first ranking, a start from a template, the file or a sample (onboarding). */
function renderStart() {
  ui.start.replaceChildren();
  if (board.items.length || bridge.on || (team && !team.canEdit)) return;
  const tpl = h('select', { 'aria-label': t('tpl.start'), onchange: (e) => { const k = e.target.value; if (k) change(() => preset(k), { noScale: true }); } },
    h('option', { value: '', text: t('tpl.start') }), ['valueEffort', 'effortMoney', 'moneyMoney', 'riskBenefit'].map((k) => h('option', { value: k, text: t('preset.' + k) })));
  ui.start.append(h('div', { class: 'vet-start-card' },
    h('h2', { class: 'vet-h2', text: t('start.title') }),
    h('ol', { class: 'vet-steps' }, ['start.s1', 'start.s2', 'start.s3'].map((k) => h('li', { text: t(k) }))),
    h('div', { class: 'vet-row' }, btn(t('add.short'), () => openAdd(), { icon: 'plus', cls: 'vet-btn-primary' }), btn(t('paste.open'), () => openPaste(), { icon: 'paste' }),
      btn(t('start.sample'), loadSample), tpl, btn(t('tpl.import'), () => openImport(), { icon: 'upload', cls: 'vet-btn-ghost' }), btn(t('tpl.refs'), () => openAdd({ asRef: true }), { cls: 'vet-btn-ghost' }))));
}

/** A small sample board to see the idea at once (onboarding). */
function loadSample() {
  change(() => {
    preset('valueEffort');
    const taken = new Set();
    t('start.sampleItems').split('\n').forEach((line) => {
      const [title, o, i] = line.split(';').map((x) => x.trim());
      if (!title) return;
      const it = C.makeItem(board, { title, taken }); taken.add(it.code); board.items.push(it);
      setEst(it.id, 'out', Number(o), 'input'); setEst(it.id, 'in', Number(i), 'input');
    });
  });
  toast(t('start.sampleDone'), () => undo());
}

function preset(key) { // AX-3
  const p = {
    effortMoney: [{ ru: 'Трудозатраты', en: 'Effort' }, { ru: 'Деньги', en: 'Money' }],
    valueEffort: [{ ru: 'Трудозатраты', en: 'Effort' }, { ru: 'Ценность', en: 'Value' }],
    moneyMoney: [{ ru: 'Деньги', en: 'Money' }, { ru: 'Деньги', en: 'Money' }],
    riskBenefit: [{ ru: 'Риск', en: 'Risk' }, { ru: 'Польза', en: 'Benefit' }],
    base: [{}, {}],
  }[key];
  board.axes.in.label = { ...p[0] };
  board.axes.out.label = { ...p[1] };
}

// ---------- scales (1D) ----------

const domainOf = (axis) => { const s = axis.scale; return [s.min - s.step / 2, s.max + s.step / 2]; };
const pct = (axis, v) => { const [a, b] = domainOf(axis); return ((Math.min(Math.max(v, axis.scale.min), axis.scale.max) - a) / (b - a)) * 100; };

function visibleItems() {
  const q = filter.q.trim().toLowerCase();
  return board.items.filter((it) => !it.isReference
    && (!filter.types || filter.types.has(it.typeId))
    && (!q || String(it.code).toLowerCase().includes(q) || it.title.toLowerCase().includes(q))
    && (!filter.discuss || !team || C.needsDiscussion(board, it.id))
    && (!filter.goal || (filter.goal === 'none' ? !(it.goalIds || []).some((g) => HP.goalById(board, g)) : (it.goalIds || []).some((g) => goalSet().has(g))))
    && (!filter.bucket || C.bucketOf(board.axes[filter.bucket.axis], C.valueOf(board, it.id, filter.bucket.axis))?.id === filter.bucket.id));
}

const goalSet = () => (filter.goal && filter.goal !== 'none' ? HP.goalSubtree(board, filter.goal) : new Set());
const refItems = () => board.items.filter((it) => it.isReference);
const showRefs = () => board.settings.showRefs !== false;

/** A reference on a scale or the plane (HP-2): outlined, pinned, not draggable; the title shows where it came from. */
function refMarker(it, style) {
  return h('button', { type: 'button', class: 'vet-ref' + (selected === it.id ? ' is-selected' : ''), style, dataset: { id: it.id },
    title: `${t('ref.one')} · ${it.code}: ${it.title}${it.refNote ? '\n' + it.refNote : ''}`, 'aria-label': `${t('ref.one')} ${it.code} ${it.title}`,
    onclick: () => select(it.id) }, h('span', { text: '◆ ' + it.code }));
}

function renderScales() {
  ui.scales.replaceChildren();
  const items = visibleItems();
  if (board.view === '2d') { ui.scales.append(plane(items)); return; }
  for (const key of ['out', 'in']) {
    if (key === 'in' && board.priority === 'out') continue;
    ui.scales.append(scale1d(key, items));
  }
}

function scale1d(key, items) {
  const axis = board.axes[key], s = axis.scale;
  const wrap = h('div', { class: 'vet-scale', dataset: { axis: key } });
  // header: name (inline rename, AX-2), unit, x2 (AX-18)
  const name = h('button', { type: 'button', class: 'vet-axis-name', title: t('axis.rename'), text: axisName(key) + (axis.unit ? ', ' + axis.unit : ''),
    onclick: () => {
      const inp = h('input', { class: 'vet-axis-input', value: axisName(key), 'aria-label': t('axis.rename'), maxlength: '60' });
      const done = () => { const v = inp.value.trim(); change(() => { board.axes[key].label = { ...board.axes[key].label, [LOC]: v }; if (!v) delete board.axes[key].label[LOC]; }, { noScale: true }); };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = axisName(key); inp.blur(); } });
      inp.addEventListener('blur', done, { once: true });
      name.replaceWith(inp); inp.focus(); inp.select();
    } });
  const dbl = Math.min(C.MAX_ABS, s.max * 2);
  const tray = items.filter((it) => myPos(it.id, key) === null);
  wrap.append(h('div', { class: 'vet-scale-head' }, name, h('span', { class: 'vet-scale-range', text: t('axis.range', { min: C.fmtNum(s.min, LANG), max: C.fmtNum(s.max, LANG) }) }), h('span', { class: 'vet-grow' }),
    s.type === 'list' || (team && !team.canEdit) ? null : btn(t('axis.extend', { max: C.fmtNum(dbl, LANG) }), () => change(() => {
      const old = { ...s }; s.max = dbl; axis.autoscale.manual = true; C.rebuildBuckets(axis, old);
    }, { noScale: true }), { cls: 'vet-btn-sm', title: t('axis.doubleHint'), disabled: s.max >= C.MAX_ABS })));
  if (axis.autoscale.manual) wrap.append(h('p', { class: 'vet-hint' }, t('axis.autoOff') + ' ', h('button', { type: 'button', class: 'vet-link', text: t('axis.autoOn'),
    onclick: () => change(() => { axis.autoscale.manual = false; }) })));

  // stacks of markers per value (NF-2)
  const groups = new Map();
  for (const it of items) {
    const v = myPos(it.id, key);
    if (v === null) continue;
    const pos = C.inScale(axis, v) ? v : v > s.max ? s.max : s.min;
    if (!groups.has(pos)) groups.set(pos, []);
    groups.get(pos).push(it);
  }
  // lanes: markers never overlap; one value stacks upward, more than 5 collapse into "+N" (NF-2)
  const W = Math.max(280, (ui.scales.clientWidth || root.clientWidth || 800) - 44);
  const placed = [], lanesRight = [];
  for (const [v, list] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    const collapsed = list.length > 5 && !openStacks.has(key);
    const entries = (collapsed ? list.slice(0, 4) : list).map((it) => ({ it, w: 24 + 7.4 * String(it.code).length + (it.polarity === 'anti' ? 7 : 0) }));
    if (collapsed) entries.push({ more: list, w: 38 });
    const x = (pct(axis, v) / 100) * W;
    for (const en of entries) {
      let lane = 0;
      while (lanesRight[lane] !== undefined && lanesRight[lane] > x - 1) lane++;
      lanesRight[lane] = x + en.w + 3;
      placed.push({ ...en, v, lane });
    }
  }
  const maxStack = Math.max(1, lanesRight.length);
  const track = h('div', { class: 'vet-track', style: { paddingTop: (32 + maxStack * 30) + 'px' } });
  const band = h('div', { class: 'vet-band' });
  for (const b of axis.buckets) {
    const l = pct(axis, b.from - s.step / 2 + s.step / 2) - (50 / ((s.max - s.min) / s.step + 1));
    const r = pct(axis, b.to) + (50 / ((s.max - s.min) / s.step + 1));
    const count = items.filter((it) => C.bucketOf(axis, myPos(it.id, key))?.id === b.id).length;
    const active = filter.bucket && filter.bucket.axis === key && filter.bucket.id === b.id;
    band.append(h('button', { type: 'button', class: 'vet-bucket ink-' + inkOn(b.color) + (b.polarity === 'anti' ? ' is-anti' : '') + (active ? ' is-active' : ''), style: { left: l + '%', width: Math.max(0, r - l) + '%', '--c': b.color },
      title: t('bucket.filter', { name: b.label }), 'aria-pressed': String(!!active),
      onclick: () => { filter.bucket = active ? null : { axis: key, id: b.id }; render(); } },
      h('span', { class: 'vet-bucket-name', text: b.label }), count ? h('span', { class: 'vet-bucket-count', text: String(count) }) : null));
  }
  track.append(band);
  if (s.min < 0) track.append(h('div', { class: 'vet-zero', style: { left: pct(axis, 0) + '%' } }, h('span', { text: t('axis.neutral') })));
  // ticks and bucket boundaries (AX-18)
  const tk = h('div', { class: 'vet-ticks' + (board.settings.bucketsOnly ? ' is-hidden' : '') });
  const shown = new Set();
  const tv = C.ticks(s, Math.max(4, Math.floor((ui.scales.clientWidth || root.clientWidth || 800) / 90)));
  if (!tv.includes(s.min) && (!tv.length || pct(axis, tv[0]) - pct(axis, s.min) > 4)) tv.unshift(s.min); // the scale start is always labelled
  for (const v of tv) { shown.add(v); tk.append(h('span', { style: { left: pct(axis, v) + '%' }, text: C.fmtNum(v, LANG) })); }
  // bucket edges are not added as numbers: the band shows them (UX review, the row looked irregular)
  track.append(tk);
  if (team && team.othersVisible && selected && items.some((x) => x.id === selected)) track.append(...peers(selected, key));
  if (showRefs()) for (const it of refItems()) { const v = C.valueOf(board, it.id, key); if (v !== null && Number.isFinite(v)) track.append(refMarker(it, { left: pct(axis, v) + '%', top: '4px' })); }
  for (const it of items) { // HP-9: where the formula would put an item that was moved by hand
    if (!it.manual || !it.manual[key]) continue;
    const fv = HP.formulaValue(board, it, key);
    if (fv && fv.value !== null && fv.value !== myPos(it.id, key)) track.append(h('span', { class: 'vet-fghost', style: { left: pct(axis, fv.value) + '%' }, title: t('hp.formulaHere', { code: it.code }) }));
  }
  // markers
  for (const p of placed) {
    if (p.more) track.append(h('button', { type: 'button', class: 'vet-more', style: { left: pct(axis, p.v) + '%', bottom: (64 + p.lane * 30) + 'px' }, text: '+' + (p.more.length - 4),
      'aria-haspopup': 'dialog', title: p.more.slice(4).map((x) => x.code).join(', '), onclick: (e) => stackChooser(e.currentTarget, p.more, key, p.v) }));
    else track.append(marker(p.it, key, p.v, p.lane));
  }
  wrap.append(track);
  // tray (UI-1)
  wrap.append(trayEl(key, tray));
  return wrap;
}

function marker(it, key, v, stackIndex) {
  const axis = board.axes[key];
  const ty = C.typeById(board, it.typeId);
  const b = C.bucketOf(axis, myPos(it.id, key));
  const out = !C.inScale(axis, myPos(it.id, key));
  const m = h('button', {
    type: 'button', role: 'slider', class: 'vet-marker' + (it.polarity === 'anti' ? ' is-anti' : '') + (selected === it.id ? ' is-selected' : '') + (out ? ' is-out' : ''),
    style: { left: pct(axis, v) + '%', bottom: (64 + stackIndex * 30) + 'px', '--t': ty.color, '--b': b ? b.color : '#8a9a97', '--lane': String(stackIndex) },
    'aria-valuemin': String(axis.scale.min), 'aria-valuemax': String(axis.scale.max), 'aria-valuenow': String(myPos(it.id, key)),
    'aria-valuetext': `${axisName(key)} ${C.fmtNum(myPos(it.id, key), LANG, false)}${b ? ', ' + b.label : ''}, ${it.code} ${it.title}${it.manual && it.manual[key] ? ', ' + t('hp.manual') : ''}`,
    title: `${it.code}: ${it.title}\n${axisName(key)}: ${C.fmtNum(myPos(it.id, key), LANG, false)}${b ? ' (' + b.label + ')' : ''}${out ? '\n' + t('outOfScale') : ''}`,
    dataset: { id: it.id },
  }, h('span', { class: 'vet-marker-code', text: (it.manual && it.manual[key] ? '✋ ' : '') + (it.polarity === 'anti' ? '−' : '') + it.code }));
  m.addEventListener('click', () => select(it.id));
  m.addEventListener('keydown', (e) => markerKey(e, it, key));
  dragMarker(m, it, key);
  return m;
}

function markerKey(e, it, key, otherKey) {
  const axis = board.axes[key], s = axis.scale;
  const v = myPos(it.id, key);
  if (v === null) return;
  let nv = null;
  const bk = C.bucketOf(axis, v);
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    if (e.shiftKey && bk) { const list = axis.buckets; const i = list.indexOf(bk) + dir; nv = list[i] ? C.bucketMiddle(axis, list[i]) : v; }
    else nv = C.roundTo(v + dir * s.step, s.step);
  } else if (otherKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    markerKey({ ...e, key: e.key === 'ArrowUp' ? 'ArrowRight' : 'ArrowLeft', preventDefault: () => e.preventDefault() }, it, otherKey);
    return;
  } else if (e.key === 'Delete' || e.key === 'Backspace') { change(() => setEst(it.id, key, null)); return; }
  else return;
  e.preventDefault();
  nv = clampFor(it, key, nv);
  change(() => setEst(it.id, key, nv, 'input'));
  requestAnimationFrame(() => root.querySelector(`.vet-scale[data-axis="${key}"] .vet-marker[data-id="${it.id}"], .vet-plane .vet-marker[data-id="${it.id}"]`)?.focus());
}

/** EL-1: anti-value items stay in the negative part of "out". */
function clampFor(it, key, v) {
  const s = board.axes[key].scale;
  let lo = s.min, hi = s.max;
  if (key === 'out' && it.polarity === 'anti') hi = Math.min(hi, 0);
  if (board.settings.bucketsOnly) { const b = C.bucketOf(board.axes[key], Math.min(Math.max(v, lo), hi)); if (b) return C.bucketMiddle(board.axes[key], b); }
  return Math.min(Math.max(C.roundTo(v, s.step), lo), hi);
}

function valueAt(key, clientX, track) {
  const axis = board.axes[key];
  const r = track.getBoundingClientRect();
  const [a, b] = domainOf(axis);
  return a + ((clientX - r.left) / r.width) * (b - a);
}

/** Drag along the scale (snaps to the step); drop on the tray clears the estimate (UI-1). */
function dragMarker(m, it, key) {
  m.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const track = m.closest('.vet-track');
    const wrap = m.closest('.vet-scale');
    let moved = false, val = myPos(it.id, key);
    if (team) team.busy = true;
    m.setPointerCapture(e.pointerId);
    const move = (ev) => {
      if (!moved && Math.abs(ev.clientX - e.clientX) < 3 && Math.abs(ev.clientY - e.clientY) < 3) return;
      moved = true;
      m.classList.add('is-drag');
      val = clampFor(it, key, valueAt(key, ev.clientX, track));
      m.style.left = pct(board.axes[key], val) + '%';
      m.title = String(val);
      ui.live.textContent = `${it.code}: ${C.fmtNum(val, LANG, false)}`;
      updateRowValue(it.id, key, val);
      refHint(track, key, val);
      const overTray = wrap.querySelector('.vet-tray')?.getBoundingClientRect();
      m.classList.toggle('is-remove', !!overTray && ev.clientY > overTray.top);
    };
    const up = (ev) => {
      m.removeEventListener('pointermove', move); m.removeEventListener('pointerup', up); m.removeEventListener('pointercancel', up);
      if (team) team.busy = false;
      refHint(track, key, null);
      if (!moved) return;
      const overTray = wrap.querySelector('.vet-tray')?.getBoundingClientRect();
      if (overTray && ev.clientY > overTray.top) change(() => setEst(it.id, key, null));
      else change(() => setEst(it.id, key, val, 'drag'));
    };
    m.addEventListener('pointermove', move); m.addEventListener('pointerup', up); m.addEventListener('pointercancel', up);
  });
}

/** HP-4: "more than X, less than Y" next to the marker being dragged, the two references highlighted. */
function refHint(track, key, v) {
  track.querySelectorAll('.vet-ref.is-near').forEach((x) => x.classList.remove('is-near'));
  track.querySelector('.vet-refhint')?.remove();
  if (v === null || !refItems().length) return;
  const { below, above } = HP.nearestRefs(board, key, v, C.valueOf);
  if (!below && !above) return;
  [below, above].filter(Boolean).forEach((r) => track.querySelector(`.vet-ref[data-id="${r.it.id}"]`)?.classList.add('is-near'));
  const txt = [below ? t('hp.moreThan', { code: below.it.code }) : '', above ? t('hp.lessThan', { code: above.it.code }) : ''].filter(Boolean).join(', ');
  track.append(h('span', { class: 'vet-refhint', style: { left: pct(board.axes[key], v) + '%' }, text: txt }));
  ui.live.textContent += ' · ' + txt;
}

/** A crowded value: a small list of all its items instead of growing the whole axis (UX review, wave 2). */
function stackChooser(anchor, list, key, v) {
  document.querySelector('.vet-stack-pop')?.remove();
  const close = () => { pop.remove(); document.removeEventListener('pointerdown', outside, true); anchor.focus(); };
  const outside = (e) => { if (!pop.contains(e.target) && e.target !== anchor) close(); };
  const pop = h('div', { class: 'vet-stack-pop', role: 'dialog', 'aria-label': t('stack.title', { n: list.length, v: C.fmtNum(v, LANG, false) }) },
    h('strong', { text: t('stack.title', { n: list.length, v: C.fmtNum(v, LANG, false) }) }),
    h('ul', {}, list.map((it) => h('li', {}, h('button', { type: 'button', class: 'vet-link', text: `${it.polarity === 'anti' ? '−' : ''}${it.code} · ${it.title}`, onclick: () => { close(); select(it.id); } })))),
    h('div', { class: 'vet-row' }, btn(t('stack.expand'), () => { close(); openStacks.add(key); renderScales(); }, { cls: 'vet-btn-sm' }), btn(t('close'), close, { cls: 'vet-btn-sm' })));
  pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } });
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.min(window.innerWidth - 300, Math.max(8, r.left)) + 'px';
  pop.style.top = (r.bottom + 6) + 'px';
  document.body.append(pop);
  document.addEventListener('pointerdown', outside, true);
  pop.querySelector('button')?.focus();
}

function updateRowValue(id, key, v) {
  const cell = ui.list.querySelector(`tr[data-id="${id}"] td[data-col="${key}"]`);
  if (cell) cell.textContent = C.fmtNum(v, LANG, false);
}

function trayEl(key, list) {
  const tr = h('div', { class: 'vet-tray', dataset: { axis: key } }, h('span', { class: 'vet-tray-title', text: t('tray.title', { n: list.length }) }));
  if (!list.length) { tr.append(h('span', { class: 'vet-tray-empty', text: t('tray.empty') })); return tr; }
  for (const it of list.slice(0, 200)) tr.append(chip(it, key));
  if (list.length > 200) tr.append(h('span', { class: 'vet-tray-empty', text: '+' + (list.length - 200) }));
  return tr;
}

/** A not-yet-estimated item: drag it onto the scale or the plane (UI-1), or press Enter for the sequence mode. */
function chip(it, key) {
  const ty = C.typeById(board, it.typeId);
  const c = h('button', { type: 'button', class: 'vet-chip' + (it.polarity === 'anti' ? ' is-anti' : '') + (selected === it.id ? ' is-selected' : ''), style: { '--t': ty.color },
    title: `${it.code}: ${it.title}\n${t('chip.keys')}`, 'aria-keyshortcuts': 'ArrowLeft ArrowRight Home End Shift+Enter', dataset: { id: it.id } }, h('b', { text: (it.polarity === 'anti' ? '−' : '') + it.code }), h('span', { text: it.title }));
  c.addEventListener('click', () => select(it.id));
  c.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); openFlow(key === '2d' ? 'out' : key, it.id); return; }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || (team && !team.canEstimate)) return;
    e.preventDefault(); // UI-1 without a mouse: the item goes onto the scale and keeps the focus, arrows then move it
    const at = (k) => { const s = board.axes[k].scale; const mid = C.roundTo((s.min + s.max) / 2, s.step); return clampFor(it, k, e.key === 'Home' ? s.min : e.key === 'End' ? s.max : mid); };
    const keys = key === '2d' ? [xKey(), yKey()] : [key];
    selected = it.id;
    change(() => keys.forEach((k) => { if (myPos(it.id, k) === null) setEst(it.id, k, at(k), 'input'); }));
    requestAnimationFrame(() => root.querySelector(key === '2d' ? `.vet-plane .vet-marker[data-id="${it.id}"]` : `.vet-scale[data-axis="${key}"] .vet-marker[data-id="${it.id}"]`)?.focus());
  });
  c.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    let ghost = null;
    const move = (ev) => {
      if (!ghost) { if (Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) < 5) return; ghost = c.cloneNode(true); ghost.classList.add('vet-ghost'); document.body.append(ghost); }
      ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
    };
    const up = (ev) => {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
      if (!ghost) return;
      ghost.remove();
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      if (key === '2d') {
        const pl = el && el.closest('.vet-plane-area');
        if (pl) { const [vx, vy] = planeValue(pl, ev.clientX, ev.clientY); change(() => { setEst(it.id, xKey(), clampFor(it, xKey(), vx), 'drag'); setEst(it.id, yKey(), clampFor(it, yKey(), vy), 'drag'); }); }
        return;
      }
      const track = el && el.closest(`.vet-scale[data-axis="${key}"] .vet-track`);
      if (track) change(() => setEst(it.id, key, clampFor(it, key, valueAt(key, ev.clientX, track)), 'drag'));
    };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  });
  return c;
}

// ---------- plane (2D, UI-4) ----------

const xKey = () => (board.settings.swapAxes ? 'in' : 'out');
const yKey = () => (board.settings.swapAxes ? 'out' : 'in');

function planeValue(area, cx, cy) {
  const r = area.getBoundingClientRect();
  const [xa, xb] = domainOf(board.axes[xKey()]), [ya, yb] = domainOf(board.axes[yKey()]);
  return [xa + ((cx - r.left) / r.width) * (xb - xa), ya + ((r.bottom - cy) / r.height) * (yb - ya)];
}

function plane(items) {
  const X = board.axes[xKey()], Y = board.axes[yKey()];
  const wrap = h('div', { class: 'vet-plane' });
  wrap.append(h('div', { class: 'vet-scale-head' },
    h('strong', { text: `${axisName(xKey())} → / ${axisName(yKey())} ↑` }), h('span', { class: 'vet-grow' }),
    btn(t('plane.swap'), () => change(() => { board.settings.swapAxes = !board.settings.swapAxes; }, { noScale: true }), { icon: 'swap', cls: 'vet-btn-sm' }),
    btn(t(board.settings.guides === 'all' ? 'plane.guidesSel' : 'plane.guidesAll'), () => change(() => { board.settings.guides = board.settings.guides === 'all' ? 'selected' : 'all'; }, { noScale: true }), { cls: 'vet-btn-sm' })));
  const area = h('div', { class: 'vet-plane-area' });
  const yBand = h('div', { class: 'vet-plane-yband' }), xBand = h('div', { class: 'vet-plane-xband' });
  for (const b of Y.buckets) { const lo = pct(Y, b.from) - 50 / ((Y.scale.max - Y.scale.min) / Y.scale.step + 1), hi = pct(Y, b.to) + 50 / ((Y.scale.max - Y.scale.min) / Y.scale.step + 1); yBand.append(h('span', { class: 'vet-pband' + (b.polarity === 'anti' ? ' is-anti' : ''), style: { bottom: lo + '%', height: (hi - lo) + '%', '--c': b.color }, title: b.label }, h('i', { text: b.label }))); }
  for (const b of X.buckets) { const lo = pct(X, b.from) - 50 / ((X.scale.max - X.scale.min) / X.scale.step + 1), hi = pct(X, b.to) + 50 / ((X.scale.max - X.scale.min) / X.scale.step + 1); xBand.append(h('span', { class: 'vet-pband' + (b.polarity === 'anti' ? ' is-anti' : ''), style: { left: lo + '%', width: (hi - lo) + '%', '--c': b.color }, title: b.label }, h('i', { text: b.label }))); }
  // quadrants (UI-5): high value / low effort is bottom right
  const q = board.settings.quadrants || {};
  const swap = board.settings.swapAxes;
  area.append(h('span', { class: 'vet-quad q-tl', text: q.tl || t(swap ? 'quad.fill' : 'quad.dont') }), h('span', { class: 'vet-quad q-tr', text: q.tr || t(swap ? 'quad.wins' : 'quad.bets') }),
    h('span', { class: 'vet-quad q-bl', text: q.bl || t(swap ? 'quad.dont' : 'quad.fill') }), h('span', { class: 'vet-quad q-br', text: q.br || t(swap ? 'quad.bets' : 'quad.wins') }));
  area.append(h('div', { class: 'vet-mid-x' }), h('div', { class: 'vet-mid-y' }));
  if (showRefs()) for (const it of refItems()) {
    const rx = C.valueOf(board, it.id, xKey()), ry = C.valueOf(board, it.id, yKey());
    if (rx !== null && ry !== null && Number.isFinite(rx) && Number.isFinite(ry)) area.append(refMarker(it, { left: pct(X, rx) + '%', bottom: pct(Y, ry) + '%', transform: 'translate(-50%, 50%)' }));
  }
  if (X.scale.min < 0) area.append(h('div', { class: 'vet-zero', style: { left: pct(X, 0) + '%' } }));
  if (Y.scale.min < 0) area.append(h('div', { class: 'vet-zero-y', style: { bottom: pct(Y, 0) + '%' } }));
  const seen = new Map();
  for (const it of items) {
    const vx = myPos(it.id, xKey()), vy = myPos(it.id, yKey());
    if (vx === null || vy === null) continue;
    const k = vx + ':' + vy; const n = seen.get(k) || 0; seen.set(k, n + 1);
    const ty = C.typeById(board, it.typeId);
    const bx = C.bucketOf(X, vx), by = C.bucketOf(Y, vy);
    const left = pct(X, vx), bottom = pct(Y, vy);
    if (board.settings.guides === 'all' || selected === it.id) {
      area.append(h('div', { class: 'vet-guide-x', style: { left: left + '%', height: bottom + '%', '--c': bx ? bx.color : '#999' } }),
        h('div', { class: 'vet-guide-y', style: { bottom: bottom + '%', width: left + '%', '--c': by ? by.color : '#999' } }));
    }
    const m = h('button', { type: 'button', role: 'slider', class: 'vet-marker vet-pmarker' + (it.polarity === 'anti' ? ' is-anti' : '') + (selected === it.id ? ' is-selected' : ''),
      style: { left: `calc(${left}% + ${n * 6}px)`, bottom: `calc(${bottom}% + ${n * 6}px)`, '--t': ty.color, '--b': bx ? bx.color : '#8a9a97' }, dataset: { id: it.id },
      'aria-label': `${it.code} ${it.title}`, 'aria-orientation': 'horizontal', 'aria-keyshortcuts': 'ArrowLeft ArrowRight ArrowUp ArrowDown',
      'aria-valuemin': String(X.scale.min), 'aria-valuemax': String(X.scale.max), 'aria-valuenow': String(vx),
      'aria-valuetext': `${axisName(xKey())} ${C.fmtNum(vx, LANG, false)}, ${axisName(yKey())} ${C.fmtNum(vy, LANG, false)}, ${it.code} ${it.title}`,
      title: `${it.code}: ${it.title}\n${axisName(xKey())}: ${C.fmtNum(vx, LANG, false)}${bx ? ' (' + bx.label + ')' : ''}\n${axisName(yKey())}: ${C.fmtNum(vy, LANG, false)}${by ? ' (' + by.label + ')' : ''}` },
      h('span', { class: 'vet-marker-code', text: (it.polarity === 'anti' ? '−' : '') + it.code }));
    m.addEventListener('click', () => select(it.id));
    m.addEventListener('keydown', (e) => markerKey(e, it, xKey(), yKey()));
    m.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      m.setPointerCapture(e.pointerId);
      if (team) team.busy = true;
      let moved = false, nx = vx, ny = vy;
      const move = (ev) => {
        if (!moved && Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) < 4) return;
        moved = true; m.classList.add('is-drag');
        const [a, b] = planeValue(area, ev.clientX, ev.clientY);
        nx = clampFor(it, xKey(), a); ny = clampFor(it, yKey(), b);
        m.style.left = pct(X, nx) + '%'; m.style.bottom = pct(Y, ny) + '%';
        ui.live.textContent = `${it.code}: ${C.fmtNum(nx, LANG, false)} / ${C.fmtNum(ny, LANG, false)}`;
      };
      const up = () => {
        m.removeEventListener('pointermove', move); m.removeEventListener('pointerup', up);
        if (team) team.busy = false;
        if (moved) change(() => { setEst(it.id, xKey(), nx, 'drag'); setEst(it.id, yKey(), ny, 'drag'); });
      };
      m.addEventListener('pointermove', move); m.addEventListener('pointerup', up);
    });
    area.append(m);
  }
  const yt = h('div', { class: 'vet-plane-yticks' }), xt = h('div', { class: 'vet-plane-xticks' });
  if (!board.settings.bucketsOnly) {
    for (const v of C.ticks(Y.scale, 6)) yt.append(h('span', { style: { bottom: pct(Y, v) + '%' }, text: C.fmtNum(v, LANG) }));
    for (const v of C.ticks(X.scale, 8)) xt.append(h('span', { style: { left: pct(X, v) + '%' }, text: C.fmtNum(v, LANG) }));
  }
  wrap.append(h('div', { class: 'vet-plane-grid' }, yt, yBand, area, h('span'), h('span'), xBand, h('span'), h('span'), xt));
  const tray = items.filter((it) => myPos(it.id, 'out') === null || (board.priority !== 'out' && myPos(it.id, 'in') === null));
  const tr = h('div', { class: 'vet-tray' }, h('span', { class: 'vet-tray-title', text: t('tray.title', { n: tray.length }) }));
  if (!tray.length) tr.append(h('span', { class: 'vet-tray-empty', text: t('tray.empty') }));
  tray.slice(0, 200).forEach((it) => tr.append(chip(it, '2d')));
  wrap.append(tr);
  return wrap;
}

// ---------- card (selected item) ----------

function select(id) { selected = selected === id ? null : id; render(); }

/** The item inspector (UX refactoring 2026-10-21): title, both values, priority and polarity on top; the rest in
    collapsible sections whose open state is kept in this browser. Overrides, discrepancies and errors stay visible. */
const cardOpen = (() => { try { return JSON.parse(localStorage.getItem('vet.card.open') || '{}'); } catch (e) { return {}; } })();
function cardSection(key, title, kids, { open = false, count = '' } = {}) {
  kids = kids.filter(Boolean);
  if (!kids.length) return null;
  const d = h('details', { class: 'vet-card-sec', open: (cardOpen[key] ?? open) ? true : null,
    ontoggle: (e) => { cardOpen[key] = e.target.open; try { localStorage.setItem('vet.card.open', JSON.stringify(cardOpen)); } catch (x) { /* private mode */ } } },
  h('summary', {}, h('span', { text: title }), count ? h('small', { text: count }) : null), ...kids);
  return d;
}

function renderCard() {
  ui.card.replaceChildren();
  const it = board.items.find((x) => x.id === selected);
  ui.card.hidden = !it;
  if (!it) return;
  const ro = team && !team.canEdit;
  const f = (label, input) => h('label', { class: 'vet-field' }, h('span', { text: label }), input);
  const upd = (fn) => change(fn, { noScale: false });
  const title = h('input', { class: 'vet-card-title', value: it.title, maxlength: '200', 'aria-label': t('field.title'), readonly: ro || null, onchange: (e) => { const v = e.target.value.trim(); if (v) upd(() => { it.title = v; }); else e.target.value = it.title; } });
  const code = h('input', { value: it.code, maxlength: '24', readonly: ro || null, onchange: (e) => {
    const v = e.target.value.trim();
    if (!v || board.items.some((x) => x !== it && String(x.code).toLowerCase() === v.toLowerCase())) { toast(v ? t('err.dupCode', { code: v, type: typeName(it.typeId) }) : t('err.required')); e.target.value = it.code; return; }
    upd(() => { it.code = v; });
  } });
  const desc = h('textarea', { rows: '3', maxlength: '5000', readonly: ro || null, onchange: (e) => upd(() => { it.description = e.target.value; }) }); desc.value = it.description || '';
  const type = h('select', { disabled: ro || null, onchange: (e) => upd(() => { it.typeId = e.target.value; }) }, board.itemTypes.map((ty) => h('option', { value: ty.id, selected: ty.id === it.typeId || null, text: typeName(ty.id) })));
  const pol = h('select', { disabled: ro || null, onchange: (e) => upd(() => { it.polarity = e.target.value; ensureAnti(it); }) },
    h('option', { value: 'value', selected: it.polarity === 'value' || null, text: t('polarity.value') }), h('option', { value: 'anti', selected: it.polarity === 'anti' || null, text: t('polarity.anti') }));
  const canEst = !team || team.canEstimate;
  const numIn = (key) => { const v = myPos(it.id, key); return h('input', { type: 'number', step: 'any', class: 'vet-card-num', value: v === null ? '' : String(v), placeholder: t('notEstimated'), readonly: canEst ? null : true,
    onchange: (e) => upd(() => setEst(it.id, key, e.target.value === '' ? null : Number(e.target.value), 'input')) }); };
  const tags = h('input', { value: (it.tags || []).join(', '), placeholder: t('card.tagsHint'), readonly: ro || null, onchange: (e) => upd(() => { it.tags = e.target.value.split(',').map((x) => x.trim()).filter(Boolean); }) });
  const links = h('input', { value: (it.links || []).join(' '), placeholder: 'https://…', readonly: ro || null, onchange: (e) => upd(() => { it.links = e.target.value.split(/\s+/).filter((x) => /^https?:\/\//.test(x)); }) });
  const ext = h('input', { value: it.externalId || '', maxlength: '120', readonly: ro || null, onchange: (e) => upd(() => { it.externalId = e.target.value.trim(); }) });
  const p = C.priorityOf(board, it);
  const ty = C.typeById(board, it.typeId);
  // what must never hide: a manual override of a formula, a team discrepancy, blind mode
  const alerts = [
    ...['out', 'in'].filter((k) => it.manual && it.manual[k] && HP.formulaOf(board, k)).map((k) => h('p', { class: 'vet-small vet-card-alert' }, '✋ ' + axisName(k) + ': ' + t('hp.manual') + ' ',
      ro ? null : h('button', { type: 'button', class: 'vet-link', text: t('hp.back'), onclick: () => upd(() => applyFormula(it, true)) }))),
    team && team.othersVisible && C.needsDiscussion(board, it.id) ? h('p', { class: 'vet-warn vet-card-alert', text: t('team.discussHint') }) : null,
    team && team.mode === 'blind' && !team.revealed ? h('p', { class: 'vet-small vet-card-alert', text: t('team.mode.blind') + ' · ' + t('team.hidden') }) : null,
    it.isReference ? h('p', { class: 'vet-small vet-card-alert', text: '◆ ' + t('ref.one') + (it.refNote ? ' · ' + it.refNote : '') }) : null,
  ];
  const metrics = metricsBlock(it, upd, ro), goals = goalsBlock(it, upd, ro), refs = refBlock(it, upd, ro);
  ui.card.append(...[
    h('div', { class: 'vet-card-head', style: { '--t': ty.color } }, h('span', { class: 'vet-card-code', text: (it.polarity === 'anti' ? '−' : '') + it.code }), h('span', { class: 'vet-grow' }),
      btn('', () => { selected = null; render(); }, { icon: 'x', title: t('close') })),
    title,
    h('div', { class: 'vet-field-row vet-card-values' }, f(axisName('out'), numIn('out')), board.priority === 'out' ? null : f(axisName('in'), numIn('in'))),
    h('div', { class: 'vet-card-prio' }, h('span', { text: t('col.priority') }), h('strong', { text: fmtPriority(p) }), h('span', { class: 'vet-grow' }), h('label', { class: 'vet-inline-field' }, h('span', { text: t('field.polarity') }), pol)),
    p.note === 'neg-in' ? h('p', { class: 'vet-warn', text: t('warn.negIn') }) : null,
    ...alerts,
    cardSection('team', t('team.estimates'), [teamCard(it)], { open: true }),
    cardSection('metrics', t('hp.metrics'), metrics, { open: true }),
    cardSection('goals', t('goals.title'), goals, { count: (it.goalIds || []).length ? String((it.goalIds || []).length) : '' }),
    cardSection('details', t('card.details'), [h('div', { class: 'vet-field-row' }, f(t('field.code'), code), f(t('field.type'), type)), f(t('field.description'), desc), ...refs]),
    cardSection('links', t('card.linksTags'), [f(t('field.tags'), tags), f(t('field.links'), links), f(t('field.external'), ext)]),
    ro ? null : h('div', { class: 'vet-row vet-card-foot' }, btn(t('delete'), () => deleteItems([it.id]), { icon: 'trash', cls: 'vet-btn-danger vet-btn-sm' }))].filter(Boolean));
}

/** HP-6, HP-9: metric values and what the formula makes of them. */
function metricsBlock(it, upd, ro) {
  if (!(board.metrics || []).length) return [];
  const rows = board.metrics.map((m) => h('label', { class: 'vet-field' }, h('span', { text: metricName(m) + (m.unit ? ', ' + m.unit : '') }),
    h('input', { type: 'number', step: 'any', value: it.metrics && Number.isFinite(it.metrics[m.key]) ? String(it.metrics[m.key]) : '', readonly: ro || null,
      onchange: (e) => upd(() => { it.metrics = { ...(it.metrics || {}) }; if (e.target.value === '') delete it.metrics[m.key]; else it.metrics[m.key] = Number(e.target.value); applyFormula(it); }) })));
  const lines = ['out', 'in'].filter((k) => k === 'out' || board.priority !== 'out').map((key) => {
    const fv = HP.formulaValue(board, it, key);
    if (!fv) return null;
    if (fv.error) return h('p', { class: 'vet-warn', text: axisName(key) + ': ' + t('hp.formulaError') });
    if (fv.value === null) return h('p', { class: 'vet-small', text: axisName(key) + ': ' + t('hp.missing', { names: fv.missing.map((k) => metricName(board.metrics.find((m) => m.key === k) || { key: k })).join(', ') }) });
    return h('p', { class: 'vet-small' }, h('b', { text: axisName(key) + ': ' }), t('hp.byFormula', { v: C.fmtNum(fv.value, LANG, false) }));
  });
  return [h('div', { class: 'vet-field-row is-wrap' }, rows), ...lines.filter(Boolean)];
}

/** HP-12, HP-13: the item's goals and why it matters. */
function goalsBlock(it, upd, ro) {
  const goals = HP.goalTree(board);
  if (!goals.length) return [];
  const have = new Set(it.goalIds || []);
  const checks = goals.map(({ goal, depth }) => h('label', { class: 'vet-check', style: { paddingInlineStart: depth * 14 + 'px' } },
    h('input', { type: 'checkbox', checked: have.has(goal.id) || null, disabled: ro || null, onchange: (e) => upd(() => { const set = new Set(it.goalIds || []); if (e.target.checked) set.add(goal.id); else set.delete(goal.id); it.goalIds = [...set]; applyFormula(it); }) }),
    h('span', { text: goal.title })));
  const why = (it.goalIds || []).filter((g) => HP.goalById(board, g)).map((g) => h('li', { text: [it.code, ...HP.goalChain(board, g).map((x) => x.title)].join(' → ') }));
  return [...checks, why.length ? h('div', { class: 'vet-why' }, h('strong', { text: t('goals.why') }), h('ul', {}, why)) : h('p', { class: 'vet-small vet-muted', text: t('goals.noGoal') })];
}

/** HP-1: the reference switch and its note. */
function refBlock(it, upd, ro) {
  if (ro) return [];
  const estimated = C.valueOf(board, it.id, 'out') !== null;
  return [h('label', { class: 'vet-check', title: estimated ? '' : t('ref.needValue') },
    h('input', { type: 'checkbox', checked: it.isReference || null, disabled: !estimated && !it.isReference ? true : null,
      onchange: (e) => upd(() => { it.isReference = e.target.checked; if (!it.isReference) delete it.refNote; }) }), h('span', { text: t('ref.make') })),
  it.isReference ? h('label', { class: 'vet-field' }, h('span', { text: t('ref.note') }), h('input', { value: it.refNote || '', maxlength: '200', onchange: (e) => upd(() => { it.refNote = e.target.value.trim(); }) })) : null].filter(Boolean);
}

const metricName = (m) => (m.name && (m.name[LOC] || m.name.en || Object.values(m.name)[0])) || m.key;

function fmtPriority(p) { return p.value === null ? t('notEstimated') : p.value === Infinity ? '∞' : p.value === -Infinity ? '-∞' : C.fmtNum(Math.round(p.value * 10) / 10, LANG, false); }

/** EL-1: an anti-value item needs a negative part on "out"; offer to switch it on. */
function ensureAnti(it) {
  if (it.polarity !== 'anti') return;
  const ax = board.axes.out;
  if (ax.scale.min < 0) return;
  setTimeout(() => confirmBox(t('anti.enable'), t('anti.enableYes'), () => change(() => {
    const old = { ...ax.scale }; ax.scale.min = -Math.max(ax.scale.step, C.roundTo(ax.scale.max / 2, ax.scale.step)); C.rebuildBuckets(ax, old);
  })), 0);
}

// ---------- list ----------

function renderList() {
  const items = visibleItems();
  const rows = C.sortedItems(board, items);
  ui.list.replaceChildren();
  const head = h('div', { class: 'vet-list-head' },
    h('h2', { class: 'vet-h2', text: typeName(board.itemTypes[0].id, true) + ` (${board.items.length})` }),
    h('input', { type: 'search', class: 'vet-search', placeholder: t('search'), value: filter.q, 'aria-label': t('search'),
      oninput: (e) => { filter.q = e.target.value; renderScales(); renderListBody(); } }),
    h('span', { class: 'vet-grow' }),
    (() => { const left = board.items.filter((x) => !x.isReference && C.neededAxes(board).some((k) => myPos(x.id, k) === null)).length; // connect the list to estimating
      return left && (!team || team.canEstimate) ? btn(t('list.remaining', { n: left }), () => openFlow(), { icon: 'play', cls: 'vet-btn-sm' }) : null; })());
  const types = h('div', { class: 'vet-filters' }, board.itemTypes.length > 1 ? board.itemTypes.map((ty) => {
    const on = !filter.types || filter.types.has(ty.id);
    return h('button', { type: 'button', class: 'vet-tag', 'aria-pressed': String(on), style: { '--t': ty.color }, text: typeName(ty.id, true), onclick: () => {
      const set = new Set(filter.types || board.itemTypes.map((x) => x.id)); if (on) set.delete(ty.id); else set.add(ty.id);
      filter.types = set.size === board.itemTypes.length ? null : set; render();
    } });
  }) : null, team && team.othersVisible && board.items.some((x) => C.needsDiscussion(board, x.id)) ? h('button', { type: 'button', class: 'vet-tag' + (filter.discuss ? ' is-active' : ''), 'aria-pressed': String(!!filter.discuss), text: t('team.discussFilter'), onclick: () => { filter.discuss = !filter.discuss; render(); } }) : null,
  filter.bucket ? h('button', { type: 'button', class: 'vet-tag is-active', text: `${axisName(filter.bucket.axis)}: ${board.axes[filter.bucket.axis].buckets.find((b) => b.id === filter.bucket.id)?.label || ''} ✕`, onclick: () => { filter.bucket = null; render(); } }) : null);
  types.append(...[
    refItems().length ? h('button', { type: 'button', class: 'vet-tag' + (filter.refs ? ' is-active' : ''), 'aria-pressed': String(!!filter.refs), text: t('ref.list', { n: refItems().length }), onclick: () => { filter.refs = !filter.refs; render(); } }) : null,
    refItems().length ? h('label', { class: 'vet-check vet-inline' }, h('input', { type: 'checkbox', checked: showRefs() || null, onchange: (e) => change(() => { board.settings.showRefs = e.target.checked; }, { noScale: true }) }), h('span', { text: t('ref.show') })) : null,
    filter.goal ? h('button', { type: 'button', class: 'vet-tag is-active', text: (filter.goal === 'none' ? t('goals.none') : t('goals.title') + ': ' + (HP.goalById(board, filter.goal)?.title || '')) + ' ✕', onclick: () => { filter.goal = null; render(); } }) : null,
  ].filter(Boolean));
  ui.list.append(head, types, goalsPanel());
  if (filter.refs) { ui.list.append(refList()); return; }
  ui.tbody = h('tbody');
  const tbl = h('table', { class: 'vet-table' }, h('thead', {}, h('tr', {},
    h('th', { scope: 'col', class: 'vet-c-pick' }, h('input', { type: 'checkbox', 'aria-label': t('pickAll'), checked: rows.length && rows.every((r) => picked.has(r.id)) || null,
      onchange: (e) => { C.sortedItems(board, visibleItems()).forEach((r) => (e.target.checked ? picked.add(r.id) : picked.delete(r.id))); renderList(); } })), // the rows shown now (search included)
    h('th', { scope: 'col', text: t('col.code') }), h('th', { scope: 'col', text: t('col.title') }), h('th', { scope: 'col', class: 'vet-c-num', text: axisName('out') }),
    board.priority === 'out' ? null : h('th', { scope: 'col', class: 'vet-c-num', text: axisName('in') }),
    h('th', { scope: 'col', class: 'vet-c-num', text: t('col.priority') }), h('th', { scope: 'col', class: 'vet-c-act' }, h('span', { class: 'vet-sr', text: t('col.actions') })))), ui.tbody);
  ui.list.append(h('div', { class: 'vet-table-wrap' }, tbl));
  renderListBody(rows);
  if (picked.size) ui.list.append(h('div', { class: 'vet-bulk' }, h('span', { text: t('bulk.picked', { n: picked.size }) }),
    h('select', { 'aria-label': t('bulk.type'), onchange: (e) => { const v = e.target.value; if (v) change(() => board.items.forEach((x) => { if (picked.has(x.id)) x.typeId = v; })); } },
      h('option', { value: '', text: t('bulk.type') }), board.itemTypes.map((ty) => h('option', { value: ty.id, text: typeName(ty.id) }))),
    btn(t('bulk.reset'), () => change(() => { board.estimates = board.estimates.filter((e) => !picked.has(e.itemId)); })),
    btn(t('bulk.export'), () => download(C.toCSV(board, board.items.filter((x) => picked.has(x.id)), (id) => typeName(id)), C.fileName(board, 'csv'), 'text/csv')),
    btn(t('delete'), () => deleteItems([...picked]), { cls: 'vet-btn-danger' }), btn(t('bulk.clear'), () => { picked.clear(); renderList(); })));
  if (TV) ui.list.append(h('div', { class: 'vet-list-foot' }, h('button', { type: 'button', class: 'vet-link vet-small', text: t('tv.what'), onclick: aboutData })));
}

const LIST_CHUNK = 200; // NF-1: the table grows by chunks while scrolling, so 5000 rows never render at once
let listObserver = null;
function renderListBody(rows) {
  rows = rows || C.sortedItems(board, visibleItems());
  ui.tbody.replaceChildren();
  if (listObserver) { listObserver.disconnect(); listObserver = null; }
  if (!rows.length) { ui.tbody.append(h('tr', {}, h('td', { colspan: '7', class: 'vet-empty', text: board.items.length ? t('list.noMatch') : t('list.empty') }))); return; }
  let shown = 0;
  const more = () => {
    const next = rows.slice(shown, shown + LIST_CHUNK);
    shown += next.length;
    ui.tbody.querySelector('.vet-more-row')?.remove();
    listRows(next);
    if (shown < rows.length) {
      const tr = h('tr', { class: 'vet-more-row' }, h('td', { colspan: '7' }, btn(t('list.more', { n: rows.length - shown }), more, { cls: 'vet-btn-sm' })));
      ui.tbody.append(tr);
      if ('IntersectionObserver' in window) { listObserver = listObserver || new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) more(); }, { rootMargin: '600px' }); listObserver.observe(tr); }
    }
  };
  more();
}

function listRows(rows) {
  for (const it of rows) {
    const ty = C.typeById(board, it.typeId);
    const o = C.valueOf(board, it.id, 'out'), i = C.valueOf(board, it.id, 'in');
    const p = C.priorityOf(board, it);
    const num = (key, v) => { const b = C.bucketOf(board.axes[key], v); const out = v !== null && !C.inScale(board.axes[key], v);
      return h('td', { class: 'vet-c-num' + (out ? ' is-out' : ''), dataset: { col: key }, style: { color: b ? b.color : null }, title: out ? t('outOfScale') : (b ? b.label : null), text: v === null ? '—' : C.fmtNum(v, LANG, false) + (out ? ' ⇥' : '') }); };
    const tr = h('tr', { class: (selected === it.id ? 'is-selected' : '') + (it.polarity === 'anti' ? ' is-anti' : ''), dataset: { id: it.id },
      onmouseenter: () => root.querySelectorAll(`.vet-marker[data-id="${it.id}"]`).forEach((m) => m.classList.add('is-hover')),
      onmouseleave: () => root.querySelectorAll('.vet-marker.is-hover').forEach((m) => m.classList.remove('is-hover')) },
      h('td', { class: 'vet-c-pick' }, h('input', { type: 'checkbox', 'aria-label': t('pick', { code: it.code }), checked: picked.has(it.id) || null, onchange: (e) => { if (e.target.checked) picked.add(it.id); else picked.delete(it.id); renderList(); } })),
      h('td', { class: 'vet-c-code', style: { '--t': ty.color } }, h('button', { type: 'button', class: 'vet-link', text: (it.polarity === 'anti' ? '−' : '') + it.code, onclick: () => select(it.id) }),
        team && team.othersVisible && C.needsDiscussion(board, it.id) ? h('span', { class: 'vet-discuss', title: t('team.discussHint'), text: t('team.discuss') }) : null),
      h('td', { class: 'vet-c-title' }, h('span', { text: it.title }), h('small', { text: typeName(it.typeId) })),
      num('out', o), board.priority === 'out' ? null : num('in', i),
      h('td', { class: 'vet-c-num vet-c-prio', title: p.note === 'neg-in' ? t('warn.negIn') : null, text: fmtPriority(p) + (p.note ? ' *' : '') }),
      h('td', { class: 'vet-c-act' }, btn('', () => select(it.id), { icon: 'edit', title: t('edit'), cls: 'vet-btn-icon' }), team && !team.canEdit ? null : btn('', () => deleteItems([it.id]), { icon: 'trash', title: t('delete'), cls: 'vet-btn-icon' })));
    ui.tbody.append(tr);
  }
}

/** HP-3: the references on their own list, with their values; unmark or import more (HP-1). */
function refList() {
  const ro = team && !team.canEdit;
  const rows = refItems().map((it) => h('tr', {}, h('td', {}, h('button', { type: 'button', class: 'vet-link', text: '◆ ' + it.code, onclick: () => select(it.id) })),
    h('td', {}, h('span', { text: it.title }), it.refNote ? h('small', { text: it.refNote }) : null),
    h('td', { class: 'vet-c-num', text: C.fmtNum(C.valueOf(board, it.id, 'out'), LANG, false) }),
    board.priority === 'out' ? null : h('td', { class: 'vet-c-num', text: C.valueOf(board, it.id, 'in') === null ? '—' : C.fmtNum(C.valueOf(board, it.id, 'in'), LANG, false) }),
    h('td', { class: 'vet-c-act' }, ro ? null : btn(t('ref.unmark'), () => change(() => { it.isReference = false; delete it.refNote; }), { cls: 'vet-btn-sm' }))));
  return h('div', { class: 'vet-table-wrap' }, h('p', { class: 'vet-hint', text: t('ref.hint') }),
    h('table', { class: 'vet-table' }, h('thead', {}, h('tr', {}, [t('col.code'), t('col.title'), axisName('out'), board.priority === 'out' ? null : axisName('in'), ''].filter((x) => x !== null).map((x) => h('th', { text: x })))), h('tbody', {}, rows)),
    ro ? null : h('div', { class: 'vet-row' }, btn(t('ref.import'), importRefs, { icon: 'upload', cls: 'vet-btn-sm' })));
}

/** HP-1: estimated items of another board (.vet.json) come in as references (new ids, values kept). */
function importRefs() {
  const inp = h('input', { type: 'file', accept: '.json,application/json' });
  inp.addEventListener('change', async () => {
    const file = inp.files[0]; if (!file) return;
    let src;
    try { src = C.importBoard(JSON.parse(await file.text())); } catch (e) { toast(t('imp.invalid')); return; }
    const list = src.items.filter((x) => C.valueOf(src, x.id, 'out') !== null);
    if (!list.length) { toast(t('ref.noneIn')); return; }
    const taken = new Set();
    change(() => list.forEach((x) => {
      const it = C.makeItem(board, { title: x.title, code: x.code, description: x.description, typeId: board.itemTypes.some((ty) => ty.id === x.typeId) ? x.typeId : board.itemTypes[0].id, polarity: x.polarity, taken });
      taken.add(it.code); it.isReference = true; it.refNote = (src.title || file.name).slice(0, 200); board.items.push(it);
      for (const key of ['out', 'in']) { const v = C.valueOf(src, x.id, key); if (v !== null && Number.isFinite(v)) C.setEstimate(board, it.id, key, v, 'import'); }
    }));
    toast(t('ref.imported', { n: list.length }), () => undo());
  });
  inp.click();
}

/** HP-14 ... HP-17: the goals tree with counts and sums; a click filters the list and the scales. */
function goalsPanel() {
  const ro = team && !team.canEdit;
  const tree = HP.goalTree(board);
  if (!tree.length && ro) return null;
  const { stats, none } = HP.goalStats(board, board.items.filter((x) => !x.isReference), C.valueOf);
  const row = (id, label, depth, st, extra) => h('div', { class: 'vet-goal' + (filter.goal === id ? ' is-active' : ''), style: { paddingInlineStart: 8 + depth * 18 + 'px' } },
    h('button', { type: 'button', class: 'vet-link', text: label, 'aria-pressed': String(filter.goal === id), onclick: () => { filter.goal = filter.goal === id ? null : id; render(); } }),
    h('span', { class: 'vet-grow' }), h('small', { text: t('goals.stats', { n: st.count, sum: C.fmtNum(st.sumOut, LANG) }) }), extra);
  const body = h('div', { class: 'vet-goals-body' },
    tree.map(({ goal, depth }) => row(goal.id, (goal.weight ? '★'.repeat(goal.weight) + ' ' : '') + goal.title, depth, stats.get(goal.id) || { count: 0, sumOut: 0 },
      ro ? null : h('span', { class: 'vet-row' }, btn('', () => openGoal(null, goal.id), { icon: 'plus', title: t('goals.addChild'), cls: 'vet-btn-icon' }),
        btn('', () => openGoal(goal), { icon: 'edit', title: t('edit'), cls: 'vet-btn-icon' }), btn('', () => deleteGoal(goal), { icon: 'trash', title: t('delete'), cls: 'vet-btn-icon' })))),
    tree.length ? row('none', t('goals.none'), 0, none, null) : h('p', { class: 'vet-hint', text: t('goals.empty') }),
    ro ? null : h('div', { class: 'vet-row' }, btn(t('goals.add'), () => openGoal(null, null), { icon: 'plus', cls: 'vet-btn-sm' }),
      tree.length ? btn(t('goals.export'), () => download(JSON.stringify(HP.goalsDoc(board), null, 2), C.fileName(board, 'vet-goals.json'), 'application/json'), { icon: 'download', cls: 'vet-btn-sm' }) : null,
      btn(t('goals.import'), importGoals, { icon: 'upload', cls: 'vet-btn-sm' })));
  return h('details', { class: 'vet-goals', open: goalsOpen || filter.goal ? true : null, ontoggle: (e) => { goalsOpen = e.target.open; } },
    h('summary', { text: t('goals.title') + ` (${tree.length})` }), body);
}

function openGoal(goal, parentId) {
  const g = goal ? { ...goal } : { id: 'g-' + C.uuidv7().slice(-10), title: '', desiredState: '', measure: '', parentId: parentId || null, weight: 3 };
  const f = (label, input) => h('label', { class: 'vet-field' }, h('span', { text: label }), input);
  const title = h('input', { value: g.title, maxlength: '200' });
  const state = h('textarea', { rows: '2', maxlength: '1000' }); state.value = g.desiredState || '';
  const measure = h('input', { value: g.measure || '', maxlength: '500' });
  const parent = h('select', {}, h('option', { value: '', text: t('goals.root') }),
    HP.goalTree(board).filter(({ goal: x }) => x.id !== g.id && !HP.goalCycle(board, g.id, x.id)).map(({ goal: x, depth }) => h('option', { value: x.id, selected: x.id === g.parentId || null, text: '  '.repeat(depth) + x.title })));
  const weight = h('select', {}, [1, 2, 3, 4, 5].map((n) => h('option', { value: String(n), selected: n === (g.weight || 3) || null, text: '★'.repeat(n) })));
  const err = h('p', { class: 'vet-error', role: 'alert' });
  const d = dialog(goal ? t('goals.edit') : t('goals.add'), h('div', { class: 'vet-form' }, f(t('goals.name') + ' *', title), f(t('goals.state'), state), f(t('goals.measure'), measure),
    h('div', { class: 'vet-field-row' }, f(t('goals.parent'), parent), f(t('goals.weight'), weight)), h('p', { class: 'vet-hint', text: t('goals.weightHint') }), err),
  [btn(t('cancel'), () => d.closeNow()), btn(t('apply'), () => {
    const tl = title.value.trim();
    if (!tl) { err.textContent = t('err.required'); title.focus(); return; }
    Object.assign(g, { title: tl, desiredState: state.value.trim(), measure: measure.value.trim(), parentId: parent.value || null, weight: Number(weight.value) });
    change(() => {
      board.goals = board.goals || [];
      const i = board.goals.findIndex((x) => x.id === g.id);
      if (i >= 0) board.goals[i] = g; else board.goals.push(g);
      board.items.forEach((it) => { if ((it.goalIds || []).includes(g.id)) applyFormula(it); });
    }, { noScale: true });
    d.closeNow();
  }, { cls: 'vet-btn-primary' })]);
  title.focus();
}

function deleteGoal(goal) {
  confirmBox(t('goals.deleteAsk', { name: goal.title }), t('delete'), () => change(() => {
    board.goals.forEach((x) => { if (x.parentId === goal.id) x.parentId = goal.parentId || null; }); // children move up
    board.goals = board.goals.filter((x) => x.id !== goal.id);
    board.items.forEach((it) => { if (it.goalIds) it.goalIds = it.goalIds.filter((id) => id !== goal.id); });
    if (filter.goal === goal.id) filter.goal = null;
  }, { noScale: true }));
}

function importGoals() {
  const inp = h('input', { type: 'file', accept: '.json,application/json' });
  inp.addEventListener('change', async () => {
    const file = inp.files[0]; if (!file) return;
    let goals = null;
    try { goals = HP.readGoals(JSON.parse(await file.text())); } catch (e) { goals = null; }
    if (!goals) { toast(t('goals.badFile')); return; }
    change(() => { const have = new Map((board.goals || []).map((g) => [g.id, g])); goals.forEach((g) => have.set(g.id, g)); board.goals = [...have.values()]; }, { noScale: true });
    toast(t('goals.imported', { n: goals.length }), () => undo());
  });
  inp.click();
}

/** TV-4: "What data we collect", in plain words. */
function aboutData() {
  const d = dialog(t('tv.what'), h('div', { class: 'vet-form' }, ['tv.data.1', 'tv.data.2', 'tv.data.3', 'tv.data.4', 'tv.data.5'].map((k) => h('p', { text: t(k) }))), [btn(t('close'), () => d.closeNow(), { cls: 'vet-btn-primary' })]);
}

/** Delete without a dialog, with Undo in a toast for 10 s (EL-4). */
function deleteItems(ids) {
  change(() => { C.removeItems(board, ids); ids.forEach((id) => picked.delete(id)); if (ids.includes(selected)) selected = null; });
  toast(t('deleted', { n: ids.length }), () => undo(), 10000);
}

// ---------- add dialog (EL-2, EL-7) ----------

function dialog(title, body, actions, { onClose, wide } = {}) {
  const d = h('dialog', { class: 'vet-dialog' + (wide ? ' is-wide' : ''), 'aria-label': title });
  const close = () => { if (onClose && onClose() === false) return; d.close(); d.remove(); };
  d.append(h('div', { class: 'vet-dialog-head' }, h('h2', { class: 'vet-h2', text: title }), btn('', close, { icon: 'x', title: t('close') })), body, h('div', { class: 'vet-dialog-foot' }, actions));
  d.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  document.body.append(d);
  d.showModal();
  d.closeNow = () => { d.close(); d.remove(); };
  return d;
}

function confirmBox(text, yes, onYes) {
  const d = dialog(t('confirm'), h('p', { text }), [btn(t('cancel'), () => d.closeNow()), btn(yes, () => { d.closeNow(); onYes(); }, { cls: 'vet-btn-primary' })]);
}

function openAdd({ asRef = false } = {}) {
  const pending = [];
  const typeId0 = lastTypeId && board.itemTypes.some((x) => x.id === lastTypeId) ? lastTypeId : board.itemTypes[0].id;
  const err = h('p', { class: 'vet-error', role: 'alert' });
  const title = h('input', { maxlength: '200', required: true });
  const code = h('input', { maxlength: '24' });
  const desc = h('textarea', { rows: '3', maxlength: '5000' });
  const type = h('select', {}, board.itemTypes.map((ty) => h('option', { value: ty.id, selected: ty.id === typeId0 || null, text: typeName(ty.id) })));
  const pol = h('select', {}, h('option', { value: 'value', text: t('polarity.value') }), h('option', { value: 'anti', text: t('polarity.anti') }));
  pol.value = C.typeById(board, typeId0).defaultPolarity;
  type.addEventListener('change', () => { pol.value = C.typeById(board, type.value).defaultPolarity; });
  const vo = h('input', { type: 'number', step: 'any' }), vi = h('input', { type: 'number', step: 'any' });
  const chips = h('div', { class: 'vet-chips' });
  const f = (label, input) => h('label', { class: 'vet-field' }, h('span', { text: label }), input);
  [title, code].forEach((x) => x.addEventListener('input', () => { err.textContent = ''; x.classList.remove('is-error'); }));
  const taken = () => new Set(pending.map((p) => p.code).filter(Boolean));
  const take = () => {
    const tl = title.value.trim();
    const cd = code.value.trim();
    if (!tl) { title.classList.add('is-error'); err.textContent = t('err.required'); title.focus(); return null; }
    if (cd && (board.items.some((x) => String(x.code).toLowerCase() === cd.toLowerCase()) || pending.some((p) => p.code.toLowerCase() === cd.toLowerCase()))) {
      code.classList.add('is-error'); err.textContent = t('err.dupCode', { code: cd, type: typeName(type.value) }); code.focus(); return null;
    }
    const item = C.makeItem(board, { title: tl, code: cd, description: desc.value, typeId: type.value, polarity: pol.value, taken: taken() });
    return { item, out: vo.value === '' ? null : Number(vo.value), in: vi.value === '' ? null : Number(vi.value), code: item.code };
  };
  const renderChips = () => { chips.replaceChildren(...pending.map((p, i) => h('span', { class: 'vet-chip is-static' }, h('b', { text: p.item.code }), h('span', { text: p.item.title }),
    h('button', { type: 'button', class: 'vet-chip-x', 'aria-label': t('delete'), onclick: () => { pending.splice(i, 1); renderChips(); } }, svgIcon(ICON.x, 14))))); };
  const more = () => { const p = take(); if (!p) return; pending.push(p); renderChips(); title.value = ''; code.value = ''; desc.value = ''; vo.value = ''; vi.value = ''; title.focus(); };
  const commit = () => {
    if (title.value.trim() || code.value.trim()) { const p = take(); if (!p) return; pending.push(p); }
    else if (!pending.length) { title.classList.add('is-error'); err.textContent = t('err.required'); return; }
    lastTypeId = type.value;
    change(() => pending.forEach((p) => { if (asRef && p.out !== null) p.item.isReference = true; board.items.push(p.item); if (p.out !== null) setEst(p.item.id, 'out', p.out, 'input'); if (p.in !== null) setEst(p.item.id, 'in', p.in, 'input'); }));
    pending.filter((p) => p.item.polarity === 'anti').slice(0, 1).forEach((p) => ensureAnti(p.item));
    pending.length = 0; d.closeNow();
  };
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commit(); } else if (e.key === 'Enter') { e.preventDefault(); more(); } });
  const body = h('div', { class: 'vet-form' }, chips, f(t('field.title') + ' *', title), h('div', { class: 'vet-field-row' }, f(t('field.code'), code), f(t('field.type'), type), f(t('field.polarity'), pol)),
    f(t('field.description'), desc), h('div', { class: 'vet-field-row' }, f(axisName('out'), vo), board.priority === 'out' ? null : f(axisName('in'), vi)),
    asRef ? h('p', { class: 'vet-hint', text: t('ref.addHint') }) : null, h('p', { class: 'vet-hint', text: t('add.keys') }), err);
  const d = dialog(t('add', { type: typeName(typeId0).toLowerCase() }), body, [btn(t('add.more'), more, { icon: 'plus' }), btn(t('add.close'), commit, { cls: 'vet-btn-primary' })],
    { onClose: () => { if (!pending.length) return true; confirmBox(t('add.lose'), t('confirm'), () => d.closeNow()); return false; } });
  title.focus();
}

// ---------- paste list (EL-3) ----------

function openPaste() {
  const ta = h('textarea', { rows: '8', class: 'vet-paste', placeholder: t('paste.hint') });
  const preview = h('div', { class: 'vet-preview' });
  const type = h('select', {}, board.itemTypes.map((ty) => h('option', { value: ty.id, text: typeName(ty.id) })));
  let rows = [];
  const show = () => {
    rows = C.parsePaste(ta.value);
    const codes = new Set(board.items.map((x) => String(x.code).toLowerCase()));
    rows.forEach((r) => { if (r.code && codes.has(r.code.toLowerCase())) r.errors.push('dup'); if (r.code) codes.add(r.code.toLowerCase()); });
    preview.replaceChildren(rows.length ? h('table', { class: 'vet-table is-small' }, h('thead', {}, h('tr', {}, ['#', t('col.code'), t('col.title'), axisName('out'), axisName('in'), ''].map((x) => h('th', { text: x })))),
      h('tbody', {}, rows.slice(0, 50).map((r) => h('tr', { class: r.errors.length ? 'is-error' : '' }, h('td', { text: r.line }), h('td', { text: r.code || '…' }), h('td', { text: r.title }),
        h('td', { text: r.out ?? '' }), h('td', { text: r.in ?? '' }), h('td', { text: r.errors.map((e) => t('err.' + e)).join(', ') }))))) : '');
    ok.disabled = !rows.some((r) => !r.errors.length);
    ok.querySelector('span').textContent = t('paste.add', { n: rows.filter((r) => !r.errors.length).length });
  };
  ta.addEventListener('input', show);
  const ok = btn(t('paste.add', { n: 0 }), () => {
    const good = rows.filter((r) => !r.errors.length);
    const taken = new Set();
    change(() => good.forEach((r) => {
      const it = C.makeItem(board, { title: r.title, code: r.code, typeId: type.value, taken }); taken.add(it.code); board.items.push(it);
      if (r.out !== null) setEst(it.id, 'out', r.out, 'import'); if (r.in !== null) setEst(it.id, 'in', r.in, 'import');
    }));
    d.closeNow(); toast(t('paste.done', { n: good.length }), () => undo());
  }, { cls: 'vet-btn-primary', disabled: true });
  const example = btn(t('paste.exampleBtn'), () => { ta.value = t('paste.example'); show(); ta.focus(); });
  const d = dialog(t('paste.open'), h('div', { class: 'vet-form' }, h('p', { class: 'vet-hint', text: t('paste.format') }), ta, h('label', { class: 'vet-field' }, h('span', { text: t('field.type') }), type), preview), [example, h('span', { class: 'vet-grow' }), btn(t('cancel'), () => d.closeNow()), ok], { wide: true });
  ta.focus();
}

// ---------- sequence mode (UI-2) ----------

function openFlow(axisKey, startId) {
  if (TV) TV.note('flow');
  let key = axisKey && axisKey !== '2d' ? axisKey : 'out';
  let current = null;
  const box = h('div', { class: 'vet-flow' });
  const next = () => {
    const queue = board.items.filter((it) => !it.isReference && myPos(it.id, key) === null);
    current = (startId && queue.find((x) => x.id === startId)) || queue[0] || null; startId = null;
    draw(queue.length);
  };
  const setVal = (v) => { if (!current) return; const it = current; change(() => setEst(it.id, key, clampFor(it, key, v), 'input')); next(); };
  const draw = (left) => {
    box.replaceChildren();
    const tabs = h('div', { class: 'vet-seg' }, ['out', 'in'].filter((k) => k === 'out' || board.priority !== 'out').map((k) => btn(axisName(k), () => { key = k; next(); }, { pressed: k === key })));
    if (!current) { box.append(tabs, h('p', { class: 'vet-flow-done', text: t('flow.done') })); return; }
    const axis = board.axes[key];
    const s = axis.scale;
    const strip = h('div', { class: 'vet-flow-scale' });
    axis.buckets.forEach((b, i) => strip.append(h('button', { type: 'button', class: 'vet-flow-bucket ink-' + inkOn(b.color) + (b.polarity === 'anti' ? ' is-anti' : ''), style: { '--c': b.color, flexGrow: String(b.to - b.from + s.step) },
      onclick: (e) => { if (board.settings.bucketsOnly || e.detail === 0) { setVal(C.bucketMiddle(axis, b)); return; } /* e.detail 0 = Enter or Space: no pointer position */ const r = e.currentTarget.getBoundingClientRect(); setVal(b.from + ((e.clientX - r.left) / r.width) * (b.to - b.from + s.step) - s.step / 2); } },
    h('b', { text: String(i + 1) }), h('span', { text: b.label }), h('small', { text: board.settings.bucketsOnly ? '' : `${C.fmtNum(b.from, LANG)}…${C.fmtNum(b.to, LANG)}` }))));
    box.append(tabs, h('p', { class: 'vet-hint', text: t('flow.left', { n: left }) }),
      h('div', { class: 'vet-flow-item' }, h('span', { class: 'vet-flow-code', text: (current.polarity === 'anti' ? '−' : '') + current.code }), h('strong', { text: current.title }), current.description ? h('p', { text: current.description }) : null),
      h('p', { class: 'vet-flow-q', text: t('flow.question', { axis: axisName(key) }) }), strip,
      h('div', { class: 'vet-row' }, btn(t('flow.skip'), () => { const q = board.items.filter((it) => myPos(it.id, key) === null); const i = q.indexOf(current); current = q[i + 1] || q[0]; draw(q.length); }), h('span', { class: 'vet-hint', text: t('flow.keys') })));
  };
  const onKey = (e) => {
    if (!current) return;
    const n = Number(e.key);
    const axis = board.axes[key];
    if (n >= 1 && n <= 9 && axis.buckets[n - 1]) { e.preventDefault(); setVal(C.bucketMiddle(axis, axis.buckets[n - 1])); }
  };
  const d = dialog(t('flow.start'), box, [btn(t('close'), () => d.closeNow())], { wide: true, onClose: () => { document.removeEventListener('keydown', onKey); return true; } });
  d.addEventListener('close', () => document.removeEventListener('keydown', onKey));
  document.addEventListener('keydown', onKey);
  next();
}

// ---------- settings ----------

function openSettings() {
  const draft = JSON.parse(JSON.stringify(board));
  const tabs = ['scales', 'types', 'calc', 'team']; // UX review: six tabs became four
  const PARTS = { scales: ['axes', 'buckets'], types: ['types'], calc: ['priority', 'helpers'], team: ['team'] };
  let tab = 'scales';
  const body = h('div', { class: 'vet-settings' });
  const tabBar = h('div', { class: 'vet-tabs', role: 'tablist' });
  const pane = h('div', { class: 'vet-tab-pane', role: 'tabpanel' });
  const drawTabs = () => tabBar.replaceChildren(...tabs.map((k) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(k === tab), text: t('set.' + k), onclick: () => { tab = k; drawTabs(); drawPane(); } })));
  const f = (label, input, hint) => h('label', { class: 'vet-field' }, h('span', { text: label }), input, hint ? h('small', { text: hint }) : null);
  const name = (ax, key) => (ax.label || {})[LOC] || (ax.label || {})[draft.lang] || Object.values(ax.label || {})[0] || t('axis.' + key);
  const drawPane = () => {
    pane.replaceChildren();
    const parts = PARTS[tab];
    for (const part of parts) { if (parts.length > 1) pane.append(h('h3', { class: 'vet-set-h', text: t('set.' + part) })); drawPart(part); }
  };
  const drawPart = (tab) => {
    if (tab === 'axes') {
      pane.append(h('div', { class: 'vet-row vet-presets' }, h('span', { text: t('set.presets') }), ['effortMoney', 'valueEffort', 'moneyMoney', 'riskBenefit', 'base'].map((p) => btn(t('preset.' + p), () => {
        const keep = board; board = draft; preset(p); board = keep;
        if (p === 'moneyMoney' && draft.priority !== 'difference') confirmBox(t('preset.suggestDiff'), t('set.priority.difference'), () => { draft.priority = 'difference'; });
        drawPane();
      }, { cls: 'vet-btn-sm' }))));
      for (const key of ['out', 'in']) {
        const ax = draft.axes[key], s = ax.scale;
        const lbl = h('input', { value: name(ax, key), maxlength: '60', onchange: (e) => { ax.label = { ...ax.label, [LOC]: e.target.value.trim() }; if (!e.target.value.trim()) delete ax.label[LOC]; } });
        const unit = h('input', { value: ax.unit || '', maxlength: '20', placeholder: t('set.unitHint'), onchange: (e) => { ax.unit = e.target.value.trim(); } });
        const numF = (prop, obj = s) => h('input', { type: 'number', value: String(obj[prop]), step: 'any', onchange: (e) => { obj[prop] = Number(e.target.value); } });
        const step = h('select', { onchange: (e) => { s.step = Number(e.target.value); } }, C.STEPS.map((x) => h('option', { value: String(x), selected: x === s.step || null, text: C.fmtNum(x, LANG, false) })));
        const anti = h('input', { type: 'checkbox', checked: s.min < 0 || null, onchange: (e) => { s.min = e.target.checked ? -Math.max(s.step, C.roundTo(s.max / 2, s.step)) : (s.min < 0 ? 1 : s.min); drawPane(); } });
        const a = ax.autoscale;
        pane.append(h('fieldset', { class: 'vet-fieldset' }, h('legend', { text: t('axis.' + key) + ' (' + key + ')' }),
          h('div', { class: 'vet-field-row' }, f(t('set.axisName'), lbl), f(t('set.unit'), unit)),
          h('div', { class: 'vet-field-row' }, f(t('set.min'), numF('min')), f(t('set.max'), numF('max')), f(t('set.step'), step)),
          h('label', { class: 'vet-check' }, anti, h('span', { text: t('set.anti') })),
          h('div', { class: 'vet-field-row' },
            h('label', { class: 'vet-check' }, h('input', { type: 'checkbox', checked: (a.shrink && !a.manual) || null, onchange: (e) => { a.shrink = e.target.checked; a.manual = false; } }), h('span', { text: t('set.autoShrink') })),
            f(t('set.fillLow'), h('input', { type: 'number', min: '10', max: '95', value: String(Math.round(a.low * 100)), onchange: (e) => { a.low = Number(e.target.value) / 100; } })),
            f(t('set.fillTarget'), h('input', { type: 'number', min: '20', max: '100', value: String(Math.round(a.target * 100)), onchange: (e) => { a.target = Number(e.target.value) / 100; } })),
            f(t('set.minLength'), numF('minLength', a)))));
      }
    } else if (tab === 'buckets') {
      pane.append(h('label', { class: 'vet-check' }, h('input', { type: 'checkbox', checked: draft.settings.bucketsOnly || null, onchange: (e) => { draft.settings.bucketsOnly = e.target.checked; } }), h('span', { text: t('set.bucketsOnly') })));
      for (const key of ['out', 'in']) {
        const ax = draft.axes[key];
        const rows = ax.buckets.map((b, i) => h('tr', {},
          h('td', {}, h('input', { value: b.label, maxlength: '24', 'aria-label': t('set.bucketName'), onchange: (e) => { b.label = e.target.value.trim() || b.label; ax.bucketsEdited = true; } })),
          h('td', {}, h('select', { 'aria-label': t('set.color'), style: { background: b.color }, onchange: (e) => { b.color = e.target.value; e.target.style.background = b.color; ax.bucketsEdited = true; } },
            C.PALETTE.map((c) => h('option', { value: c, selected: c === b.color || null, style: { background: c }, text: c })))),
          h('td', {}, h('input', { type: 'number', step: 'any', value: String(b.from), 'aria-label': t('set.from'), onchange: (e) => { b.from = Number(e.target.value); ax.bucketsEdited = true; } })),
          h('td', {}, h('input', { type: 'number', step: 'any', value: String(b.to), 'aria-label': t('set.to'), onchange: (e) => { b.to = Number(e.target.value); ax.bucketsEdited = true; } })),
          h('td', { text: b.polarity === 'anti' ? t('polarity.anti') : t('polarity.value') }),
          h('td', {}, btn('', () => { if (ax.buckets.filter((x) => x.polarity === b.polarity).length > 1) { ax.buckets.splice(i, 1); ax.bucketsEdited = true; ax.buckets = C.normalizeBuckets(ax, ax.buckets); drawPane(); } }, { icon: 'trash', title: t('delete'), cls: 'vet-btn-icon' }))));
        pane.append(h('fieldset', { class: 'vet-fieldset' }, h('legend', { text: name(ax, key) }),
          h('table', { class: 'vet-table is-small' }, h('thead', {}, h('tr', {}, [t('set.bucketName'), t('set.color'), t('set.from'), t('set.to'), '', ''].map((x) => h('th', { text: x })))), h('tbody', {}, rows)),
          h('div', { class: 'vet-row' },
            btn(t('set.addBucket'), () => { const pos = ax.buckets.filter((x) => x.polarity !== 'anti'); if (pos.length >= 10) return; const last = pos[pos.length - 1]; const mid = C.roundTo((last.from + last.to) / 2, ax.scale.step);
              if (mid <= last.from) return; ax.buckets.push({ id: 'b' + Date.now().toString(36), label: 'NEW', from: C.roundTo(mid + ax.scale.step, ax.scale.step), to: last.to, color: C.PALETTE[(pos.length) % C.PALETTE.length], polarity: 'value' }); last.to = mid; ax.bucketsEdited = true; drawPane(); }, { cls: 'vet-btn-sm' }),
            btn(t('set.resetBuckets'), () => { ax.buckets = C.defaultBuckets(ax.scale); ax.bucketsEdited = false; drawPane(); }, { cls: 'vet-btn-sm' }))));
      }
    } else if (tab === 'types') {
      const rows = draft.itemTypes.map((ty, i) => {
        const nm = (ty.name || {})[LOC] || (ty.lib ? t('type.' + ty.lib) : '');
        const pl = (ty.pluralName || {})[LOC] || (ty.lib ? t('typeMany.' + ty.lib) : '');
        return h('tr', {},
          h('td', {}, h('input', { value: nm, maxlength: '40', 'aria-label': t('set.typeName'), onchange: (e) => { ty.name = { ...ty.name, [LOC]: e.target.value.trim() }; } })),
          h('td', {}, h('input', { value: pl, maxlength: '40', 'aria-label': t('set.typePlural'), onchange: (e) => { ty.pluralName = { ...ty.pluralName, [LOC]: e.target.value.trim() }; } })),
          h('td', {}, h('input', { value: ty.prefix, maxlength: '8', 'aria-label': t('set.prefix'), onchange: (e) => { ty.prefix = e.target.value.trim().toUpperCase() || ty.prefix; } })),
          h('td', {}, h('select', { 'aria-label': t('set.color'), style: { background: ty.color }, onchange: (e) => { ty.color = e.target.value; e.target.style.background = ty.color; } }, C.PALETTE.map((c) => h('option', { value: c, selected: c === ty.color || null, style: { background: c }, text: c })))),
          h('td', {}, h('select', { 'aria-label': t('field.polarity'), onchange: (e) => { ty.defaultPolarity = e.target.value; } }, h('option', { value: 'value', selected: ty.defaultPolarity === 'value' || null, text: t('polarity.value') }), h('option', { value: 'anti', selected: ty.defaultPolarity === 'anti' || null, text: t('polarity.anti') }))),
          h('td', {}, btn('', () => deleteType(draft, i, drawPane), { icon: 'trash', title: t('delete'), cls: 'vet-btn-icon', disabled: draft.itemTypes.length < 2 })));
      });
      const lib = h('select', { 'aria-label': t('set.library') }, h('option', { value: '', text: t('set.library') }), C.TYPE_LIBRARY.map((x) => h('option', { value: x.key, text: t('type.' + x.key) })));
      pane.append(h('table', { class: 'vet-table is-small' }, h('thead', {}, h('tr', {}, [t('set.typeName'), t('set.typePlural'), t('set.prefix'), t('set.color'), t('field.polarity'), ''].map((x) => h('th', { text: x })))), h('tbody', {}, rows)),
        h('div', { class: 'vet-row' }, lib, btn(t('set.addType'), () => {
          const x = C.TYPE_LIBRARY.find((l) => l.key === lib.value);
          draft.itemTypes.push(x ? { id: 't-' + x.key + '-' + Date.now().toString(36), name: {}, pluralName: {}, prefix: x.prefix, color: x.color, icon: x.icon, defaultPolarity: x.polarity, lib: x.key }
            : { id: 't-' + Date.now().toString(36), name: { [LOC]: t('set.newType') }, pluralName: { [LOC]: t('set.newTypes') }, prefix: 'EL', color: C.PALETTE[draft.itemTypes.length % C.PALETTE.length], icon: 'dot', defaultPolarity: 'value' });
          drawPane();
        }, { icon: 'plus', cls: 'vet-btn-sm' })));
    } else if (tab === 'priority') {
      for (const k of ['ratio', 'difference', 'out']) pane.append(h('label', { class: 'vet-radio' }, h('input', { type: 'radio', name: 'vet-prio', value: k, checked: draft.priority === k || null, onchange: () => { draft.priority = k; } }),
        h('span', {}, h('strong', { text: t('set.priority.' + k) }), h('small', { text: t('set.priority.' + k + 'Hint') }))));
    } else if (tab === 'helpers') {
      helperSettings(draft, pane, drawPane);
    } else {
      if (SHARE || team) pane.append(h('p', { text: t(team ? 'set.teamOn' : 'set.teamOff') }), team ? btn(t('share'), () => { openShare(); }, { icon: 'share', cls: 'vet-btn-primary' }) : btn(t('share'), () => shareSolo(), { icon: 'share', cls: 'vet-btn-primary' }));
    }
  };
  drawTabs(); drawPane();
  body.append(tabBar, pane);
  const d = dialog(t('settings'), body, [btn(t('cancel'), () => d.closeNow()), btn(t('apply'), () => {
    // validate scales (AX-5) and report estimates that leave them (AX-7)
    for (const key of ['out', 'in']) {
      const s = draft.axes[key].scale, o = board.axes[key].scale;
      if (!(s.max > s.min) || !Number.isFinite(s.min) || !Number.isFinite(s.max) || Math.abs(s.max) > C.MAX_ABS || Math.abs(s.min) > C.MAX_ABS) { toast(t('err.scale')); return; }
      const touched = s.min !== o.min || s.max !== o.max || s.step !== o.step;
      if (touched && (s.max - s.min) / s.step > 200) { toast(t('err.divisions')); return; }
    }
    const outside = draft.estimates.filter((e) => !C.inScale(draft.axes[e.axis], e.value)).length;
    const apply = (rescale) => change(() => {
      for (const key of ['out', 'in']) {
        const ax = draft.axes[key], old = board.axes[key].scale;
        if (old.min !== ax.scale.min || old.max !== ax.scale.max) { if (!ax.bucketsEdited) ax.buckets = C.defaultBuckets(ax.scale); ax.autoscale.manual = true; }
        if (rescale) draft.estimates.filter((e) => e.axis === key).forEach((e) => { e.value = C.roundTo(ax.scale.min + ((e.value - old.min) / (old.max - old.min)) * (ax.scale.max - ax.scale.min), ax.scale.step); });
        ax.buckets = C.normalizeBuckets(ax, ax.buckets);
      }
      board = draft;
      C.touchEstimates(); // values were rescaled in place above
      board.items.forEach((it) => applyFormula(it)); // new or changed formulas move the items that were not set by hand
    }, { noScale: true });
    d.closeNow();
    if (outside) {
      const d2 = dialog(t('set.outsideTitle'), h('p', { text: t('set.outside', { n: outside }) }), [btn(t('set.keep'), () => { d2.closeNow(); apply(false); }), btn(t('set.rescale'), () => { d2.closeNow(); apply(true); }, { cls: 'vet-btn-primary' })]);
    } else apply(false);
  }, { cls: 'vet-btn-primary' })], { wide: true });
}

/** Settings tab "Metrics and formulas" (HP-6 ... HP-10): templates, the metric list, a formula per axis with a check and a sample. */
function helperSettings(draft, pane, redraw) {
  draft.metrics = draft.metrics || []; draft.formulas = draft.formulas || [];
  const f = (label, input, hint) => h('label', { class: 'vet-field' }, h('span', { text: label }), input, hint ? h('small', { text: hint }) : null);
  pane.append(h('p', { class: 'vet-hint', text: t('hp.intro') }),
    h('div', { class: 'vet-row vet-presets' }, h('span', { text: t('hp.templates') }), Object.keys(HP.FORMULA_TEMPLATES).map((k) => btn(t('hp.tpl.' + k), () => {
      const tp = structuredClone(HP.FORMULA_TEMPLATES[k]);
      const have = new Set(draft.metrics.map((m) => m.key));
      tp.metrics.forEach((m) => { if (!have.has(m.key)) draft.metrics.push(m); });
      draft.formulas = tp.formulas;
      redraw();
    }, { cls: 'vet-btn-sm' }))));
  const rows = draft.metrics.map((m, i) => h('tr', {},
    h('td', {}, h('input', { value: m.key, maxlength: '24', 'aria-label': t('hp.key'), onchange: (e) => { const v = e.target.value.trim().replace(/[^\p{L}\p{N}_]/gu, '_'); if (/^[\p{L}_]/u.test(v)) m.key = v; else e.target.value = m.key; } })),
    h('td', {}, h('input', { value: metricName(m) === m.key ? '' : metricName(m), maxlength: '60', 'aria-label': t('hp.name'), onchange: (e) => { m.name = { ...(m.name || {}), [LOC]: e.target.value.trim() }; } })),
    h('td', {}, h('input', { value: m.unit || '', maxlength: '20', 'aria-label': t('set.unit'), onchange: (e) => { m.unit = e.target.value.trim(); } })),
    h('td', {}, btn('', () => { draft.metrics.splice(i, 1); redraw(); }, { icon: 'trash', title: t('delete'), cls: 'vet-btn-icon' }))));
  pane.append(h('fieldset', { class: 'vet-fieldset' }, h('legend', { text: t('hp.metrics') }),
    rows.length ? h('table', { class: 'vet-table is-small' }, h('thead', {}, h('tr', {}, [t('hp.key'), t('hp.name'), t('set.unit'), ''].map((x) => h('th', { text: x })))), h('tbody', {}, rows)) : h('p', { class: 'vet-hint', text: t('hp.noMetrics') }),
    h('div', { class: 'vet-row' }, btn(t('hp.addMetric'), () => { let n = draft.metrics.length + 1; while (draft.metrics.some((m) => m.key === 'm' + n)) n++; draft.metrics.push({ key: 'm' + n, name: {}, unit: '' }); redraw(); }, { icon: 'plus', cls: 'vet-btn-sm' }))));
  for (const key of ['out', 'in']) {
    if (key === 'in' && draft.priority === 'out') continue;
    let fm = draft.formulas.find((x) => x.axis === key);
    if (!fm) { fm = { axis: key, expr: '', map: { kind: 'direct' } }; draft.formulas.push(fm); }
    fm.map = fm.map || { kind: 'direct' };
    const check = h('p', { class: 'vet-small', 'aria-live': 'polite' });
    const show = () => { // HP-7: errors with the position, unknown names, a sample with every metric = 1
      check.className = 'vet-small';
      if (!fm.expr.trim()) { check.textContent = t('hp.noFormula'); return; }
      try {
        const ast = HP.parseFormula(fm.expr);
        const known = new Set([...draft.metrics.map((m) => m.key), 'goalWeight']);
        const unknown = [...HP.formulaVars(ast)].filter((v) => !known.has(v));
        if (unknown.length) { check.className = 'vet-error'; check.textContent = t('hp.unknown', { names: unknown.join(', ') }); return; }
        const vars = Object.fromEntries([...known].map((k) => [k, 1]));
        const raw = HP.evalFormula(ast, vars);
        check.textContent = t('hp.sample', { raw: raw === null ? '—' : C.fmtNum(raw, LANG, false), v: raw === null ? '—' : C.fmtNum(HP.mapToScale(raw, draft.axes[key], fm.map), LANG, false) });
      } catch (e) { check.className = 'vet-error'; check.textContent = t('hp.err.' + (e.code || 'char'), { pos: (e.pos ?? 0) + 1 }); }
    };
    const expr = h('input', { value: fm.expr, maxlength: '300', spellcheck: 'false', class: 'vet-mono', placeholder: 'reach * impact * confidence', oninput: (e) => { fm.expr = e.target.value; show(); } });
    const kind = h('select', { onchange: (e) => { fm.map.kind = e.target.value; redraw(); } }, ['direct', 'linear', 'log'].map((k) => h('option', { value: k, selected: fm.map.kind === k || null, text: t('hp.map.' + k) })));
    const num = (prop) => h('input', { type: 'number', step: 'any', value: fm.map[prop] ?? '', onchange: (e) => { fm.map[prop] = e.target.value === '' ? undefined : Number(e.target.value); show(); } });
    pane.append(h('fieldset', { class: 'vet-fieldset' }, h('legend', { text: t('hp.formulaFor', { axis: (draft.axes[key].label || {})[LOC] || axisName(key) }) }),
      f(t('hp.expr'), expr, t('hp.exprHint')), check,
      h('div', { class: 'vet-field-row' }, f(t('hp.map'), kind), fm.map.kind === 'direct' ? null : f(t('hp.lo'), num('lo')), fm.map.kind === 'direct' ? null : f(t('hp.hi'), num('hi')))));
    show();
  }
}

/** IT-3: a type with items is deleted only after moving or deleting its items; the last type stays. */
function deleteType(draft, i, redraw) {
  const ty = draft.itemTypes[i];
  if (draft.itemTypes.length < 2) return;
  const items = draft.items.filter((x) => x.typeId === ty.id);
  if (!items.length) { draft.itemTypes.splice(i, 1); redraw(); return; }
  const other = draft.itemTypes.find((x) => x.id !== ty.id);
  const d = dialog(t('type.deleteTitle'), h('p', { text: t('type.deleteAsk', { n: items.length }) }), [
    btn(t('cancel'), () => d.closeNow()),
    btn(t('type.moveTo', { name: (other.name || {})[LOC] || (other.lib ? t('type.' + other.lib) : other.prefix) }), () => { items.forEach((x) => { x.typeId = other.id; }); draft.itemTypes.splice(i, 1); d.closeNow(); redraw(); }),
    btn(t('type.deleteWith'), () => { const ids = new Set(items.map((x) => x.id)); draft.items = draft.items.filter((x) => !ids.has(x.id)); draft.estimates = draft.estimates.filter((e) => !ids.has(e.itemId)); draft.itemTypes.splice(i, 1); d.closeNow(); redraw(); }, { cls: 'vet-btn-danger' })]);
}

// ---------- export and import (section 8) ----------

function download(text, name, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime + ';charset=utf-8' }));
  const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  dirty = false;
}

const XLSX = () => import(new URL('../../assets/aevri-xlsx.js?v=' + V, import.meta.url).href); // lazy (NF-3)
const SCHEMA = () => import(new URL('../../assets/aevri-schema.js?v=' + V, import.meta.url).href);
const PICTURE = () => import('./vet-picture.js?v=' + V);

/** Human-readable "Settings" sheet (IO-11): a table for people, then the full configuration JSON for the restore. */
function settingsRows(cfg) {
  const rows = [[t('xl.setting'), t('xl.value')]];
  for (const key of ['out', 'in']) {
    const a = board.axes[key];
    rows.push([axisName(key), a.unit || ''],
      [axisName(key) + ' · ' + t('xl.scale'), `${C.fmtNum(a.scale.min, LANG, false)} … ${C.fmtNum(a.scale.max, LANG, false)}, ${t('set.step').toLowerCase()} ${C.fmtNum(a.scale.step, LANG, false)}`],
      [axisName(key) + ' · ' + t('set.buckets'), a.buckets.map((b) => `${b.label} ${C.fmtNum(b.from, LANG, false)}…${C.fmtNum(b.to, LANG, false)}`).join('; ')]);
  }
  rows.push([t('set.priority'), t('set.priority.' + board.priority)], [t('set.types'), board.itemTypes.map((x) => typeName(x.id)).join('; ')], [], [t('xl.json'), ''],
    [C.CONFIG_CELL, ...C.configCells(cfg)]);
  return rows;
}

async function exportFile(scope, list, goals) {
  if (scope === 'board') return download(JSON.stringify(board, null, 2), C.fileName(board, 'vet.json'), 'application/json');
  if (scope === 'config') return download(JSON.stringify(C.configOf(board, goals), null, 2), C.fileName(board, 'vet-config.json'), 'application/json');
  if (scope === 'items') return download(JSON.stringify(C.itemsDoc(board, list), null, 2), C.fileName(board, 'vet-items.json'), 'application/json');
  if (scope === 'xlsx') { // FMT-xlsx: Elements, Participant estimates, Goals, Settings
    const { writeXlsx } = await XLSX();
    const sheets = [{ name: t('xl.elements'), rows: C.itemRows(board, list, (id) => typeName(id)) }, { name: t('xl.estimates'), rows: C.estimateRows(board, list) }];
    if (goals) sheets.push({ name: t('xl.goals'), rows: C.goalRows(board) });
    sheets.push({ name: t('xl.settings'), rows: settingsRows(C.configOf(board, goals)), widths: [34, 90] });
    return download(writeXlsx(sheets), C.fileName(board, 'xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  if (scope === 'svg' || scope === 'png') { // FMT-png: the current 1D / 2D view
    const P = await PICTURE();
    const svg = P.boardSvg(board, { C, view: board.view, axisName, typeColor: (id) => C.typeById(board, id).color, lang: LANG, title: board.title || t('board.untitled'), xKey: xKey(), yKey: yKey(), items: list });
    if (scope === 'svg') return download(svg, C.fileName(board, 'svg'), 'image/svg+xml');
    return download(await P.svgToPng(svg, 2), C.fileName(board, 'png'), 'image/png');
  }
  return download(C.toCSV(board, list, (id) => typeName(id), scope === 'csvx'), C.fileName(board, 'csv'), 'text/csv');
}

function openExport() {
  let scope = 'board', only = false, goals = true;
  const items = () => C.sortedItems(board, only ? visibleItems() : board.items.filter((x) => !x.isReference));
  const opt = (k, label, hint) => h('label', { class: 'vet-radio' }, h('input', { type: 'radio', name: 'vet-exp', value: k, checked: scope === k || null, onchange: () => { scope = k; } }), h('span', {}, h('strong', { text: label }), h('small', { text: hint })));
  const body = h('div', { class: 'vet-form' },
    opt('board', t('exp.board'), '.vet.json'), opt('config', t('exp.config'), '.vet-config.json'), opt('items', t('exp.items'), '.vet-items.json'),
    opt('xlsx', 'Excel (.xlsx)', t('exp.xlsx')), opt('csv', 'CSV', t('exp.csv')), opt('csvx', t('exp.csvExcel'), t('exp.csvExcelHint')),
    opt('png', 'PNG', t('exp.picture')), opt('svg', 'SVG', t('exp.picture')),
    h('label', { class: 'vet-check' }, h('input', { type: 'checkbox', onchange: (e) => { only = e.target.checked; } }), h('span', { text: t('exp.onlyShown') })),
    h('label', { class: 'vet-check' }, h('input', { type: 'checkbox', checked: true, onchange: (e) => { goals = e.target.checked; } }), h('span', { text: t('exp.withGoals') })));
  const d = dialog(t('export'), body, [btn(t('cancel'), () => d.closeNow()), btn(t('export'), async () => {
    try { await exportFile(scope, items(), goals); d.closeNow(); if (TV) TV.note('export'); } catch (e) { toast(t('exp.failed')); }
  }, { icon: 'download', cls: 'vet-btn-primary' })]);
}

/** The lines of a configuration change summary (IO-12). */
function diffLines(cfg) {
  const ds = C.configDiff(board, cfg);
  if (!ds.length) return [h('li', { text: t('cfg.d.none') })];
  return ds.map((x) => h('li', { text: t('cfg.d.' + x.key, { axis: x.axis ? axisName(x.axis) : '', n: x.n ?? 0, added: x.added ?? 0, removed: x.removed ?? 0 }) }));
}

function openImport() {
  const file = h('input', { type: 'file', accept: '.json,.csv,.tsv,.txt,.xlsx,application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const info = h('div', { class: 'vet-preview' });
  let handler = null;
  const ok = btn(t('import'), () => { if (handler) handler(); }, { cls: 'vet-btn-primary', disabled: true });
  const fail = (key, extra) => info.append(h('p', { class: 'vet-error', text: t(key) + (extra ? ' ' + extra : '') }));
  file.addEventListener('change', async () => {
    info.replaceChildren(); ok.disabled = true; handler = null;
    const f = file.files[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { fail('imp.tooBig'); return; } // IO-8
    let doc = null, grid = null, xlCfg = null;
    if (/\.xlsx$/i.test(f.name)) { // IO-9 (the reference tool), IO-11 (our own file with the Settings sheet)
      let sheets;
      try { sheets = await (await XLSX()).readXlsx(await f.arrayBuffer()); } catch (e) { fail('imp.badXlsx'); return; }
      for (const s of sheets) xlCfg = xlCfg || C.configFromRows(s.rows);
      const list = sheets.find((s) => { const head = s.rows.find((r) => r.length) || []; const m = C.autoMap(head); return m.title !== undefined || m.code !== undefined; });
      grid = list ? list.rows : (sheets[0] ? sheets[0].rows : []);
      if (xlCfg && (!list || list.rows.length < 2)) doc = xlCfg; // only settings: the configuration branch
    } else {
      const text = await f.text();
      if (/\.json$/i.test(f.name) || text.trim().startsWith('{')) { try { doc = JSON.parse(text); } catch (e) { fail('imp.invalid'); return; } }
      else grid = text;
    }
    if (doc && doc.kind === 'vet-config') {
      let mode = 'apply';
      info.append(h('p', { text: t('imp.config') }), h('p', { class: 'vet-small', text: t('cfg.d.title') }), h('ul', { class: 'vet-diff' }, diffLines(doc)),
        h('label', { class: 'vet-radio' }, h('input', { type: 'radio', name: 'vet-cfg', checked: true, onchange: () => { mode = 'apply'; } }), h('span', { text: t('imp.applyCurrent') })),
        h('label', { class: 'vet-radio' }, h('input', { type: 'radio', name: 'vet-cfg', onchange: () => { mode = 'new'; } }), h('span', { text: t('imp.newFromConfig') })));
      handler = () => {
        try {
          if (mode === 'apply') change(() => C.applyConfig(board, structuredClone(doc)));
          else change(() => { const b = C.newBoard(board.title); C.applyConfig(b, structuredClone(doc)); board = b; selected = null; picked.clear(); });
          d.closeNow(); toast(t('imp.done'), () => undo());
        } catch (e) { fail(e.message === 'newer' ? 'imp.newer' : 'imp.invalid'); }
      };
      ok.disabled = false;
      return;
    }
    if (doc && doc.kind !== 'vet-items' && Array.isArray(doc.items) && doc.axes) {
      const [maj] = String(doc.schemaVersion || '0').split('.').map(Number);
      if (maj === 1) { // IO-3: the file is checked against contracts/board.schema.json before anything changes
        const S = await SCHEMA(); const schema = await S.loadSchema('board.schema.json');
        const errs = schema ? S.validate(schema, doc, { limit: 5 }) : [];
        if (errs.length) { fail('imp.schema'); info.append(h('ul', { class: 'vet-diff' }, errs.map((e) => h('li', { text: `${e.path} - ${e.rule}` })))); return; }
      }
      info.append(h('p', { text: t('imp.board', { n: doc.items.length }) }));
      handler = () => {
        try { const b = C.importBoard(doc); change(() => { board = b; selected = null; picked.clear(); }); d.closeNow(); toast(t('imp.done'), () => undo()); }
        catch (e) { fail(e.message === 'newer' ? 'imp.newer' : 'imp.invalid'); }
      };
      ok.disabled = false;
      return;
    }
    // a list: .vet-items.json, CSV / TSV or a spreadsheet (IO-4 ... IO-9)
    if (doc && Array.isArray(doc.items)) {
      const rows = doc.items.map((it, n) => ({ code: it.code || '', title: it.title || it.code || '', description: it.description || '', type: '', typeId: it.typeId, polarity: it.polarity || '', out: it.out ?? null, in: it.in ?? null, tags: it.tags || [], externalId: it.externalId || '', line: n + 1, errors: it.title || it.code ? [] : ['title'] }));
      listStep(rows, null, null);
    } else if (grid !== null) {
      const cells = typeof grid === 'string' ? null : grid;
      listStep(null, cells, typeof grid === 'string' ? grid : null);
    } else fail('imp.invalid');
    function listStep(fixedRows, cells, text) {
      let map = null, mapOpen = false; // null = automatic (IO-4)
      const parse = () => (fixedRows ? { rows: fixedRows, header: [], map: {} } : cells ? C.parseGrid(cells, map) : C.parseTable(text, map));
      let applyCfg = !!xlCfg;
      const typeChoice = new Map(); // unknown type name -> existing type id or '' (create new)
      const draw = () => {
        info.replaceChildren(); ok.disabled = true;
        const p = parse();
        if (!map) map = { ...p.map };
        if (!fixedRows && p.header.length) { // manual column mapping (IO-4)
          const sel = (field) => {
            const s = h('select', { 'aria-label': t('imp.field.' + field), onchange: (e) => { if (e.target.value === '') delete map[field]; else map[field] = +e.target.value; draw(); } },
              h('option', { value: '', text: '-' }), p.header.map((name, i) => h('option', { value: String(i), text: name || colLetter(i), selected: map[field] === i || null })));
            return h('label', { class: 'vet-field' }, h('span', { text: t('imp.field.' + field) }), s);
          };
          info.append(h('details', { class: 'vet-map', open: p.error || mapOpen ? true : null, ontoggle: (e) => { mapOpen = e.target.open; } }, h('summary', { text: t('imp.mapping') }), h('div', { class: 'vet-map-grid' }, C.IMPORT_FIELDS.map(sel))));
        }
        if (p.error) { fail('imp.noColumns'); return; }
        const rows = p.rows;
        if (rows.length > 5000) { fail('imp.tooMany'); return; }
        let dupMode = 'skip';
        const byExt = new Map(board.items.filter((x) => x.externalId).map((x) => [x.externalId, x]));
        const byCode = new Map(board.items.map((x) => [String(x.code).toLowerCase(), x]));
        const dups = rows.filter((r) => (r.externalId && byExt.has(r.externalId)) || (r.code && byCode.has(r.code.toLowerCase()))).length;
        const bad = rows.filter((r) => r.errors.length);
        const known = new Map(board.itemTypes.map((ty) => [typeName(ty.id).toLowerCase(), ty.id]));
        const unknown = [...new Set(rows.filter((r) => r.type && !known.has(r.type.toLowerCase())).map((r) => r.type))];
        info.append(...[h('p', { text: t('imp.list', { n: rows.length }) }),
          h('table', { class: 'vet-table is-small' }, h('thead', {}, h('tr', {}, ['#', t('col.code'), t('col.title'), axisName('out'), axisName('in')].map((x) => h('th', { text: x })))),
            h('tbody', {}, rows.slice(0, 20).map((r) => h('tr', { class: r.errors.length ? 'is-error' : '' }, h('td', { text: r.line }), h('td', { text: r.code }), h('td', { text: r.title }), h('td', { text: r.out ?? '' }), h('td', { text: r.in ?? '' }))))),
          bad.length ? h('p', { class: 'vet-error', text: t('imp.errors', { n: bad.length, lines: bad.slice(0, 10).map((r) => r.line).join(', ') }) }) : null,
          unknown.length ? h('div', { class: 'vet-form' }, h('p', { text: t('imp.types', { n: unknown.length }) }), unknown.slice(0, 30).map((name) => h('label', { class: 'vet-field' }, h('span', { text: name }),
            h('select', { onchange: (e) => typeChoice.set(name, e.target.value) }, h('option', { value: '', text: t('imp.typeNew') }), board.itemTypes.map((ty) => h('option', { value: ty.id, text: typeName(ty.id), selected: typeChoice.get(name) === ty.id || null })))))) : null,
          dups ? h('div', { class: 'vet-form' }, h('p', { text: t('imp.dups', { n: dups }) }), ['skip', 'update', 'add'].map((k) => h('label', { class: 'vet-radio' }, h('input', { type: 'radio', name: 'vet-dup', checked: k === 'skip' || null, onchange: () => { dupMode = k; } }), h('span', { text: t('imp.dup.' + k) })))) : null,
          xlCfg ? h('div', { class: 'vet-form' }, h('label', { class: 'vet-check' }, h('input', { type: 'checkbox', checked: applyCfg || null, onchange: (e) => { applyCfg = e.target.checked; } }), h('span', { text: t('imp.xlsxCfg') })),
            h('ul', { class: 'vet-diff' }, diffLines(xlCfg))) : null].filter(Boolean));
        handler = () => {
          let added = 0, updated = 0;
          change(() => {
            if (applyCfg && xlCfg) C.applyConfig(board, structuredClone(xlCfg));
            const typeMap = new Map(board.itemTypes.map((ty) => [typeName(ty.id).toLowerCase(), ty.id]));
            const taken = new Set();
            for (const r of rows) {
              if (r.errors.length) continue;
              let typeId = r.typeId && board.itemTypes.some((x) => x.id === r.typeId) ? r.typeId : null;
              if (!typeId && r.type) {
                typeId = typeMap.get(r.type.toLowerCase()) || typeChoice.get(r.type) || null;
                if (!typeId) { const nt = { id: 't-' + C.uuidv7().slice(-8), name: { [LOC]: r.type }, pluralName: { [LOC]: r.type }, prefix: r.type.replace(/[^\p{L}]/gu, '').slice(0, 4).toUpperCase() || 'EL', color: C.PALETTE[board.itemTypes.length % C.PALETTE.length], icon: 'dot', defaultPolarity: r.polarity === 'anti' ? 'anti' : 'value' }; board.itemTypes.push(nt); typeMap.set(r.type.toLowerCase(), nt.id); typeId = nt.id; }
              }
              typeId = typeId || board.itemTypes[0].id;
              const dup = (r.externalId && byExt.get(r.externalId)) || (r.code && byCode.get(r.code.toLowerCase()));
              let it;
              if (dup && dupMode === 'skip') continue;
              if (dup && dupMode === 'update') { it = dup; Object.assign(it, { title: r.title || it.title, description: r.description || it.description, typeId, polarity: r.polarity === 'anti' || r.polarity === 'value' ? r.polarity : it.polarity, tags: r.tags.length ? r.tags : it.tags, externalId: r.externalId || it.externalId }); updated++; }
              else { it = C.makeItem(board, { title: r.title, code: dup ? '' : r.code, description: r.description, typeId, polarity: r.polarity === 'anti' ? 'anti' : r.polarity === 'value' ? 'value' : undefined, tags: r.tags, externalId: r.externalId, taken }); taken.add(it.code); board.items.push(it); added++; }
              if (r.out !== null) setEst(it.id, 'out', r.out, 'import');
              if (r.in !== null) setEst(it.id, 'in', r.in, 'import');
            }
          });
          d.closeNow(); toast(t('imp.listDone', { added, updated }), () => undo());
        };
        ok.disabled = !rows.some((r) => !r.errors.length);
      };
      draw();
    }
  });
  const d = dialog(t('import'), h('div', { class: 'vet-form' }, h('p', { class: 'vet-hint', text: t('imp.hint') }), file, info), [btn(t('cancel'), () => d.closeNow()), ok], { wide: true });
}

const colLetter = (i) => { let s = ''; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

// ---------- toasts ----------

function toast(text, onUndo, ms = 6000) {
  const el = h('div', { class: 'vet-toast' }, h('span', { text }));
  if (onUndo) el.append(btn(t('undo'), () => { el.remove(); onUndo(); }, { cls: 'vet-btn-sm' }));
  el.append(btn('', () => el.remove(), { icon: 'x', title: t('close'), cls: 'vet-btn-icon' }));
  ui.toasts.append(el);
  setTimeout(() => el.remove(), ms);
}

// ---------- keyboard and leaving the page ----------

document.addEventListener('keydown', (e) => {
  if (document.querySelector('dialog[open]')) return;
  const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !inField) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !inField) { e.preventDefault(); redo(); }
});
document.addEventListener('keydown', (e) => { // "?" opens the shortcuts when no field has the focus
  if (e.key === '?' && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !e.target.isContentEditable && !document.querySelector('dialog[open]')) { e.preventDefault(); openKeys(); }
});
window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }); // MO-3: settings-only changes count too
let rz = null;
window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(renderScales, 150); });


// ---------- team mode (TZ 6.2) ----------

/** The selected item's estimates on a scale (MO-11 open mode, MO-12 after reveal): one dot per participant,
    the spread line from the lowest to the highest estimate and the team value (median or fixed final). */
function peers(id, key) {
  const axis = board.axes[key];
  const names = new Map((team.view.participants || []).map((p) => [p.id, p.name]));
  const list = board.estimates.filter((e) => e.itemId === id && e.axis === key && e.participantId !== 'shared' && typeof e.value === 'number');
  if (!list.length) return [];
  const sp = C.spreadOf(board, id, key);
  const out = [h('div', { class: 'vet-spread', style: { left: pct(axis, sp.min) + '%', width: Math.max(0.4, pct(axis, sp.max) - pct(axis, sp.min)) + '%' }, title: t('team.spread', { min: C.fmtNum(sp.min, LANG, false), max: C.fmtNum(sp.max, LANG, false), n: sp.n }) })];
  for (const e of list) out.push(h('span', { class: 'vet-peer' + (e.participantId === C.me() ? ' is-me' : ''), style: { left: pct(axis, e.value) + '%' },
    title: `${names.get(e.participantId) || '?'}: ${C.fmtNum(e.value, LANG, false)}`, text: initials(names.get(e.participantId)) }));
  const v = C.valueOf(board, id, key);
  if (v !== null) out.push(h('span', { class: 'vet-median' + (C.finalOf(board, id, key) !== null ? ' is-final' : ''), style: { left: pct(axis, v) + '%' },
    title: (C.finalOf(board, id, key) !== null ? t('team.final') : t('team.median')) + ': ' + C.fmtNum(v, LANG, false) }));
  return out;
}

/** Card part for a team board: everybody's estimates, and the facilitator's fixed final value (MO-13). */
function teamCard(it) {
  if (!team || !team.othersVisible) return null;
  const names = new Map((team.view.participants || []).map((p) => [p.id, p.name]));
  const rows = board.estimates.filter((e) => e.itemId === it.id && e.participantId !== 'shared');
  const box = h('div', { class: 'vet-team-card' }, h('strong', { text: t('team.estimates') }));
  for (const key of board.priority === 'out' ? ['out'] : ['out', 'in']) {
    const vals = rows.filter((e) => e.axis === key).map((e) => `${names.get(e.participantId) || '?'} ${C.fmtNum(e.value, LANG, false)}`);
    const v = C.valueOf(board, it.id, key), fixed = C.finalOf(board, it.id, key);
    box.append(h('p', { class: 'vet-small' }, h('b', { text: axisName(key) + ': ' }), (fixed !== null ? '✋ ' : '') + (v === null ? t('notEstimated') : C.fmtNum(v, LANG, false)),
      vals.length ? h('span', { class: 'vet-muted', text: ' · ' + vals.join(', ') }) : null));
  }
  if (C.needsDiscussion(board, it.id)) box.append(h('p', { class: 'vet-warn', text: t('team.discussHint') }));
  if (team.canEdit) {
    const inp = (key) => h('input', { type: 'number', step: 'any', value: C.finalOf(board, it.id, key) ?? '', placeholder: C.fmtNum(C.valueOf(board, it.id, key), LANG, false) || '—',
      onchange: (e) => change(() => {
        board.finals = { ...(board.finals || {}) };
        const f = { ...(board.finals[it.id] || {}) };
        if (e.target.value === '') delete f[key]; else f[key] = Number(e.target.value);
        if (Object.keys(f).length) board.finals[it.id] = f; else delete board.finals[it.id];
      }) });
    box.append(h('div', { class: 'vet-field-row' }, h('label', { class: 'vet-field' }, h('span', { text: t('team.fix') + ' · ' + axisName('out') }), inp('out')),
      board.priority === 'out' ? null : h('label', { class: 'vet-field' }, h('span', { text: t('team.fix') + ' · ' + axisName('in') }), inp('in'))));
  }
  return box;
}

/** "Share with a team" in solo mode (MO-5): sign in if needed, upload the board, open it as a team board. */
async function shareSolo() {
  if (!root.dataset.user) {
    if (!SIGNIN) { toast(t('team.signIn')); return; }
    try { sessionStorage.setItem('vet.share', JSON.stringify(board)); } catch (e) { toast(t('team.exportFirst')); return; } // without storage the board would be lost on sign-in
    dirty = false;
    location.href = SIGNIN + encodeURIComponent(localHref('/tools/vet/?share=1'));
    return;
  }
  try {
    const T = await import('./vet-team.js?v=' + V);
    const id = await T.shareBoard(await apiOf(''), board);
    dirty = false;
    location.href = localHref('/tools/vet/b/' + id + '/');
  } catch (e) { toast(t('team.error') + ' ' + (e.code || '')); }
}

/** Share dialog for the facilitator (MO-7, MO-8, MO-11, MO-13, MO-14). */
function openShare() {
  const body = h('div', { class: 'vet-form vet-share' });
  const roles = [['facilitator', 'edit'], ['estimator', 'estimate'], ['viewer', 'view']];
  const safe = (fn) => async () => { try { await fn(); } catch (e) { toast(t('team.error') + ' ' + (e.code || '')); } };
  const draw = () => {
    body.replaceChildren();
    body.append(h('h3', { class: 'vet-h3', text: t('share.links') }), h('p', { class: 'vet-hint', text: t('share.linksHint') }));
    for (const [role, key] of roles) {
      const l = (team.view.links || []).find((x) => x.role === role);
      const row = h('div', { class: 'vet-link-row' }, h('span', { class: 'vet-link-role', text: t('share.role.' + key) }));
      if (l) {
        const inp = h('input', { value: l.url, readonly: true, 'aria-label': t('share.role.' + key), onfocus: (e) => e.target.select() });
        row.append(inp, btn(t('share.copy'), async () => { try { await navigator.clipboard.writeText(l.url); toast(t('share.copied')); } catch (e) { inp.select(); } }, { cls: 'vet-btn-primary vet-btn-sm' }),
          btn(t('share.renew'), safe(async () => { await team.newLink(role); draw(); toast(t('share.renewed')); }), { cls: 'vet-btn-sm', title: t('share.renewHint') }),
          btn(t('share.revoke'), safe(async () => { await team.revokeLink(l.id); draw(); }), { cls: 'vet-btn-sm vet-btn-danger' }));
      } else row.append(btn(t('share.create'), safe(async () => { await team.newLink(role); draw(); }), { cls: 'vet-btn-sm' }));
      body.append(row);
    }
    body.append(h('h3', { class: 'vet-h3', text: t('share.mode') }));
    for (const m of ['open', 'blind', 'shared']) body.append(h('label', { class: 'vet-radio' }, h('input', { type: 'radio', name: 'vet-team-mode', value: m, checked: team.mode === m || null,
      onchange: safe(async () => { await team.settings({ mode: m }); draw(); }) }), h('span', {}, h('strong', { text: t('team.mode.' + m) }), h('small', { text: t('team.modeHint.' + m) }))));
    body.append(h('label', { class: 'vet-check' }, h('input', { type: 'checkbox', checked: team.view.settings.guests || null, onchange: (e) => safe(async () => { await team.settings({ guests: e.target.checked }); draw(); })() }),
      h('span', { text: t('share.guests') })));
    const acts = h('div', { class: 'vet-row' });
    if (team.mode === 'blind' && !team.closed) acts.append(btn(t(team.revealed ? 'share.hide' : 'share.reveal'), safe(async () => { await team.action(team.revealed ? 'hide' : 'reveal'); draw(); }), { cls: 'vet-btn-primary' }));
    acts.append(team.closed ? btn(t('share.reopen'), safe(async () => { await team.action('reopen'); draw(); }))
      : btn(t('share.close'), () => confirmBox(t('share.closeAsk'), t('share.close'), safe(async () => { await team.action('close'); draw(); })), { cls: 'vet-btn-danger' }));
    acts.append(btn(t('share.versions'), safe(async () => {
      const list = await team.versions();
      const box = h('div', { class: 'vet-versions' }, list.map((v) => h('div', { class: 'vet-row' }, h('span', { text: new Date(v.createdAt).toLocaleString(LOC) + ' · r' + v.revision + ' · ' + t('share.reason.' + v.reason) }),
        h('span', { class: 'vet-grow' }), btn(t('share.restore'), () => confirmBox(t('share.restoreAsk'), t('share.restore'), safe(async () => { await team.restore(v.id); dv.closeNow(); })), { cls: 'vet-btn-sm' }))));
      const dv = dialog(t('share.versions'), box, [btn(t('close'), () => dv.closeNow())], { wide: true });
    })));
    body.append(h('h3', { class: 'vet-h3', text: t('share.session') }), acts);
  };
  draw();
  const d = dialog(t('share'), body, [btn(t('close'), () => d.closeNow())], { wide: true });
}

/** A server state arrived (other people's changes, or the answer to our own save). */
function onRemote(fresh, o) {
  if (o.own && o.sent && JSON.stringify(board) !== o.sent) { renderNotice(); return; } // newer local changes go with the next save
  const struct = (b) => JSON.stringify([b.items, C.TEAM_KEYS.map((k) => b[k])]);
  if (!o.own && struct(fresh) !== struct(board)) { hist.past = []; hist.future = []; } // Undo never brings back other people's old state
  board = team.keepLocal(fresh, board);
  if (o.conflicts && o.conflicts.length) toast(t('team.conflict'));
  if (selected && !board.items.some((x) => x.id === selected)) selected = null;
  render();
}

// ---------- VSS bridge (VSS TZ 9.1-9.5, VET VS-5 ... VS-10): postMessage, same origin only ----------

function bridgePost(type, payload) { window.parent.postMessage({ protocol: 'aevri.vet', version: 1, type, requestId: bridge.requestId, payload }, location.origin); }

function bridgeBanner() {
  if (bridge.ledgerRef) { // receiver mode (LG-2): the wallet asked to estimate what was received
    return h('div', { class: 'vet-bridge' }, h('span', { class: 'vet-bridge-flow' }, h('b', { text: t('bridge.received') + ': ' }), bridge.ledgerTitle || ''),
      btn(t('bridge.saveLedger'), bridgeSave, { cls: 'vet-btn-primary' }), btn(t('cancel'), bridgeCancel));
  }
  const fr = bridge.flowRef;
  const side = (x) => (x && x.name) || t('bridge.external');
  return h('div', { class: 'vet-bridge' }, h('span', { class: 'vet-bridge-flow' }, h('b', { text: t('bridge.flow') + ': ' }), `${fr.flowLabel || fr.flowId} · ${side(fr.sourceNode)} → ${side(fr.targetNode)}`),
    btn(t('bridge.save'), bridgeSave, { cls: 'vet-btn-primary' }), btn(t('cancel'), bridgeCancel));
}

function bridgeCancel() {
  if (bridge.session) { dirty = false; location.href = bridge.ret || localHref('/tools/vss/'); return; } // VS-5 transition: back without a result
  bridgePost('vet.cancel', {});
}

async function bridgeSave() {
  const items = C.sortedItems(board);
  const { totals, priorityKind, note } = C.flowTotals(board);
  bridge.revision = Math.max(bridge.revision + 1, Date.now()); // grows across sessions, so VSS can ignore an older result (VET-12)
  const axis = (k) => ({ label: { ...board.axes[k].label, [LOC]: axisName(k) }, unit: board.axes[k].unit || null });
  if (bridge.ledgerRef) { // LG-2, LG-5: the receiver's estimates go back to the wallet, keyed by the event
    bridgePost('vet.result', {
      boardId: board.id, ledgerRef: bridge.ledgerRef, items: C.itemsDoc(board, items).items.map((x) => ({ ...x, priority: Number.isFinite(x.priority) ? x.priority : null })),
      totals, axes: { out: axis('out'), in: axis('in') },
      extensions: { aevriLedger: { schemaVersion: '1.0', resultId: C.uuidv7(), resultRevision: bridge.revision, priorityKind, note, boardSnapshot: JSON.parse(JSON.stringify(board)) } },
    });
    dirty = false;
    return;
  }
  const result = {
    boardId: board.id, boardUrl: null, flowRef: bridge.flowRef, items: C.itemsDoc(board, items).items.map((x) => ({ ...x, priority: Number.isFinite(x.priority) ? x.priority : null })),
    totals, axes: { out: axis('out'), in: axis('in') },
    extensions: { aevriVss: { schemaVersion: '1.0', resultId: C.uuidv7(), resultRevision: bridge.revision, contextFingerprint: bridge.fp, priorityKind, note, typeMappings: bridge.mappings, boardSnapshot: JSON.parse(JSON.stringify(board)) } },
  };
  if (bridge.session) { // VS-5 transition: the result goes to the server, VSS takes it by the token
    try {
      const r = await (await apiOf('')).post('/vss/sessions/' + bridge.session + '/result', { result });
      dirty = false;
      location.href = r.return;
    } catch (e) { toast(t('team.error') + ' ' + (e.code || '')); }
    return;
  }
  bridgePost('vet.result', result);
  dirty = false;
}

window.addEventListener('message', (e) => {
  if (!bridge.on || e.origin !== location.origin || e.source !== window.parent) return; // VS-9
  const m = e.data;
  if (!m || m.protocol !== 'aevri.vet' || m.version !== 1 || !m.payload) return;
  if (bridge.requestId === m.requestId) return; // a repeated open never creates a second board (VSS VET-7, LG-2)
  if (m.type === 'vss.open' && m.payload.flowRef) openFromVss(m.payload, m.requestId);
  else if (m.type === 'ledger.open' && m.payload.ledgerRef && m.payload.ledgerRef.entryId) openFromLedger(m.payload, m.requestId);
});

/** ledger.open (VET spec 10, LG-1 ... LG-3; Value Wallet SPEC 16.1): the receiver estimates what was received.
    Board key = {ledgerId, entryId, assessorId}; out may go negative (the received thing did harm, LG-3). */
function openFromLedger(p, requestId) {
  const ext = (p.extensions && p.extensions.aevriLedger) || {};
  bridge.requestId = requestId; bridge.flowRef = null; bridge.ledgerRef = { ...p.ledgerRef }; bridge.ledgerTitle = String(p.title || '').slice(0, 200);
  let b = null;
  if (ext.boardSnapshot) { try { b = C.hydrateBoard(ext.boardSnapshot); } catch (err) { b = null; } } // continue the receiver's own board
  if (!b) {
    b = C.newBoard(bridge.ledgerTitle);
    if (typeof ext.boardId === 'string' && /^[0-9a-f-]{36}$/.test(ext.boardId)) b.id = ext.boardId;
    b.priority = 'difference'; // both axes are the receiver's own value: what I got minus what it cost me
    const axes = p.axes || {};
    for (const k of ['out', 'in']) { const l = axes[k] && axes[k].label; if (l) b.axes[k].label = { [LOC]: String(l).slice(0, 60) }; }
    const ax = b.axes.out, old = { ...ax.scale }; ax.scale.min = -10; C.rebuildBuckets(ax, old); // harm is possible (LG-3)
  }
  const same = (a, c) => a && c && a.entryId === c.entryId && (a.objectIndex ?? null) === (c.objectIndex ?? null);
  for (const it of p.items || []) {
    if (b.items.some((x) => same(x.ledgerRef, it.ledgerRef))) continue;
    const ni = C.makeItem(b, { title: String(it.title || bridge.ledgerTitle || '?').slice(0, 200) });
    ni.ledgerRef = it.ledgerRef ? { ...it.ledgerRef } : { ledgerId: p.ledgerRef.ledgerId, entryId: p.ledgerRef.entryId };
    b.items.push(ni);
  }
  board = b; hist.past = []; hist.future = []; selected = null; picked.clear(); dirty = false;
  render();
}

/** vss.open (embed) or a session payload (transition): the flow's board, found or created (VS-7). */
function openFromVss(p, requestId) {
  const ext = (p.extensions && p.extensions.aevriVss) || {};
  bridge.requestId = requestId; bridge.flowRef = p.flowRef; bridge.fp = ext.contextFingerprint || null; bridge.mappings = ext.typeMappings || [];
  let b = null;
  if (ext.boardSnapshot) { try { b = C.hydrateBoard(ext.boardSnapshot); } catch (err) { b = null; } } // the same board with its ids (VET-15)
  if (!b) {
    b = C.newBoard(p.flowRef.flowLabel || '');
    if (typeof ext.boardId === 'string' && /^[0-9a-f-]{36}$/.test(ext.boardId)) b.id = ext.boardId; // only results were kept: continue the same Board id
    // VSS element types become VET item types with an explicit mapping (VSS TYPE-9); no items, no estimates are invented (TYPE-10)
    (ext.elementTypes || []).forEach((et, i) => {
      const id = 't-vss-' + String(et.id).replace(/[^A-Za-z0-9_-]/g, '').slice(-24);
      if (b.itemTypes.some((x) => x.id === id)) return;
      b.itemTypes.push({ id, name: { [LOC]: et.name }, pluralName: { [LOC]: et.name }, prefix: (String(et.name).replace(/[^\p{L}\p{N}]/gu, '').slice(0, 4).toUpperCase() || 'EL'),
        color: C.PALETTE[(i + 1) % C.PALETTE.length], icon: 'dot', defaultPolarity: et.kind === 'anti_value' ? 'anti' : 'value' });
      bridge.mappings.push({ vssSchemaId: p.flowRef.vssSchemaId, elementTypeId: et.id, boardId: b.id, itemTypeId: id });
    });
  }
  for (const it of p.items || []) { // items already linked to the flow (vet-items format)
    if (b.items.some((x) => x.id === it.id)) continue;
    const ni = C.makeItem(b, { title: it.title || it.code, code: it.code, description: it.description, typeId: it.typeId, polarity: it.polarity });
    ni.flowRef = { ...p.flowRef }; b.items.push(ni);
    if (it.out !== null && it.out !== undefined) C.setEstimate(b, ni.id, 'out', it.out, 'import');
    if (it.in !== null && it.in !== undefined) C.setEstimate(b, ni.id, 'in', it.in, 'import');
  }
  board = b; hist.past = []; hist.future = []; selected = null; picked.clear(); dirty = false;
  render();
}
build();
let failed = false;
if (root.dataset.board) { // team board (MO-6 ... MO-15)
  try {
    const T = await import('./vet-team.js?v=' + V);
    team = T.createTeam({ C, api: await apiOf(root.dataset.board), id: root.dataset.board, onRemote, onStatus: () => renderNotice(),
      onError: (e) => { if (e.status === 401 || e.status === 403) toast(t('team.lost')); else if (e.status === 423) toast(t('team.closedHint')); } });
    board = await team.load();
    team.startPolling(() => board);
  } catch (e) {
    failed = true; team = null;
    const key = e.status === 401 ? 'team.signIn' : e.status === 404 || e.status === 410 ? 'team.notFound' : 'team.forbidden';
    root.replaceChildren(h('div', { class: 'vet-empty-state' }, h('p', { text: t(key) }),
      e.status === 401 && SIGNIN ? h('a', { class: 'vet-btn vet-btn-primary', href: SIGNIN + encodeURIComponent(location.pathname), text: t('team.signInBtn') }) : null));
  }
} else if (bridge.session) { // VET opened from VSS in a full page (VS-5): the payload comes from the one-time session
  try {
    const r = await (await apiOf('')).get('/vss/sessions/' + bridge.session);
    bridge.ret = r.return || bridge.ret;
    openFromVss(r.payload, 'session-' + bridge.session.slice(0, 8));
  } catch (e) {
    failed = true;
    root.replaceChildren(h('div', { class: 'vet-empty-state' }, h('p', { text: t(e.status === 401 ? 'team.signIn' : 'bridge.sessionGone') }),
      h('a', { class: 'vet-btn', href: bridge.ret || localHref('/tools/vss/'), text: t('bridge.back') })));
  }
} else if (new URLSearchParams(location.search).get('share') === '1') { // back from sign-in with a solo board to share (MO-5)
  let saved = null;
  try { saved = sessionStorage.getItem('vet.share'); sessionStorage.removeItem('vet.share'); } catch (e) { saved = null; }
  if (saved) { try { board = C.hydrateBoard(JSON.parse(saved)); } catch (e) { board = C.newBoard(''); } if (root.dataset.user) setTimeout(() => shareSolo(), 0); }
  history.replaceState(null, '', location.pathname);
}
if (!failed && root.dataset.telemetry && !bridge.on && !bridge.session) {
  try {
    const M = await import('./vet-telemetry.js?v=' + V);
    TV = M.startTelemetry({ root, t, h, btn, endpoint: root.dataset.telemetry, lang: LOC, about: aboutData, stats: () => {
      const mine = board.estimates.filter((e) => e.participantId === C.me());
      return { mode: team ? 'team' : 'solo', items: board.items.filter((x) => !x.isReference).length, participants: team ? (team.view.participants || []).length : 1,
        estimates: mine.length, estimated: new Set(mine.filter((e) => e.axis === 'out').map((e) => e.itemId)).size,
        helpers: { references: refItems().length > 0, formulas: !!(HP.formulaOf(board, 'out') || HP.formulaOf(board, 'in')), goals: (board.goals || []).length > 0 } };
    } });
  } catch (e) { TV = null; } // the editor works without it
}
if (!failed) render();
root.classList.add('is-ready');
if (bridge.on) {
  bridgePost('vet.ready', { capabilities: ['vss-board-snapshot-v1', 'ledger-receiver-v1', 'resize-v1'] }); // VS-6; LG-2 receiver mode for the Value Wallet
  let lastH = 0, rzT = null; // vet.resize: the content height, so a host that does not fill the screen can size the iframe
  const sendH = () => { const hh = Math.ceil(document.documentElement.scrollHeight); if (Math.abs(hh - lastH) > 8) { lastH = hh; bridgePost('vet.resize', { height: hh }); } };
  if (window.ResizeObserver) new ResizeObserver(() => { clearTimeout(rzT); rzT = setTimeout(sendH, 120); }).observe(document.body);
  sendH();
}
window.VET = { get board() { return board; }, core: C }; // for support and tests in the console
