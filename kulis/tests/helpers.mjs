import { newGame, advance, act } from '../src/engine/game.js';
import { myClients } from '../src/engine/selectors.js';

export const LEAGUES = ['tr2', 'tr1', 'nl1', 'it1', 'es1', 'en1'];

/** Walk S and throw on NaN / Infinity / undefined / functions. */
export function assertClean(v, path = 'S') {
  const t = typeof v;
  if (t === 'number') { if (!Number.isFinite(v)) throw new Error('bad number at ' + path + ' = ' + v); return; }
  if (t === 'undefined' || t === 'function') throw new Error('bad ' + t + ' at ' + path);
  if (v === null || t !== 'object') return;
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) assertClean(v[i], path + '[' + i + ']'); return; }
  for (const k in v) assertClean(v[k], path + '.' + k);
}

/** Keep the career alive in headless sims: cash topped up and at least one client. */
export function keepAlive(S) {
  S.agency.cash = Math.max(S.agency.cash, 5e6);
  if (S.time.phase === 'over') return;
  for (const p of myClients(S)) { p.loyalty = Math.max(p.loyalty, 60); if (p.rep) p.rep.endSeason = Math.max(p.rep.endSeason, S.time.season + 1); }
  if (myClients(S).length === 0) {
    const p = Object.values(S.players).find(q => !q.agentId && q.age <= 22);
    p.agentId = 'you'; p.rep = { commissionPct: 7, endSeason: S.time.season + 2 };
  }
}

/** Play `months` months; deadline phases are finished automatically. */
export function play(S, months, onMonth) {
  let r;
  for (let i = 0; i < months; i++) {
    keepAlive(S);
    r = advance(S);
    if (r.phase === 'deadline') { act(S, 'deadlineFinish'); r = advance(S); }
    if (!r.ok) throw new Error('advance failed: ' + r.error);
    if (onMonth) onMonth(r, i);
    if (S.time.phase === 'over') return r;
  }
  return r;
}
export { newGame, advance };
