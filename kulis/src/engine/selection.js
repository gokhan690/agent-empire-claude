// Line-ups (1-4-4-2 + 3 subs) and minutes projection.
import { BAL, POS, POS_ORDER } from './constants.js';
import { gauss } from './rng.js';
import { mean } from './util.js';

/** Map clubId → array of player objects (one scan over S.players). */
export function squadIndex(S) {
  const idx = {};
  for (const id in S.clubs) idx[id] = [];
  for (const id in S.players) {
    const p = S.players[id];
    if (p.clubId && idx[p.clubId]) idx[p.clubId].push(p);
  }
  return idx;
}

/** Selection score of a player for a given club (higher = more likely to start). */
export function selScore(S, p, club, noise) {
  const B = BAL.sel;
  let s = p.ca + p.form * B.formW;
  if (p.age <= B.youthMaxAge) s += B.youthStep * (club.youthTrust - 2);
  if (noise) s += gauss(S, 0, B.noiseSd);
  return s;
}

/**
 * Pick XI + subs for a club.
 * @returns {{xi: object[], subs: object[]}} players (xi has exactly 11 when the squad allows)
 */
export function pickLineup(S, club, squad, noise = false) {
  const sc = new Map();
  const pool = [];
  for (const p of squad) { if (!p.injured) { pool.push(p); sc.set(p.id, selScore(S, p, club, noise)); } }
  if (pool.length < 11) {
    const inj = squad.filter(p => p.injured).sort((a, b) => b.ca - a.ca);
    for (const p of inj) { if (pool.length >= 11) break; pool.push(p); sc.set(p.id, selScore(S, p, club, noise) - 20); }
  }
  const xi = [];
  const used = new Set();
  const missing = [];
  for (const pos of POS_ORDER) {
    const list = pool.filter(p => p.pos === pos).sort((a, b) => sc.get(b.id) - sc.get(a.id));
    const n = POS[pos].slots;
    for (let i = 0; i < n; i++) {
      if (list[i]) { xi.push(list[i]); used.add(list[i].id); } else missing.push(pos);
    }
  }
  if (missing.length) {
    const rest = pool.filter(p => !used.has(p.id) && p.pos !== 'KL').sort((a, b) => sc.get(b.id) - sc.get(a.id));
    for (const pos of missing) {
      let cand = pos === 'KL' ? rest.find(() => true) : rest.find(p => !used.has(p.id));
      if (!cand) cand = pool.find(p => !used.has(p.id));
      if (cand) { xi.push(cand); used.add(cand.id); sc.set(cand.id, sc.get(cand.id) - BAL.sel.outOfPos); }
    }
  }
  const left = pool.filter(p => !used.has(p.id)).sort((a, b) => sc.get(b.id) - sc.get(a.id));
  const subs = [];
  const gk = left.find(p => p.pos === 'KL');
  if (gk) subs.push(gk);
  for (const p of left) { if (subs.length >= BAL.sel.subs) break; if (!subs.includes(p)) subs.push(p); }
  return { xi, subs, sc };
}

/** Deterministic strength: average CA of the best XI (no noise). */
export function clubStrength(S, clubId, squad) {
  const club = S.clubs[clubId];
  const sq = squad || squadOf(S, clubId);
  const { xi } = pickLineup(S, club, sq, false);
  return xi.length ? mean(xi.map(p => p.ca)) : 0;
}

/** Players of a club (scan). */
export function squadOf(S, clubId) {
  const out = [];
  for (const id in S.players) { const p = S.players[id]; if (p.clubId === clubId) out.push(p); }
  return out;
}

/**
 * Projected share of minutes (0..1) player `p` would get at club `clubId`
 * (squad hierarchy by selection score, youthTrust bonus for ≤21).
 * Used by world generation, negotiation and fit effects.
 * @param {object} S
 * @param {object} p player (may already be in that club)
 * @param {string} clubId
 * @param {object} [opts] unused (kept for call symmetry)
 */
export function projectMinutes(S, p, clubId, opts = {}, squad) {
  const club = S.clubs[clubId];
  const sq = squad || squadOf(S, clubId);
  const mine = selScore(S, p, club, false);
  let rank = 0;
  for (const q of sq) {
    if (q.id === p.id || q.pos !== p.pos) continue;
    if (selScore(S, q, club, false) > mine) rank++;
  }
  const slots = POS[p.pos].slots;
  const P = BAL.sel.proj;
  if (rank < slots) return P.starter;
  const b = rank - slots;
  return b === 0 ? P.bench1 : b === 1 ? P.bench2 : P.other;
}
