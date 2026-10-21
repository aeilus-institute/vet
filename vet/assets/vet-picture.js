/* Picture of the current VET view (FMT-png, SHOULD): the scales (1D) or the plane (2D) drawn as SVG from the board
   data, not a screenshot of the DOM. PNG is the same SVG rasterised on a canvas. Loaded lazily (NF-3). */

const NS = 'http://www.w3.org/2000/svg';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const FONT = 'font-family="Inter, Segoe UI, Arial, sans-serif"';

/** opts: { C, view: '1d'|'2d', axisName(key), typeColor(typeId), lang, title, xKey, yKey, items } -> SVG text. */
export function boardSvg(board, opts) {
  return opts.view === '2d' ? plane(board, opts) : scales(board, opts);
}

function domain(axis) { const s = axis.scale; return [s.min - s.step / 2, s.max + s.step / 2]; }

function scales(board, { C, axisName, typeColor, lang, title, items }) {
  const W = 1200, pad = 40, keys = board.priority === 'out' ? ['out'] : ['out', 'in'];
  const blocks = [];
  let y = 70;
  for (const key of keys) {
    const axis = board.axes[key], [a, b] = domain(axis);
    const x = (v) => pad + ((Math.min(b, Math.max(a, v)) - a) / (b - a)) * (W - 2 * pad);
    const placed = items.map((it) => ({ it, v: C.valueOf(board, it.id, key) })).filter((p) => p.v !== null && Number.isFinite(p.v)).sort((p, q) => p.v - q.v);
    const lanes = []; // stack markers that would overlap (UI-3)
    for (const p of placed) { const px = x(p.v); let lane = 0; while (lanes[lane] !== undefined && px - lanes[lane] < 58) lane++; lanes[lane] = px; p.lane = lane; p.px = px; }
    const g = [`<text x="${pad}" y="${y}" font-size="16" font-weight="700" ${FONT} fill="#10201c">${esc(axisName(key))}</text>`];
    const band = y + 20 + lanes.length * 26 + 10;
    for (const p of placed) {
      const my = band - 14 - p.lane * 26;
      g.push(`<line x1="${p.px}" y1="${my + 10}" x2="${p.px}" y2="${band}" stroke="#9aa9a6" stroke-width="1"/>`,
        `<rect x="${p.px - 27}" y="${my - 10}" width="54" height="20" rx="10" fill="#fff" stroke="${esc(typeColor(p.it.typeId))}" stroke-width="2"/>`,
        `<text x="${p.px}" y="${my + 4}" font-size="11" font-weight="700" text-anchor="middle" ${FONT} fill="#10201c">${esc((p.it.polarity === 'anti' ? '−' : '') + p.it.code)}</text>`);
    }
    for (const bk of axis.buckets) {
      const l = x(bk.from - axis.scale.step / 2), r = x(bk.to + axis.scale.step / 2);
      g.push(`<rect x="${l}" y="${band}" width="${Math.max(0, r - l)}" height="26" fill="${esc(bk.color)}"/>`,
        `<text x="${(l + r) / 2}" y="${band + 17}" font-size="11" font-weight="700" text-anchor="middle" ${FONT} fill="#fff" stroke="rgba(0,0,0,.45)" stroke-width="2.5" paint-order="stroke">${esc(bk.label)}</text>`);
    }
    const s = axis.scale, every = Math.max(s.step, C.roundTo((s.max - s.min) / 10, s.step));
    for (let v = s.min; v <= s.max + 1e-9; v += every) g.push(`<text x="${x(v)}" y="${band + 42}" font-size="11" text-anchor="middle" ${FONT} fill="#4b5a57">${esc(C.fmtNum(v, lang, false))}</text>`);
    blocks.push(g.join(''));
    y = band + 70;
  }
  const H = y;
  return svgDoc(W, H, `<text x="${pad}" y="34" font-size="20" font-weight="700" ${FONT} fill="#10201c">${esc(title)}</text>` + blocks.join(''));
}

function plane(board, { C, axisName, typeColor, lang, title, xKey, yKey, items }) {
  const W = 1000, H = 1000, L = 90, T = 70, S = 820;
  const X = board.axes[xKey], Y = board.axes[yKey];
  const [xa, xb] = domain(X), [ya, yb] = domain(Y);
  const px = (v) => L + ((Math.min(xb, Math.max(xa, v)) - xa) / (xb - xa)) * S;
  const py = (v) => T + S - ((Math.min(yb, Math.max(ya, v)) - ya) / (yb - ya)) * S;
  const g = [`<text x="${L}" y="40" font-size="20" font-weight="700" ${FONT} fill="#10201c">${esc(title)}</text>`,
    `<rect x="${L}" y="${T}" width="${S}" height="${S}" fill="#fbfcfc" stroke="#cfd8d6"/>`,
    `<line x1="${L + S / 2}" y1="${T}" x2="${L + S / 2}" y2="${T + S}" stroke="#cfd8d6" stroke-dasharray="4 4"/>`,
    `<line x1="${L}" y1="${T + S / 2}" x2="${L + S}" y2="${T + S / 2}" stroke="#cfd8d6" stroke-dasharray="4 4"/>`];
  const q = board.settings.quadrants || {};
  const ql = (txt, x, y, anchor) => (txt ? `<text x="${x}" y="${y}" font-size="12" font-weight="700" text-anchor="${anchor}" ${FONT} fill="#7b8a87">${esc(String(txt).toUpperCase())}</text>` : '');
  g.push(ql(q.tl, L + 10, T + 20, 'start'), ql(q.tr, L + S - 10, T + 20, 'end'), ql(q.bl, L + 10, T + S - 10, 'start'), ql(q.br, L + S - 10, T + S - 10, 'end'));
  for (const bk of X.buckets) { const l = px(bk.from - X.scale.step / 2), r = px(bk.to + X.scale.step / 2); g.push(`<rect x="${l}" y="${T + S + 6}" width="${Math.max(0, r - l)}" height="14" fill="${esc(bk.color)}"/>`); }
  for (const bk of Y.buckets) { const t2 = py(bk.to + Y.scale.step / 2), b2 = py(bk.from - Y.scale.step / 2); g.push(`<rect x="${L - 20}" y="${t2}" width="14" height="${Math.max(0, b2 - t2)}" fill="${esc(bk.color)}"/>`); }
  g.push(`<text x="${L + S / 2}" y="${T + S + 52}" font-size="14" font-weight="700" text-anchor="middle" ${FONT} fill="#10201c">${esc(axisName(xKey))} →</text>`,
    `<text x="${L - 52}" y="${T + S / 2}" font-size="14" font-weight="700" text-anchor="middle" ${FONT} fill="#10201c" transform="rotate(-90 ${L - 52} ${T + S / 2})">${esc(axisName(yKey))} →</text>`);
  for (const [axis, f, horizontal] of [[X, px, true], [Y, py, false]]) {
    const s = axis.scale, every = Math.max(s.step, C.roundTo((s.max - s.min) / 8, s.step));
    for (let v = s.min; v <= s.max + 1e-9; v += every) g.push(horizontal
      ? `<text x="${f(v)}" y="${T + S + 34}" font-size="11" text-anchor="middle" ${FONT} fill="#4b5a57">${esc(C.fmtNum(v, lang, false))}</text>`
      : `<text x="${L - 26}" y="${f(v) + 4}" font-size="11" text-anchor="end" ${FONT} fill="#4b5a57">${esc(C.fmtNum(v, lang, false))}</text>`);
  }
  const seen = new Map();
  for (const it of items) {
    const vx = C.valueOf(board, it.id, xKey), vy = C.valueOf(board, it.id, yKey);
    if (vx === null || vy === null || !Number.isFinite(vx) || !Number.isFinite(vy)) continue;
    const k = vx + ':' + vy, n = seen.get(k) || 0; seen.set(k, n + 1);
    const cx = px(vx) + n * 6, cy = py(vy) - n * 6;
    g.push(`<rect x="${cx - 27}" y="${cy - 10}" width="54" height="20" rx="10" fill="#fff" stroke="${esc(typeColor(it.typeId))}" stroke-width="2"/>`,
      `<text x="${cx}" y="${cy + 4}" font-size="11" font-weight="700" text-anchor="middle" ${FONT} fill="#10201c">${esc((it.polarity === 'anti' ? '−' : '') + it.code)}</text>`);
  }
  return svgDoc(W, H, g.join(''));
}

function svgDoc(w, h, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="${NS}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#fff"/>${body}</svg>`;
}

/** SVG text -> PNG Blob at `scale` (1 or 2). */
export function svgToPng(svg, scale = 2) {
  return new Promise((resolve, reject) => {
    const m = /width="(\d+)" height="(\d+)"/.exec(svg);
    const w = +m[1], h = +m[2];
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale;
      const g = c.getContext('2d'); g.scale(scale, scale); g.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('png')); };
    img.src = url;
  });
}
