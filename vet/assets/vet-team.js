/* VET team mode (TZ 6.2 MO-5 ... MO-15): one board on the server, many participants.
   The editor keeps working on a local Board; this module sends the differences against the last server state
   (facilitator: whole top-level keys and single items, MO-10; everybody: own estimates) and polls for other people's
   changes every 2 s (10 s in a hidden tab; realtime fallback, docs/TOOLS_TEAM_ARCHITECTURE.md section 4). */

const POLL = 2000, POLL_HIDDEN = 10000, DEBOUNCE = 600;
/** Personal view preferences: never sent, kept locally when a server state arrives. */
const LOCAL_SETTINGS = ['swapAxes', 'guides'];

export function createTeam({ C, api, id, onRemote, onStatus, onError }) {
  const team = {
    on: true, id, view: null, server: null, revision: 0, status: 'saved', savedAt: null, busy: false, pending: false,
    get role() { return team.view?.me?.role || 'viewer'; },
    get closed() { return team.view?.status === 'closed'; },
    get mode() { return team.view?.settings?.mode || 'open'; },
    get revealed() { return !!team.view?.settings?.revealed; },
    get canEstimate() { return !team.closed && (team.role === 'estimator' || team.role === 'facilitator'); },
    get canEdit() { return !team.closed && team.role === 'facilitator'; },
    /** Other people's estimates are visible (open mode, after "Reveal", or a closed session). */
    get othersVisible() { return team.mode === 'open' || team.revealed || team.closed; },
  };
  let timer = null, poller = null, inflight = null;

  const setStatus = (s) => { team.status = s; if (s === 'saved') team.savedAt = new Date(); onStatus && onStatus(s); };

  /** Server view -> a Board for the editor (same ids, axes normalised by the core). */
  function toBoard(view) {
    const b = C.hydrateBoard({ ...view.doc, id: view.id, mode: 'team' });
    b.finals = view.doc.finals || {};
    return b;
  }

  function apply(view) {
    team.view = view;
    team.revision = view.revision;
    C.setMe(view.settings.mode === 'shared' ? 'shared' : view.me.participantId);
    team.server = toBoard(view);
    return structuredClone(team.server);
  }

  async function load() {
    const view = await api.get(`/boards/${id}`);
    const b = apply(view);
    startPolling();
    return b;
  }

  const sameJSON = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const settingsOf = (s) => { const x = { ...(s || {}) }; LOCAL_SETTINGS.forEach((k) => delete x[k]); return x; };

  /** What the local board changed against the server state, split by who may send it. */
  function diff(board, base = team.server) {
    const s = base;
    const set = {};
    for (const k of C.TEAM_KEYS) {
      const a = k === 'settings' ? settingsOf(board[k]) : board[k], b = k === 'settings' ? settingsOf(s[k]) : s[k];
      if (!sameJSON(a, b)) set[k] = k === 'settings' ? { ...s.settings, ...a } : a;
    }
    const prev = new Map(s.items.map((x) => [x.id, x]));
    const upsert = board.items.filter((x) => !sameJSON(x, prev.get(x.id)));
    const ids = new Set(board.items.map((x) => x.id));
    const del = s.items.filter((x) => !ids.has(x.id)).map((x) => x.id);
    const me = C.me();
    const key = (e) => e.itemId + '|' + e.axis;
    const mine = new Map(board.estimates.filter((e) => e.participantId === me).map((e) => [key(e), e]));
    const was = new Map(s.estimates.filter((e) => e.participantId === me).map((e) => [key(e), e]));
    const est = [];
    for (const [k, e] of mine) if (!was.has(k) || was.get(k).value !== e.value) est.push({ itemId: e.itemId, axis: e.axis, value: e.value, source: e.source });
    for (const [k, e] of was) if (!mine.has(k)) est.push({ itemId: e.itemId, axis: e.axis, value: null });
    // estimates of items that are deleted in this same step are removed by the server with the items
    const structural = Object.keys(set).length > 0 || upsert.length > 0 || del.length > 0;
    return { set, upsert, delete: del, estimates: est.filter((e) => !del.includes(e.itemId)), structural };
  }

  /** Is this one change (before -> after) allowed for the role? The editor reverts it otherwise. Only what the action itself
      changed counts, not older local differences such as a local autoscale. */
  function allowed(board, before = team.server) {
    const d = diff(board, before);
    if (d.structural && !team.canEdit) return false;
    if (d.estimates.length && !team.canEstimate) return false;
    return true;
  }

  function queue(getBoard) {
    team.pending = true;
    clearTimeout(timer);
    timer = setTimeout(() => flush(getBoard), DEBOUNCE);
    setStatus('saving');
  }

  async function flush(getBoard) {
    if (inflight) { await inflight.catch(() => {}); }
    const board = getBoard();
    const sent = JSON.stringify(board);
    const d = diff(board);
    team.pending = false;
    if (!d.structural && !d.estimates.length) { setStatus('saved'); return; }
    inflight = (async () => {
      const base = team.revision;
      let conflicts = [];
      if (d.structural && team.canEdit) {
        const r = await api.patch(`/boards/${id}`, { set: d.set, upsert: d.upsert, delete: d.delete }, { 'If-Match': String(base) });
        conflicts = r.conflicts || [];
      }
      if (d.estimates.length && team.canEstimate) await api.put(`/boards/${id}/estimates`, { estimates: d.estimates });
      const view = await api.get(`/boards/${id}`);
      const fresh = apply(view);
      // what the user did while the request was running stays local and goes with the next flush
      onRemote(fresh, { own: true, conflicts, sent });
      setStatus(conflicts.length ? 'conflict' : 'saved');
    })();
    try { await inflight; }
    catch (e) {
      setStatus(e.status === 0 ? 'offline' : 'error');
      team.pending = true; // retried by the poller (MO-9: changes wait for the connection)
      onError && onError(e);
    } finally { inflight = null; }
  }

  async function poll(getBoard) {
    if (team.busy || inflight) return;
    if (team.pending || team.status === 'offline' || team.status === 'error') { await flush(getBoard); return; }
    try {
      const r = await api.get(`/boards/${id}/changes?since=${team.revision}`);
      if (team.status === 'offline') setStatus('saved');
      team.view && (team.view.participants = r.participants || team.view.participants);
      if (r.changed && !team.pending && !team.busy) onRemote(apply(r), { own: false });
      else if (!r.changed) onStatus && onStatus(team.status);
    } catch (e) { if (e.status === 0) setStatus('offline'); else onError && onError(e); }
  }

  let getB = null;
  function startPolling(getBoard) {
    if (getBoard) getB = getBoard;
    clearTimeout(poller);
    const tick = async () => {
      if (getB) await poll(getB);
      poller = setTimeout(tick, document.hidden ? POLL_HIDDEN : POLL);
    };
    poller = setTimeout(tick, POLL);
  }

  /** Facilitator actions: reveal / hide / close / reopen (MO-11, MO-13). */
  async function action(what) { await api.post(`/boards/${id}/${what}`); const fresh = apply(await api.get(`/boards/${id}`)); onRemote(fresh, { own: true }); }
  async function settings(patch) { await api.patch(`/boards/${id}/settings`, patch); const fresh = apply(await api.get(`/boards/${id}`)); onRemote(fresh, { own: true }); }
  async function newLink(role) { const r = await api.post(`/boards/${id}/links`, { role }); team.view.links = r.links; return r.links; }
  async function revokeLink(linkId) { const r = await api.del(`/boards/${id}/links/${linkId}`); team.view.links = r.links; return r.links; }
  async function versions() { return (await api.get(`/boards/${id}/versions`)).versions; }
  async function restore(v) { await api.post(`/boards/${id}/versions/${v}/restore`); const fresh = apply(await api.get(`/boards/${id}`)); onRemote(fresh, { own: true }); }

  /** Local view preferences survive a server state. */
  function keepLocal(fresh, local) {
    if (local && local.settings) for (const k of LOCAL_SETTINGS) fresh.settings[k] = local.settings[k];
    if (local) fresh.view = local.view;
    return fresh;
  }

  window.addEventListener('beforeunload', (e) => { if (team.pending || inflight) { e.preventDefault(); e.returnValue = ''; } });
  return Object.assign(team, { load, queue, flush, allowed, diff, startPolling, action, settings, newLink, revokeLink, versions, restore, keepLocal });
}

/** Solo -> team (MO-5): uploads the board; the solo estimates become the creator's. Returns the new board id. */
export async function shareBoard(api, board) {
  const doc = structuredClone(board);
  doc.estimates = doc.estimates.map((e) => ({ itemId: e.itemId, axis: e.axis, value: e.value, source: e.source }));
  delete doc.participants;
  const r = await api.post('/boards', { doc });
  return r.id;
}
