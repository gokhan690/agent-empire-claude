// Player value (€) and fair wage curves. All numbers in BAL.value / BAL.wage.
import { BAL } from './constants.js';
import { tidy } from './util.js';

/** League wage multiplier. */
export function leagueWageMult(leagueId) { return BAL.leagueWageMult[leagueId] || 1; }

/**
 * Fair monthly wage (€) for player `p` at a club of league `leagueId`.
 * @param {object} S state (unused, kept for contract symmetry)
 * @param {{ca:number}} p
 * @param {string} leagueId
 */
export function fairWage(S, p, leagueId) {
  const w = BAL.wage.base * Math.exp(BAL.wage.k * (p.ca - BAL.wage.ref)) * leagueWageMult(leagueId);
  return Math.max(BAL.wage.min, Math.round(w / 100) * 100);
}

function ageMult(age) {
  for (const [maxAge, m] of BAL.value.ageMult) if (age <= maxAge) return m;
  return BAL.value.ageMult[BAL.value.ageMult.length - 1][1];
}

/** Market value (€) of player `p` right now (uses true `pa`: the market knows more than you do). */
export function playerValue(S, p) {
  const V = BAL.value;
  let v = V.base * Math.exp(V.k * (p.ca - V.ref)) * ageMult(p.age);
  const gap = Math.max(0, p.pa - p.ca);
  if (p.age <= V.potMaxAge) v *= 1 + V.potW * gap;
  const yrs = Math.max(0, Math.min(V.contractMult.length - 1, p.contractEnd - S.time.season));
  v *= V.contractMult[yrs];
  v *= 1 + (p.hype || 0) / V.hypeDiv;
  return Math.min(V.cap, Math.max(V.min, tidy(v)));
}

/** Recompute `value` of every player (call monthly). */
export function refreshValues(S) {
  for (const id in S.players) { const p = S.players[id]; p.value = playerValue(S, p); }
}
