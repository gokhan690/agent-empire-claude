// Global store. `store.S` = engine state (null until a game exists), `store.ui` = overlay/sheet manager.
// Engine facade (../engine/game.js): newGame, act, advance, serialize, deserialize — loaded by store.init() with a
// defensive dynamic import so the gallery still boots when the engine is missing/broken.
import { useState, useEffect, useRef } from './lib.js';
import { toast } from './components/Toast.js';
import { audio } from './fx/audio.js';

const KEY = 'kulis-save-v1';
let engine = null;
const subs = new Set();
const evSubs = new Set();

const notify = () => { store.rev++; subs.forEach((f) => f()); };
const lsGet = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const save = () => {
  try { if (engine && store.S) localStorage.setItem(KEY, toStr(engine.serialize(store.S))); } catch (e) { console.warn('autosave failed', e); }
};
const toStr = (x) => (typeof x === 'string' ? x : JSON.stringify(x));
const fail = (error) => ({ ok: false, error });
const emitEvents = (events) => { if (events && events.length) evSubs.forEach((f) => { try { f(events); } catch (e) { console.error(e); } }); };

export const store = {
  S: null,
  rev: 0,
  engineError: null,
  /** Overlay / sheet manager. Screens call store.ui.openOverlay('Negotiation', {…}) — app.js renders them; never edit app.js. */
  ui: {
    overlay: null,   // { name, props } | null  (one full-screen overlay at a time; name from app.js OVERLAYS registry)
    sheets: [],      // stack of { name, props }  (name from app.js SHEETS registry)
    openOverlay(name, props = {}) { store.ui.overlay = { name, props, key: Math.random() }; notify(); },
    closeOverlay() { if (store.ui.overlay) { store.ui.overlay = null; notify(); } },
    openSheet(name, props = {}) { store.ui.sheets = [...store.ui.sheets, { name, props, key: Math.random() }]; notify(); },
    closeSheet() { if (store.ui.sheets.length) { store.ui.sheets = store.ui.sheets.slice(0, -1); notify(); } },
    closeAllSheets() { store.ui.sheets = []; notify(); },
  },

  /** Load the engine facade (once). Safe to call repeatedly. Resolves true when the engine is usable. */
  async init() {
    if (engine) return true;
    try {
      engine = await import('../engine/game.js');
      for (const k of ['newGame', 'act', 'advance', 'serialize', 'deserialize']) if (typeof engine[k] !== 'function') throw new Error('engine.' + k + ' eksik');
      return true;
    } catch (e) { engine = null; store.engineError = e; console.warn('[kulis] engine unavailable:', e && e.message); return false; }
  },
  get hasEngine() { return !!engine; },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  /** Subscribe to engine `events` arrays emitted after every successful act()/advance(). Returns unsubscribe. */
  onEvents(fn) { evSubs.add(fn); return () => evSubs.delete(fn); },
  notify,

  newGame(opts = {}) {
    if (!engine) return fail('Oyun motoru yüklenemedi');
    store.S = engine.newGame(opts);
    save(); notify();
    return { ok: true, events: [] };
  },
  /** Run an engine action. Returns the engine Result. Autosaves, notifies, toasts + error sfx on ok:false. */
  act(id, payload = {}) {
    if (!engine || !store.S) return fail('Oyun başlamadı');
    let r;
    try { r = engine.act(store.S, id, payload); } catch (e) { console.error(e); r = fail('Beklenmeyen bir hata oldu'); }
    if (!r || r.ok === false) { toast.error((r && r.error) || 'Yapılamadı'); }
    else { save(); emitEvents(r.events); }
    notify();
    return r;
  },
  /**
   * Press "Ayı Oynat". Returns the MonthReport. Default routing (pass {silent:true} to skip):
   * report.phase === 'deadline' -> overlay 'Deadline'; otherwise -> overlay 'Playback' with { report }.
   */
  advance({ silent = false } = {}) {
    if (!engine || !store.S) return fail('Oyun başlamadı');
    let r;
    try { r = engine.advance(store.S); } catch (e) { console.error(e); r = fail('Beklenmeyen bir hata oldu'); }
    if (!r || r.ok === false) { toast.error((r && r.error) || 'Ay oynatılamadı'); notify(); return r; }
    save(); emitEvents(r.events);
    if (!silent) { if (r.phase === 'deadline') store.ui.openOverlay('Deadline', { report: r }); else store.ui.openOverlay('Playback', { report: r }); }
    notify();
    return r;
  },
  hasSave() { return !!lsGet(); },
  load() {
    if (!engine) return fail('Oyun motoru yüklenemedi');
    const raw = lsGet();
    if (!raw) return fail('Kayıt bulunamadı');
    try { store.S = engine.deserialize(raw); notify(); return { ok: true, events: [] }; } catch (e) { console.error(e); return fail('Kayıt okunamadı'); }
  },
  exportJSON() { return engine && store.S ? toStr(engine.serialize(store.S)) : ''; },
  importJSON(text) {
    if (!engine) return fail('Oyun motoru yüklenemedi');
    try { store.S = engine.deserialize(text); save(); notify(); return { ok: true, events: [] }; } catch (e) { return fail('Geçersiz kayıt dosyası'); }
  },
  /** Delete the save and return to "no game" state (app shows onboarding). */
  reset() {
    try { localStorage.removeItem(KEY); } catch {}
    store.S = null; store.ui.overlay = null; store.ui.sheets = [];
    notify();
  },
};

/**
 * useStore(selector) — re-renders when the selected value changes (primitives) or on any store change (objects,
 * since S is mutated in place). `useStore(s => s.S && s.S.agency.cash)`. Without a selector returns the store.
 */
export function useStore(selector = (s) => s) {
  const [, force] = useState(0);
  const last = useRef();
  const sel = useRef(selector); sel.current = selector;
  useEffect(() => {
    const f = () => {
      let v; try { v = sel.current(store); } catch { v = undefined; }
      const prim = v === null || (typeof v !== 'object' && typeof v !== 'function');
      if (prim && Object.is(v, last.current)) return;
      force((n) => n + 1);
    };
    return store.subscribe(f);
  }, []);
  let v; try { v = selector(store); } catch { v = undefined; }
  last.current = v;
  return v;
}

export const openOverlay = (n, p) => store.ui.openOverlay(n, p);
export const closeOverlay = () => store.ui.closeOverlay();
export const openSheet = (n, p) => store.ui.openSheet(n, p);
export const closeSheet = () => store.ui.closeSheet();
export { audio };
