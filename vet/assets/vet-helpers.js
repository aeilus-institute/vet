/* VET helpers (TZ section on helpers, HP-1 ... HP-17): pure functions, no DOM.
   - references: estimated items marked as anchors (isReference) and the nearest ones while dragging (HP-1 ... HP-4);
   - metrics and formulas: a safe expression language without eval (HP-6 ... HP-10);
   - goals: a tree with "Why?" chains, weights, counts and sums (HP-12 ... HP-17). */

// ---------- formulas (HP-7) ----------

const FUNCS = {
  min: { n: [1, 99], f: (...a) => Math.min(...a) }, max: { n: [1, 99], f: (...a) => Math.max(...a) },
  round: { n: [1, 2], f: (x, d = 0) => { const k = 10 ** Math.max(0, Math.min(6, Math.trunc(d))); return Math.round(x * k) / k; } },
  abs: { n: [1, 1], f: (x) => Math.abs(x) }, sqrt: { n: [1, 1], f: (x) => Math.sqrt(x) }, log: { n: [1, 1], f: (x) => Math.log10(x) },
  if: { n: [3, 3], lazy: true },
};

/** Expression -> AST. Throws { pos, code } with code: char | end | paren | func | args | empty. */
export function parseFormula(src) {
  const s = String(src || '');
  const toks = [];
  const re = /\s*(?:(\d+(?:\.\d+)?(?:e[+-]?\d+)?)|([\p{L}_][\p{L}\p{N}_]*)|(>=|<=|==|!=|[-+*/^(),<>×÷]))/uy;
  let i = 0;
  while (i < s.length) {
    if (/\s/.test(s[i])) { i++; continue; }
    re.lastIndex = i;
    const m = re.exec(s);
    if (!m) throw { pos: i, code: 'char' };
    if (m[1]) toks.push({ k: 'num', v: Number(m[1]), pos: i }); // a dot only: the comma separates arguments
    else if (m[2]) toks.push({ k: 'id', v: m[2], pos: i });
    else toks.push({ k: 'op', v: m[3] === '×' ? '*' : m[3] === '÷' ? '/' : m[3], pos: i });
    i = re.lastIndex;
  }
  if (!toks.length) throw { pos: 0, code: 'empty' };
  let p = 0;
  const peek = () => toks[p], eat = (v) => { const tk = toks[p]; if (tk && tk.k === 'op' && tk.v === v) { p++; return true; } return false; };
  const fail = (code) => { throw { pos: toks[p] ? toks[p].pos : s.length, code }; };
  const cmp = () => { let a = add(); for (;;) { const tk = peek(); if (tk && tk.k === 'op' && ['>', '<', '>=', '<=', '==', '!='].includes(tk.v)) { p++; a = { t: 'bin', op: tk.v, a, b: add() }; } else return a; } };
  const add = () => { let a = mul(); for (;;) { if (eat('+')) a = { t: 'bin', op: '+', a, b: mul() }; else if (eat('-')) a = { t: 'bin', op: '-', a, b: mul() }; else return a; } };
  const mul = () => { let a = unary(); for (;;) { if (eat('*')) a = { t: 'bin', op: '*', a, b: unary() }; else if (eat('/')) a = { t: 'bin', op: '/', a, b: unary() }; else return a; } };
  const unary = () => (eat('-') ? { t: 'neg', a: unary() } : eat('+') ? unary() : pow());
  const pow = () => { const a = atom(); return eat('^') ? { t: 'bin', op: '^', a, b: unary() } : a; };
  const atom = () => {
    const tk = peek();
    if (!tk) fail('end');
    if (tk.k === 'num') { p++; return { t: 'num', v: tk.v }; }
    if (tk.k === 'id') {
      p++;
      if (eat('(')) {
        const fn = FUNCS[tk.v.toLowerCase()];
        if (!fn) throw { pos: tk.pos, code: 'func' };
        const args = [];
        if (!eat(')')) { do args.push(cmp()); while (eat(',')); if (!eat(')')) fail('paren'); }
        if (args.length < fn.n[0] || args.length > fn.n[1]) throw { pos: tk.pos, code: 'args' };
        return { t: 'call', f: tk.v.toLowerCase(), args };
      }
      return { t: 'var', v: tk.v };
    }
    if (eat('(')) { const e = cmp(); if (!eat(')')) fail('paren'); return e; }
    fail('char');
  };
  const ast = cmp();
  if (p < toks.length) fail('char');
  return ast;
}

/** Variable names used by an AST. */
export function formulaVars(ast, out = new Set()) {
  if (!ast) return out;
  if (ast.t === 'var') out.add(ast.v);
  for (const k of ['a', 'b']) if (ast[k]) formulaVars(ast[k], out);
  (ast.args || []).forEach((x) => formulaVars(x, out));
  return out;
}

/** Evaluates an AST with vars {name: number}; a missing variable or a non-finite result gives null. */
export function evalFormula(ast, vars) {
  const ev = (n) => {
    switch (n.t) {
      case 'num': return n.v;
      case 'var': { const v = vars[n.v]; if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('missing'); return v; }
      case 'neg': return -ev(n.a);
      case 'call': {
        if (n.f === 'if') return ev(n.args[0]) ? ev(n.args[1]) : ev(n.args[2]);
        return FUNCS[n.f].f(...n.args.map(ev));
      }
      default: {
        const a = ev(n.a), b = ev(n.b);
        switch (n.op) {
          case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return a / b; case '^': return a ** b;
          case '>': return +(a > b); case '<': return +(a < b); case '>=': return +(a >= b); case '<=': return +(a <= b); case '==': return +(a === b); case '!=': return +(a !== b);
        }
      }
    }
    return NaN;
  };
  try { const r = ev(ast); return Number.isFinite(r) ? r : null; } catch (e) { return null; }
}

/** HP-8: a raw result to the scale. direct = as is (rounded to the step); linear = [lo, hi] onto [min, max]; log = log10 between lo and hi (both clamped). */
export function mapToScale(raw, axis, map = {}) {
  if (raw === null || !Number.isFinite(raw)) return null;
  const s = axis.scale;
  let v = raw;
  const lo = Number(map.lo), hi = Number(map.hi);
  if (map.kind === 'linear' && Number.isFinite(lo) && Number.isFinite(hi) && hi !== lo) v = s.min + ((raw - lo) / (hi - lo)) * (s.max - s.min);
  else if (map.kind === 'log' && lo > 0 && hi > lo) v = s.min + ((Math.log10(Math.max(raw, lo)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * (s.max - s.min);
  v = Math.round(v / s.step) * s.step;
  if (map.kind !== 'linear' && map.kind !== 'log') return +v.toFixed(6); // "as is" may leave the scale: autoscale grows it (AX-7)
  return +Math.min(s.max, Math.max(s.min, v)).toFixed(6);
}

/** The formula of an axis on a board, or null. */
export const formulaOf = (board, axis) => (board.formulas || []).find((f) => f.axis === axis && String(f.expr || '').trim()) || null;

/** HP-6, HP-16: { raw, value, missing[] } for an item and an axis; value is on the scale. goalWeight = the highest weight of the item's goals. */
export function formulaValue(board, it, axisKey) {
  const fm = formulaOf(board, axisKey);
  if (!fm) return null;
  let ast;
  try { ast = parseFormula(fm.expr); } catch (e) { return { error: e, raw: null, value: null, missing: [] }; }
  const vars = { ...(it.metrics || {}) };
  const gw = Math.max(0, ...(it.goalIds || []).map((g) => (board.goals || []).find((x) => x.id === g)?.weight || 0));
  vars.goalWeight = gw || 1;
  const missing = [...formulaVars(ast)].filter((k) => typeof vars[k] !== 'number' || !Number.isFinite(vars[k]));
  const raw = missing.length ? null : evalFormula(ast, vars);
  return { raw, value: mapToScale(raw, board.axes[axisKey], fm.map), missing, error: null };
}

/** HP-10: templates. Names are { en, ru }; the UI shows the current language or English. */
export const FORMULA_TEMPLATES = {
  rice: {
    metrics: [{ key: 'reach', name: { en: 'Reach', ru: 'Охват' }, unit: '' }, { key: 'impact', name: { en: 'Impact (0.25-3)', ru: 'Влияние (0,25-3)' }, unit: '' },
      { key: 'confidence', name: { en: 'Confidence (0-1)', ru: 'Уверенность (0-1)' }, unit: '' }, { key: 'strategic', name: { en: 'Strategic coefficient', ru: 'Стратегический коэффициент' }, unit: '' },
      { key: 'effort', name: { en: 'Effort', ru: 'Трудозатраты' }, unit: '' }],
    formulas: [{ axis: 'out', expr: 'reach * impact * confidence * strategic', map: { kind: 'direct' } }, { axis: 'in', expr: 'effort', map: { kind: 'direct' } }],
  },
  valueEffort: {
    metrics: [{ key: 'value', name: { en: 'Value', ru: 'Ценность' }, unit: '' }, { key: 'effort', name: { en: 'Effort', ru: 'Трудозатраты' }, unit: '' }],
    formulas: [{ axis: 'out', expr: 'value', map: { kind: 'direct' } }, { axis: 'in', expr: 'effort', map: { kind: 'direct' } }],
  },
  wsjf: {
    metrics: [{ key: 'business', name: { en: 'User / business value', ru: 'Ценность для бизнеса' }, unit: '' }, { key: 'time', name: { en: 'Time criticality', ru: 'Критичность по времени' }, unit: '' },
      { key: 'risk', name: { en: 'Risk reduction / opportunity', ru: 'Снижение риска / возможность' }, unit: '' }, { key: 'size', name: { en: 'Job size', ru: 'Размер работы' }, unit: '' }],
    formulas: [{ axis: 'out', expr: 'business + time + risk', map: { kind: 'direct' } }, { axis: 'in', expr: 'size', map: { kind: 'direct' } }],
  },
};

// ---------- references (HP-1 ... HP-4) ----------

/** The nearest reference below and above a value on an axis (HP-4). */
export function nearestRefs(board, key, v, valueOf) {
  let below = null, above = null;
  for (const it of board.items) {
    if (!it.isReference) continue;
    const r = valueOf(board, it.id, key);
    if (r === null || !Number.isFinite(r)) continue;
    if (r <= v && (!below || r > below.v)) below = { it, v: r };
    if (r >= v && (!above || r < above.v)) above = { it, v: r };
  }
  if (below && above && below.it === above.it) above = null;
  return { below, above };
}

// ---------- goals (HP-12 ... HP-17) ----------

export const goalById = (board, id) => (board.goals || []).find((g) => g.id === id) || null;

/** "Why?" (HP-13): the chain from a goal to its root; cycle-safe. */
export function goalChain(board, id) {
  const out = [], seen = new Set();
  let g = goalById(board, id);
  while (g && !seen.has(g.id)) { out.push(g); seen.add(g.id); g = g.parentId ? goalById(board, g.parentId) : null; }
  return out;
}

/** The goal and all goals below it. */
export function goalSubtree(board, id) {
  const ids = new Set([id]);
  let grew = true;
  while (grew) { grew = false; for (const g of board.goals || []) if (g.parentId && ids.has(g.parentId) && !ids.has(g.id)) { ids.add(g.id); grew = true; } }
  return ids;
}

/** Setting `parentId` on goal `id` would make a cycle. */
export const goalCycle = (board, id, parentId) => !!parentId && goalSubtree(board, id).has(parentId);

/** Goals as a depth-first list [{ goal, depth }] (roots first, children under their parent). */
export function goalTree(board) {
  const goals = board.goals || [], ids = new Set(goals.map((g) => g.id));
  const kids = new Map();
  for (const g of goals) { const p = g.parentId && ids.has(g.parentId) ? g.parentId : ''; if (!kids.has(p)) kids.set(p, []); kids.get(p).push(g); }
  const out = [], seen = new Set();
  const walk = (p, depth) => { for (const g of kids.get(p) || []) { if (seen.has(g.id)) continue; seen.add(g.id); out.push({ goal: g, depth }); walk(g.id, depth + 1); } };
  walk('', 0);
  for (const g of goals) if (!seen.has(g.id)) out.push({ goal: g, depth: 0 }); // a broken cycle still shows
  return out;
}

/** HP-14: per goal (with its subtree) the number of items and the sum of "out"; items without a goal (HP-15). */
export function goalStats(board, items, valueOf) {
  const stats = new Map();
  for (const { goal } of goalTree(board)) {
    const sub = goalSubtree(board, goal.id);
    const list = items.filter((it) => (it.goalIds || []).some((g) => sub.has(g)));
    stats.set(goal.id, { count: list.length, sumOut: list.reduce((s, it) => { const v = valueOf(board, it.id, 'out'); return s + (v !== null && Number.isFinite(v) ? v : 0); }, 0) });
  }
  const known = new Set((board.goals || []).map((g) => g.id));
  const loose = items.filter((it) => !(it.goalIds || []).some((g) => known.has(g)));
  return { stats, none: { count: loose.length, sumOut: loose.reduce((s, it) => { const v = valueOf(board, it.id, 'out'); return s + (v !== null && Number.isFinite(v) ? v : 0); }, 0) } };
}

/** HP-17: the `.vet-goals.json` document and its reader (ids kept, unknown parents dropped). */
export function goalsDoc(board) { return { schemaVersion: '1.0', kind: 'vet-goals', goals: structuredClone(board.goals || []) }; }
export function readGoals(doc) {
  if (!doc || doc.kind !== 'vet-goals' || !Array.isArray(doc.goals)) return null;
  const goals = doc.goals.filter((g) => g && typeof g.id === 'string' && g.id && typeof g.title === 'string').map((g) => ({
    id: g.id, title: g.title.slice(0, 200), desiredState: String(g.desiredState || '').slice(0, 1000), measure: String(g.measure || '').slice(0, 500),
    parentId: typeof g.parentId === 'string' ? g.parentId : null, weight: Math.min(5, Math.max(1, Math.round(Number(g.weight) || 3))) }));
  const ids = new Set(goals.map((g) => g.id));
  goals.forEach((g) => { if (g.parentId && !ids.has(g.parentId)) g.parentId = null; });
  return goals;
}
