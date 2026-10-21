/* VET core: the Board model and all calculations, no DOM (TZ section 3, 4, 8; requirement codes in comments).
   The editor UI (vet-ui.js) works only through these functions and the storage adapter, so the same core can be
   shipped in the standalone builds later (TZ section 11). */

export const SCHEMA_VERSION = '1.0';
export const STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 100, 1000];      // AX-5
export const MAX_ABS = 1e9;                                          // AX-17
export const POS_COLORS = ['#6E59F2', '#2BB3E6', '#1FB5A8', '#4CAF50', '#FF9F43']; // AX-12 reference colours
export const NEG_COLORS = ['#C8312B', '#7A1F2B'];                    // AX-10 HARM, SEVERE
export const PALETTE = ['#6E59F2', '#2BB3E6', '#1FB5A8', '#4CAF50', '#FF9F43', '#F25C9A', '#8D6E63', '#607D8B', '#C8312B', '#7A1F2B', '#176B68', '#E0B400'];
export const TYPE_LIBRARY = [                                        // IT-4
  { key: 'task', prefix: 'TASK', color: '#2BB3E6', icon: 'check', polarity: 'value' },
  { key: 'feature', prefix: 'FEAT', color: '#6E59F2', icon: 'star', polarity: 'value' },
  { key: 'initiative', prefix: 'INI', color: '#1FB5A8', icon: 'flag', polarity: 'value' },
  { key: 'risk', prefix: 'RISK', color: '#C8312B', icon: 'alert', polarity: 'anti' },
  { key: 'incident', prefix: 'INC', color: '#7A1F2B', icon: 'bolt', polarity: 'anti' },
  { key: 'service', prefix: 'SRV', color: '#4CAF50', icon: 'box', polarity: 'value' },
  { key: 'artifact', prefix: 'ART', color: '#FF9F43', icon: 'doc', polarity: 'value' },
  { key: 'techdebt', prefix: 'DEBT', color: '#8D6E63', icon: 'wrench', polarity: 'anti' },
];

// ---------- ids (DM-5: UUID v7, made on the client) ----------

export function uuidv7() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  let ts = Date.now();
  for (let i = 5; i >= 0; i--) { b[i] = ts % 256; ts = Math.floor(ts / 256); }
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---------- numbers ----------

export const roundTo = (v, step) => {
  const r = Math.round(v / step) * step;
  const d = (String(step).split('.')[1] || '').length;
  return Number(r.toFixed(d));
};
const ceilTo = (v, step) => roundTo(Math.ceil(v / step - 1e-9) * step, step);

/** Smallest "nice" number (1, 2, 2.5, 5 x 10^n) >= x, multiple of step (AX-19 rule 2). */
export function niceUp(x, step) {
  if (x <= 0) return step;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= x - 1e-9) return Math.min(MAX_ABS, ceilTo(m * p, step));
  return Math.min(MAX_ABS, ceilTo(10 * p, step));
}

/** Compact labels from 1000 (AX-17), full numbers below. */
export function fmtNum(v, lang, compact = true) {
  if (v === null || v === undefined || Number.isNaN(v)) return '';
  if (v === Infinity) return '∞';
  if (v === -Infinity) return '-∞';
  const opts = compact && Math.abs(v) >= 1000 ? { notation: 'compact', maximumFractionDigits: 1 } : { maximumFractionDigits: 2 };
  try { return new Intl.NumberFormat(lang, opts).format(v).replace(/−/g, '-'); } catch (e) { return String(v); }
}

// ---------- defaults ----------

/** Equal buckets over the positive part and two anti-value buckets over the negative part (AX-10, AX-12). */
export function defaultBuckets(scale) {
  const step = scale.step;
  const out = [];
  const neg = [];
  if (scale.min < 0) {
    const a = scale.min, b = -step;
    const n = Math.round((b - a) / step) + 1;
    if (n >= 2) {
      const half = Math.floor(n / 2);
      neg.push({ id: 'severe', label: 'SEVERE', from: a, to: roundTo(a + (half - 1) * step, step), color: NEG_COLORS[1], polarity: 'anti', auto: true });
      neg.push({ id: 'harm', label: 'HARM', from: roundTo(a + half * step, step), to: b, color: NEG_COLORS[0], polarity: 'anti', auto: true });
    } else neg.push({ id: 'harm', label: 'HARM', from: a, to: b, color: NEG_COLORS[0], polarity: 'anti', auto: true });
  }
  const a = scale.min > 0 ? scale.min : step;
  const b = scale.max;
  if (b >= a) {
    const n = Math.round((b - a) / step) + 1;
    const names = ['LOW', 'PRE-MID', 'MIDDLE', 'PRE-BIG', 'BIG'];
    const parts = Math.min(5, n);
    for (let i = 0; i < parts; i++) {
      const s = Math.round((i * n) / parts), e = Math.round(((i + 1) * n) / parts) - 1;
      out.push({ id: names[i].toLowerCase(), label: names[i], from: roundTo(a + s * step, step), to: roundTo(a + e * step, step), color: POS_COLORS[i], polarity: 'value', auto: true });
    }
  }
  return [...neg, ...out];
}

export function defaultAxis(key) {
  const scale = { min: 1, max: 20, step: 1, zero: null, type: 'linear', list: null };
  return {
    key, label: {}, unit: '', scale, buckets: defaultBuckets(scale), bucketsEdited: false,
    autoscale: { shrink: true, low: 0.7, target: 0.8, minLength: 20, manual: false },
  };
}

export function defaultType() {
  return { id: 't-value', name: {}, pluralName: {}, prefix: 'VE', color: '#176B68', icon: 'dot', defaultPolarity: 'value', lib: 'value' };
}

export function newBoard(title = '') {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION, id: uuidv7(), title, description: '', mode: 'solo', view: '1d',
    priority: 'ratio', aggregation: 'median', lang: '',
    axes: { out: defaultAxis('out'), in: defaultAxis('in') },
    itemTypes: [defaultType()], items: [],
    participants: [{ id: 'p-1', displayName: '', role: 'facilitator', userId: null }],
    estimates: [], metrics: [], formulas: [], goals: [], finals: {},
    settings: { bucketsOnly: false, swapAxes: false, guides: 'selected', quadrants: { tl: '', tr: '', bl: '', br: '' } },
    createdAt: now, updatedAt: now,
  };
}

// ---------- estimates and values ----------

let ME = 'p-1';
/** The participant whose estimates setEstimate writes (team mode: "u-<id>", "g-<hash>" or "shared"; solo: "p-1"). */
export function setMe(pid) { ME = pid || 'p-1'; }
export function me() { return ME; }

/* NF-1: estimates indexed by item and axis. The index belongs to the estimates array (a new array = a new index) and is
   kept in step by setEstimate; touchEstimates() drops it after a change made around setEstimate. */
const IDX = new WeakMap();
let GEN = 0;
export function touchEstimates() { GEN++; }
const kOf = (itemId, axis) => itemId + '' + axis;
function index(board) {
  const est = board.estimates;
  let c = IDX.get(est);
  if (!c || c.len !== est.length || c.gen !== GEN) {
    c = { len: est.length, gen: GEN, map: new Map() };
    for (const e of est) { const k = kOf(e.itemId, e.axis); const l = c.map.get(k); if (l) l.push(e); else c.map.set(k, [e]); }
    IDX.set(est, c);
  }
  return c;
}
const estimatesOf = (board, itemId, axis) => index(board).map.get(kOf(itemId, axis)) || [];

export function estimateOf(board, itemId, axis, pid = ME) {
  return estimatesOf(board, itemId, axis).find((e) => e.participantId === pid) || null;
}

/** The facilitator's fixed final value of an item (MO-13), or null. */
export function finalOf(board, itemId, axis) {
  const f = board.finals && board.finals[itemId];
  return f && typeof f[axis] === 'number' ? f[axis] : null;
}

/** Spread of the participants' estimates (MO-12): { min, max, n } or null when nobody estimated. */
export function spreadOf(board, itemId, axis) {
  const vals = estimatesOf(board, itemId, axis).filter((e) => typeof e.value === 'number').map((e) => e.value);
  if (!vals.length) return null;
  return { min: Math.min(...vals), max: Math.max(...vals), n: vals.length };
}

/** MO-12: "discuss" when the estimates of an item spread over more than one bucket on an axis. */
export function needsDiscussion(board, itemId) {
  return ['out', 'in'].some((k) => {
    const s = spreadOf(board, itemId, k);
    if (!s || s.n < 2) return false;
    const a = bucketOf(board.axes[k], s.min), b = bucketOf(board.axes[k], s.max);
    return !!a && !!b && a.id !== b.id;
  });
}

/** Final value of an item on an axis (fixed final, else aggregation over participants; solo = the one estimate). Null = not estimated. */
export function valueOf(board, itemId, axis) {
  const fixed = finalOf(board, itemId, axis);
  if (fixed !== null) return fixed;
  const vals = estimatesOf(board, itemId, axis).filter((e) => typeof e.value === 'number').map((e) => e.value);
  if (!vals.length) return null;
  if (vals.length === 1 || board.aggregation === 'facilitator') return vals[0];
  if (board.aggregation === 'mean') return vals.reduce((a, b) => a + b, 0) / vals.length;
  vals.sort((a, b) => a - b);
  const m = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[m] : (vals[m - 1] + vals[m]) / 2;
}

export function setEstimate(board, itemId, axis, value, source = 'drag') {
  const c = index(board), k = kOf(itemId, axis);
  const list = c.map.get(k) || [];
  const old = list.find((e) => e.participantId === ME) || null;
  const i = old ? board.estimates.indexOf(old) : -1;
  if (value === null || value === undefined || value === '') {
    if (i >= 0) { board.estimates.splice(i, 1); list.splice(list.indexOf(old), 1); c.len = board.estimates.length; }
    return;
  }
  const e = { itemId, axis, participantId: ME, value: Number(value), source, updatedAt: new Date().toISOString() };
  if (i >= 0) { const ne = { ...old, ...e }; board.estimates[i] = ne; list[list.indexOf(old)] = ne; return; }
  board.estimates.push(e);
  if (list.length) list.push(e); else c.map.set(k, [e]);
  c.len = board.estimates.length;
}

/** Axes the priority formula needs (DM-1). */
export function neededAxes(board) { return board.priority === 'out' ? ['out'] : ['out', 'in']; }

/**
 * Priority of an item (DM-1 ... DM-3). Returns { value: number|null, note: null|'neg-in' }.
 * ratio: out / in; in = 0 -> +-Infinity or 0; in < 0 -> out - in with a note. difference: out - in. out: out.
 */
export function priorityOf(board, item) {
  const o = valueOf(board, item.id, 'out');
  const i = valueOf(board, item.id, 'in');
  if (o === null || (board.priority !== 'out' && i === null)) return { value: null, note: null };
  if (board.priority === 'out') return { value: o, note: null };
  if (board.priority === 'difference') return { value: o - i, note: null };
  if (i === 0) return { value: o > 0 ? Infinity : o < 0 ? -Infinity : 0, note: null };
  if (i < 0) return { value: o - i, note: 'neg-in' };
  return { value: o / i, note: null };
}

/** Items sorted by priority, descending; ties by out, then by code; not estimated at the bottom (DM-4). */
export function sortedItems(board, items = board.items.filter((x) => !x.isReference)) {
  const rows = items.map((it) => ({ it, p: priorityOf(board, it).value, o: valueOf(board, it.id, 'out') }));
  rows.sort((a, b) => {
    if (a.p === null && b.p !== null) return 1;
    if (b.p === null && a.p !== null) return -1;
    if (a.p !== b.p && a.p !== null) return b.p - a.p > 0 ? 1 : -1;
    const ao = a.o ?? -Infinity, bo = b.o ?? -Infinity;
    if (ao !== bo) return bo - ao > 0 ? 1 : -1;
    return String(a.it.code).localeCompare(String(b.it.code), undefined, { numeric: true });
  });
  return rows.map((r) => r.it);
}

export function bucketOf(axis, v) {
  if (v === null || v === undefined) return null;
  return axis.buckets.find((b) => v >= b.from - 1e-9 && v <= b.to + 1e-9) || null;
}

export const inScale = (axis, v) => v >= axis.scale.min - 1e-9 && v <= axis.scale.max + 1e-9;

/** Middle of a bucket rounded to the step (AX-14). */
export const bucketMiddle = (axis, b) => roundTo((b.from + b.to) / 2, axis.scale.step);

// ---------- scales (AX-7, AX-16, AX-19) ----------

/** Rescales bucket boundaries: default buckets are rebuilt, edited ones are scaled proportionally (AX-12, AX-16). */
export function rebuildBuckets(axis, oldScale) {
  if (!axis.bucketsEdited) { axis.buckets = defaultBuckets(axis.scale); return; }
  const s = axis.scale, step = s.step;
  const kp = oldScale.max > 0 ? s.max / oldScale.max : 1;
  const kn = oldScale.min < 0 && s.min < 0 ? s.min / oldScale.min : 1;
  const pos = axis.buckets.filter((b) => b.polarity !== 'anti').sort((a, b) => a.from - b.from);
  const neg = axis.buckets.filter((b) => b.polarity === 'anti').sort((a, b) => a.from - b.from);
  pos.forEach((b) => { b.from = roundTo(b.from * kp, step); b.to = roundTo(b.to * kp, step); });
  neg.forEach((b) => { b.from = roundTo(b.from * kn, step); b.to = roundTo(b.to * kn, step); });
  axis.buckets = normalizeBuckets(axis, [...neg, ...pos]);
}

/** No gaps, no overlaps, zero outside every bucket, the whole scale covered (AX-13). */
export function normalizeBuckets(axis, list) {
  const s = axis.scale, step = s.step;
  const fix = (arr, lo, hi) => {
    arr = arr.filter((b) => b.to >= b.from).sort((a, b) => a.from - b.from);
    if (!arr.length || hi < lo) return [];
    arr[0].from = lo;
    for (let i = 1; i < arr.length; i++) arr[i].from = roundTo(arr[i - 1].to + step, step);
    arr[arr.length - 1].to = hi;
    return arr.filter((b) => b.to >= b.from && b.from >= lo && b.to <= hi);
  };
  const neg = s.min < 0 ? fix(list.filter((b) => b.polarity === 'anti'), s.min, -step) : [];
  const pos = fix(list.filter((b) => b.polarity !== 'anti'), s.min > 0 ? s.min : step, s.max);
  return [...neg, ...pos];
}

/** All values shown on an axis (items, references), for autoscale. */
function axisValues(board, key) {
  return board.estimates.filter((e) => e.axis === key && typeof e.value === 'number').map((e) => e.value);
}

/**
 * New bounds of an axis after an action (AX-16 expansion always; AX-19 shrink when enabled, with hysteresis).
 * Returns null when nothing changes, else { min, max, expanded: bool }.
 */
export function autoscaleBounds(board, key) {
  const axis = board.axes[key];
  const s = axis.scale, a = axis.autoscale;
  if (s.type === 'list') return null;
  const vals = axisValues(board, key);
  let { min, max } = s;
  let expanded = false;
  const minLen = Math.max(a.minLength || 20, 10 * s.step);
  const pos = vals.filter((v) => v > 0), neg = vals.filter((v) => v < 0);
  const maxV = pos.length ? Math.max(...pos) : 0;
  const minV = neg.length ? Math.min(...neg) : 0;
  // positive part
  if (maxV > max) { max = Math.max(minLen, niceUp(maxV / a.target, s.step)); expanded = true; }
  else if (a.shrink && !a.manual) {
    const fill = max > 0 ? maxV / max : 1;
    if (fill < a.low) max = Math.max(minLen, niceUp(maxV / a.target, s.step));
  }
  // negative part (only where it exists, or a value needs it)
  if (minV < 0 && minV < min) {
    const depth = Math.max(minLen / 2, niceUp(-minV / a.target, s.step));
    min = -depth; expanded = true;
  } else if (min < 0 && a.shrink && !a.manual) {
    const fillN = -minV / -min;
    if (fillN < a.low) min = -Math.max(minLen / 2, niceUp(-minV / a.target, s.step));
  }
  // values below a positive minimum (for example 0 on a 1..20 scale)
  const low = vals.length ? Math.min(...vals) : min;
  if (low >= 0 && low < min) { min = Math.floor(low / s.step) * s.step; expanded = true; }
  max = Math.min(MAX_ABS, max); min = Math.max(-MAX_ABS, min);
  if (min === s.min && max === s.max) return null;
  return { min, max, expanded };
}

export function applyBounds(axis, b) {
  const old = { ...axis.scale };
  axis.scale.min = b.min; axis.scale.max = b.max;
  rebuildBuckets(axis, old);
}

/** Ticks for drawing: about `target` nice values between min and max (never one per step on long axes). */
export function ticks(scale, target = 10) {
  if (scale.type === 'list' && Array.isArray(scale.list)) return scale.list.map((x) => x.value);
  const span = scale.max - scale.min;
  let t = Math.max(scale.step, niceUp(span / target, scale.step));
  const out = [];
  const start = Math.ceil(scale.min / t) * t;
  for (let v = start; v <= scale.max + 1e-9 && out.length < 400; v += t) out.push(roundTo(v, scale.step));
  return out;
}

// ---------- items ----------

export function typeById(board, id) { return board.itemTypes.find((t) => t.id === id) || board.itemTypes[0]; }

/** Next free code for a type: <prefix>-<N> (DM-5). */
export function nextCode(board, type, taken = new Set()) {
  const prefix = (type.prefix || 'VE').toUpperCase();
  const used = new Set([...board.items.map((x) => String(x.code).toUpperCase()), ...[...taken].map((x) => String(x).toUpperCase())]);
  let n = 1;
  board.items.forEach((x) => { const m = String(x.code).match(new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-(\\d+)$', 'i')); if (m) n = Math.max(n, Number(m[1]) + 1); });
  while (used.has(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}

export function makeItem(board, f) {
  const type = typeById(board, f.typeId);
  return {
    id: uuidv7(), code: (f.code || '').trim().slice(0, 24) || nextCode(board, type, f.taken), title: String(f.title || '').trim().slice(0, 200),
    description: String(f.description || '').slice(0, 5000), typeId: type.id, polarity: f.polarity || type.defaultPolarity || 'value',
    tags: f.tags || [], links: f.links || [], flowRef: null, ledgerRef: null, goalIds: [], externalId: f.externalId || '', isReference: false,
  };
}

export function removeItems(board, ids) {
  const set = new Set(ids);
  board.items = board.items.filter((x) => !set.has(x.id));
  board.estimates = board.estimates.filter((e) => !set.has(e.itemId));
}

// ---------- paste and CSV ----------

/** Splits a CSV / TSV / ";" line respecting quotes. */
export function splitLine(line, sep) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === sep) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function detectSep(text) {
  const first = text.split(/\r?\n/).find((l) => l.trim()) || '';
  if (first.includes('\t')) return '\t';
  const sc = (first.match(/;/g) || []).length, cm = (first.match(/,/g) || []).length;
  return sc >= cm && sc > 0 ? ';' : cm > 0 ? ',' : null;
}

const num = (s) => {
  if (s === undefined || s === null) return null;
  const t = String(s).trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

/** "Paste as list" (EL-3): one line = one item; "code; title; out; in" or just a title. Returns rows with errors. */
export function parsePaste(text) {
  const sep = detectSep(text);
  const rows = [];
  text.split(/\r?\n/).forEach((line, n) => {
    if (!line.trim()) return;
    const c = sep ? splitLine(line, sep) : [line.trim()];
    let r;
    if (c.length === 1) r = { code: '', title: c[0], out: null, in: null };
    else if (c.length === 2) r = { code: c[0], title: c[1], out: null, in: null };
    else r = { code: c[0], title: c[1], out: num(c[2]), in: num(c[3]) };
    const errors = [];
    if (!r.title) errors.push('title');
    if (Number.isNaN(r.out)) errors.push('out');
    if (Number.isNaN(r.in)) errors.push('in');
    if (r.code.length > 24) errors.push('code');
    rows.push({ ...r, line: n + 1, errors });
  });
  return rows;
}

const HEAD = {
  code: ['code', 'код', 'задача', 'task', 'id'], title: ['title', 'name', 'название', 'описание', 'summary'], description: ['description', 'details', 'подробности'],
  type: ['type', 'тип'], polarity: ['polarity', 'полярность'], out: ['out', 'value', 'ценность', 'исходящая ценность', 'outgoing value'],
  in: ['in', 'effort', 'трудозатраты', 'входящая ценность', 'incoming value'], tags: ['tags', 'теги'], external_id: ['external_id', 'external id', 'jira', 'key'],
};

/** CSV / TSV with a header row (IO-4, IO-6, IO-9 incl. the reference tool's columns). */
export function parseTable(text, map) {
  const sep = detectSep(text) || ',';
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  return parseGrid(lines.map((l) => splitLine(l, sep)), map);
}

/** Import fields a column can be mapped to (IO-4). */
export const IMPORT_FIELDS = ['code', 'title', 'description', 'type', 'polarity', 'out', 'in', 'tags', 'external_id'];

/** The automatic column map for a header row (IO-4, IO-9). */
export function autoMap(header) {
  const head = header.map((h) => String(h ?? '').toLowerCase().trim());
  const map = {};
  // reference tool (IO-9): Задача -> code, Описание -> title, Ценность -> out, Трудозатраты -> in
  const ref = head.includes('задача') && head.includes('описание');
  head.forEach((h, i) => {
    if (ref) { const m = { 'задача': 'code', 'описание': 'title', 'ценность': 'out', 'трудозатраты': 'in' }[h]; if (m) map[m] = i; return; }
    for (const [k, names] of Object.entries(HEAD)) if (names.includes(h) && map[k] === undefined) { map[k] = i; break; }
  });
  return map;
}

/** Rows of cells (CSV or a spreadsheet sheet) -> import rows; the first row is the header. `map` overrides autoMap. */
export function parseGrid(grid, map) {
  grid = grid.filter((r) => r && r.some((x) => String(x ?? '').trim() !== ''));
  if (!grid.length) return { rows: [], map: {}, header: [] };
  const header = grid[0].map((x) => String(x ?? '').trim());
  map = map || autoMap(header);
  if (map.title === undefined && map.code === undefined) return { rows: [], map, header, error: 'no-columns' };
  const rows = grid.slice(1).map((c, n) => {
    const g = (k) => (map[k] === undefined ? '' : String(c[map[k]] ?? '').trim());
    const r = { code: g('code'), title: g('title') || g('code'), description: g('description'), type: g('type'), polarity: g('polarity'),
      out: num(g('out')), in: num(g('in')), tags: g('tags') ? g('tags').split('|').map((x) => x.trim()).filter(Boolean) : [], externalId: g('external_id'), line: n + 2 };
    r.errors = [];
    if (!r.title) r.errors.push('title');
    if (Number.isNaN(r.out)) r.errors.push('out');
    if (Number.isNaN(r.in)) r.errors.push('in');
    return r;
  });
  return { rows, map, header };
}

/** CSV cell, safe against formula injection (NF-7). */
function cell(v, sep, text = true) {
  let s = v === null || v === undefined ? '' : String(v);
  if (text && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return new RegExp(`["\\n\\r${sep === '\t' ? '\\t' : sep}]`).test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** Items list as CSV (section 8): English headers, dot decimals; "excel" = ';' and decimal comma (I18N-5). */
export function toCSV(board, items, typeName, excel = false) {
  const sep = excel ? ';' : ',';
  const n = (v) => (v === null || v === undefined || !Number.isFinite(v) ? (v === Infinity ? 'inf' : v === -Infinity ? '-inf' : '') : excel ? String(+v.toFixed(6)).replace('.', ',') : String(+v.toFixed(6)));
  const head = ['code', 'title', 'description', 'type', 'polarity', 'out', 'in', 'priority', 'bucket_out', 'bucket_in', 'tags', 'flow_id', 'goal_ids', 'external_id'];
  const lines = [head.join(sep)];
  for (const it of items) {
    const o = valueOf(board, it.id, 'out'), i = valueOf(board, it.id, 'in');
    lines.push([cell(it.code, sep), cell(it.title, sep), cell(it.description, sep), cell(typeName(it.typeId), sep), it.polarity,
      n(o), n(i), n(priorityOf(board, it).value), bucketOf(board.axes.out, o)?.label || '', bucketOf(board.axes.in, i)?.label || '',
      cell((it.tags || []).join('|'), sep), cell(it.flowRef?.flowId || '', sep), cell((it.goalIds || []).join('|'), sep), cell(it.externalId, sep)].join(sep));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

// ---------- documents (IO-1 ... IO-3, IO-10) ----------

export const CONFIG_KEYS = ['axes', 'itemTypes', 'priority', 'aggregation', 'view', 'settings', 'metrics', 'formulas', 'lang'];
/** Keys a facilitator changes as a whole in team mode (the server's last-write-wins unit, MO-10). */
export const TEAM_KEYS = ['title', 'description', 'axes', 'itemTypes', 'priority', 'aggregation', 'lang', 'settings', 'goals', 'metrics', 'formulas', 'finals'];

export function configOf(board, withGoals = true) {
  const c = { schemaVersion: SCHEMA_VERSION, kind: 'vet-config' };
  for (const k of CONFIG_KEYS) c[k] = structuredClone(board[k]);
  if (withGoals) c.goals = structuredClone(board.goals);
  return c;
}

/** What applying `cfg` would change (IO-12), as a list of { key, axis?, n? } for the summary before applying. */
export function configDiff(board, cfg) {
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const out = [];
  for (const key of ['out', 'in']) {
    if (!cfg.axes || !cfg.axes[key]) continue;
    const a = board.axes[key], b = mergeAxis(structuredClone(cfg.axes[key]), key);
    if (!same(a.label, b.label) || (a.unit || '') !== (b.unit || '')) out.push({ key: 'label', axis: key });
    if (!same(a.scale, b.scale) || !same(a.negative, b.negative)) {
      const n = board.items.filter((it) => { const v = valueOf(board, it.id, key); return v !== null && Number.isFinite(v) && (v < b.scale.min || v > b.scale.max); }).length;
      out.push({ key: 'scale', axis: key, n });
    }
    if (!same(a.buckets.map((x) => [x.label, x.from, x.to]), b.buckets.map((x) => [x.label, x.from, x.to]))) out.push({ key: 'buckets', axis: key });
  }
  if (Array.isArray(cfg.itemTypes) && cfg.itemTypes.length) {
    const have = new Set(board.itemTypes.map((x) => x.id)), next = new Set(cfg.itemTypes.map((x) => x.id));
    const added = cfg.itemTypes.filter((x) => !have.has(x.id)).length;
    const removed = board.itemTypes.filter((x) => !next.has(x.id) && !board.items.some((it) => it.typeId === x.id)).length;
    if (added || removed) out.push({ key: 'types', added, removed });
  }
  for (const k of ['priority', 'aggregation', 'view', 'lang']) if (cfg[k] !== undefined && !same(cfg[k], board[k])) out.push({ key: k });
  if (cfg.settings && Object.keys(cfg.settings).some((k) => !same(cfg.settings[k], board.settings[k]))) out.push({ key: 'settings' });
  if (Array.isArray(cfg.goals) && !same(cfg.goals, board.goals)) out.push({ key: 'goals', n: cfg.goals.length });
  return out;
}

/** Spreadsheet rows (FMT-xlsx): items with numbers as numbers, the participants' estimates, goals. Header = CSV names. */
export function itemRows(board, items, typeName) {
  const n = (v) => (v === null || v === undefined ? '' : Number.isFinite(v) ? +v.toFixed(6) : v > 0 ? 'inf' : '-inf');
  const rows = [['code', 'title', 'description', 'type', 'polarity', 'out', 'in', 'priority', 'bucket_out', 'bucket_in', 'tags', 'flow_id', 'goal_ids', 'external_id']];
  for (const it of items) {
    const o = valueOf(board, it.id, 'out'), i = valueOf(board, it.id, 'in');
    rows.push([it.code, it.title, it.description || '', typeName(it.typeId), it.polarity, n(o), n(i), n(priorityOf(board, it).value),
      bucketOf(board.axes.out, o)?.label || '', bucketOf(board.axes.in, i)?.label || '', (it.tags || []).join('|'), it.flowRef?.flowId || '', (it.goalIds || []).join('|'), it.externalId || '']);
  }
  return rows;
}
export function estimateRows(board, items) {
  const code = new Map(items.map((it) => [it.id, it.code]));
  const name = new Map((board.participants || []).map((p) => [p.id, p.displayName || p.id]));
  return [['code', 'axis', 'participant', 'value', 'source', 'updated_at'],
    ...board.estimates.filter((e) => code.has(e.itemId)).map((e) => [code.get(e.itemId), e.axis, name.get(e.participantId) || e.participantId, e.value, e.source || '', e.updatedAt || ''])];
}
export function goalRows(board) {
  return [['id', 'title', 'desired_state', 'measure', 'parent_id', 'weight'],
    ...(board.goals || []).map((g) => [g.id, g.title || '', g.desiredState || '', g.measure || '', g.parentId || '', g.weight ?? ''])];
}

/** The configuration JSON split into cells of at most 30 000 characters (the Excel cell limit is 32 767). */
export const CONFIG_CELL = 'vet-config.json';
export function configCells(cfg) { const s = JSON.stringify(cfg); const out = []; for (let i = 0; i < s.length; i += 30000) out.push(s.slice(i, i + 30000)); return out; }
/** Finds the configuration JSON in a "Settings" sheet: rows whose first cell is CONFIG_CELL, parts joined in order. */
export function configFromRows(rows) {
  const parts = rows.filter((r) => String(r[0] ?? '').trim() === CONFIG_CELL).map((r) => r.slice(1).map((x) => String(x ?? '')).join(''));
  if (!parts.length) return null;
  try { const c = JSON.parse(parts.join('')); return c && c.kind === 'vet-config' ? c : null; } catch (e) { return null; }
}

export function itemsDoc(board, items) {
  return { schemaVersion: SCHEMA_VERSION, kind: 'vet-items', axes: { out: board.axes.out.label, in: board.axes.in.label },
    items: items.map((it) => ({ ...structuredClone(it), out: valueOf(board, it.id, 'out'), in: valueOf(board, it.id, 'in'), priority: priorityOf(board, it).value })) };
}

/** Validates and upgrades an imported board (IO-3). Throws Error('newer' | 'invalid'). */
export function importBoard(doc) {
  if (!doc || typeof doc !== 'object' || !doc.axes || !Array.isArray(doc.items) || !Array.isArray(doc.estimates)) throw new Error('invalid');
  const [maj] = String(doc.schemaVersion || '0').split('.').map(Number);
  if (maj > 1) throw new Error('newer');
  const b = newBoard(doc.title || '');
  for (const k of ['description', 'priority', 'aggregation', 'view', 'lang']) if (doc[k] !== undefined) b[k] = doc[k];
  for (const key of ['out', 'in']) if (doc.axes[key]) b.axes[key] = mergeAxis(doc.axes[key], key);
  if (Array.isArray(doc.itemTypes) && doc.itemTypes.length) b.itemTypes = doc.itemTypes;
  if (doc.settings) b.settings = { ...b.settings, ...doc.settings };
  // new ids, links kept
  const idMap = new Map();
  b.items = doc.items.map((it) => { const id = uuidv7(); idMap.set(it.id, id); return { ...makeItem(b, { ...it, typeId: it.typeId }), ...it, id, code: String(it.code || '').slice(0, 24) }; });
  b.estimates = doc.estimates.filter((e) => idMap.has(e.itemId) && (e.axis === 'out' || e.axis === 'in')).map((e) => ({ ...e, itemId: idMap.get(e.itemId), participantId: ME }));
  b.goals = Array.isArray(doc.goals) ? doc.goals : [];
  b.metrics = Array.isArray(doc.metrics) ? doc.metrics : [];
  b.formulas = Array.isArray(doc.formulas) ? doc.formulas : [];
  return b;
}

/** Restores the same Board with its own ids (VSS VET-15 "hydrate"), unlike importBoard which makes a copy. */
export function hydrateBoard(doc) {
  if (!doc || typeof doc !== 'object' || !doc.axes || !Array.isArray(doc.items) || !Array.isArray(doc.estimates)) throw new Error('invalid');
  const [maj] = String(doc.schemaVersion || '0').split('.').map(Number);
  if (maj > 1) throw new Error('newer');
  const b = { ...newBoard(doc.title || ''), ...structuredClone(doc) };
  for (const key of ['out', 'in']) b.axes[key] = mergeAxis(doc.axes[key] || {}, key);
  if (!Array.isArray(b.itemTypes) || !b.itemTypes.length) b.itemTypes = [defaultType()];
  b.settings = { ...newBoard().settings, ...(doc.settings || {}) };
  return b;
}

/** Totals of a board for VSS (VS-8; CALC-4: null when nothing is estimated; CALC-5: no Infinity in JSON). */
export function flowTotals(board) {
  const items = board.items.filter((x) => !x.isReference);
  const outs = items.map((x) => valueOf(board, x.id, 'out')).filter((v) => v !== null);
  const ins = items.map((x) => valueOf(board, x.id, 'in')).filter((v) => v !== null);
  const sumOut = outs.length ? outs.reduce((a, b) => a + b, 0) : null;
  const sumIn = ins.length ? ins.reduce((a, b) => a + b, 0) : null;
  let priority = null, kind = 'not_estimated', note = null;
  if (board.priority === 'out') { if (sumOut !== null) { priority = sumOut; kind = 'finite'; } }
  else if (sumOut !== null && sumIn !== null) {
    if (board.priority === 'difference') { priority = sumOut - sumIn; kind = 'finite'; }
    else if (sumIn === 0) { kind = sumOut > 0 ? 'positive_infinity' : sumOut < 0 ? 'negative_infinity' : 'finite'; priority = kind === 'finite' ? 0 : null; }
    else if (sumIn < 0) { priority = sumOut - sumIn; kind = 'finite'; note = 'neg-in'; }
    else { priority = sumOut / sumIn; kind = 'finite'; }
  }
  const dist = (key) => board.axes[key].buckets.map((b) => ({ id: b.id, label: b.label, color: b.color, count: items.filter((x) => bucketOf(board.axes[key], valueOf(board, x.id, key))?.id === b.id).length }));
  return { totals: { count: items.length, sumOut, sumIn, priority, coverage: { out: outs.length, in: ins.length }, partial: outs.length < items.length || (board.priority !== 'out' && ins.length < items.length), buckets: { out: dist('out'), in: dist('in') } }, priorityKind: kind, note };
}

function mergeAxis(a, key) {
  const d = defaultAxis(key);
  const scale = { ...d.scale, ...(a.scale || {}) };
  if (!STEPS.includes(scale.step)) scale.step = 1;
  const axis = { ...d, ...a, key, scale, autoscale: { ...d.autoscale, ...(a.autoscale || {}) } };
  axis.buckets = Array.isArray(a.buckets) && a.buckets.length ? normalizeBuckets(axis, a.buckets.map((b) => ({ ...b }))) : defaultBuckets(scale);
  if (!axis.buckets.length) axis.buckets = defaultBuckets(scale);
  return axis;
}

/** Applies a configuration to a board (IO-12); items and estimates stay. */
export function applyConfig(board, cfg) {
  const [maj] = String(cfg.schemaVersion || '0').split('.').map(Number);
  if (maj > 1 || !cfg.axes) throw new Error(maj > 1 ? 'newer' : 'invalid');
  for (const key of ['out', 'in']) if (cfg.axes[key]) board.axes[key] = mergeAxis(cfg.axes[key], key);
  for (const k of ['priority', 'aggregation', 'view', 'lang']) if (cfg[k] !== undefined) board[k] = cfg[k];
  if (cfg.settings) board.settings = { ...board.settings, ...cfg.settings };
  if (Array.isArray(cfg.itemTypes) && cfg.itemTypes.length) {
    const ids = new Set(cfg.itemTypes.map((t) => t.id));
    board.items.forEach((it) => { if (!ids.has(it.typeId)) cfg.itemTypes.push(board.itemTypes.find((t) => t.id === it.typeId) || defaultType()); });
    board.itemTypes = cfg.itemTypes.filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i);
  }
  if (Array.isArray(cfg.goals)) board.goals = cfg.goals;
}

export function fileName(board, ext) {
  const base = (board.title || 'vet').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'vet';
  return `${base}_${new Date().toISOString().slice(0, 10)}.${ext}`;
}

// ---------- history (EL-5) ----------

export class History {
  constructor(limit = 100) { this.past = []; this.future = []; this.limit = limit; }
  push(snapshot) { this.past.push(snapshot); if (this.past.length > this.limit) this.past.shift(); this.future = []; }
  undo(current) { if (!this.past.length) return null; this.future.push(current); return this.past.pop(); }
  redo(current) { if (!this.future.length) return null; this.past.push(current); return this.future.pop(); }
}

// ---------- self-check (run in the console: import('./vet-core.js').then(m => m.selfTest())) ----------

export function selfTest() {
  const ok = [];
  const t = (name, cond) => { ok.push([name, !!cond]); };
  const b = newBoard('t');
  t('AX-12 buckets 1..20', JSON.stringify(b.axes.out.buckets.map((x) => [x.from, x.to])) === '[[1,4],[5,8],[9,12],[13,16],[17,20]]');
  const it = makeItem(b, { title: 'a' }); b.items.push(it);
  t('DM-5 code', it.code === 'VE-1');
  setEstimate(b, it.id, 'out', 14); setEstimate(b, it.id, 'in', 3);
  t('ratio 14/3', Math.abs(priorityOf(b, it).value - 14 / 3) < 1e-9);
  setEstimate(b, it.id, 'in', 0); t('DM-2 inf', priorityOf(b, it).value === Infinity);
  setEstimate(b, it.id, 'in', -2); t('DM-3 neg in', priorityOf(b, it).note === 'neg-in' && priorityOf(b, it).value === 16);
  setEstimate(b, it.id, 'out', 37); const ex = autoscaleBounds(b, 'out');
  t('AX-16 37 -> 50', ex && ex.max === 50 && ex.expanded); applyBounds(b.axes.out, ex);
  setEstimate(b, it.id, 'out', 9); const sh = autoscaleBounds(b, 'out');
  t('AX-19 shrink to 20', sh && sh.max === 20);
  t('niceUp 46.25 -> 50', niceUp(46.25, 1) === 50);
  t('paste', parsePaste('A-1;Title;5;2\nOnly title').length === 2);
  t('csv injection', toCSV(b, [{ ...it, title: '=cmd' }], () => 'T').includes("'=cmd"));
  const neg = { min: -10, max: 20, step: 1 };
  t('AX-10 anti buckets', defaultBuckets(neg).filter((x) => x.polarity === 'anti').length === 2);
  return ok;
}
