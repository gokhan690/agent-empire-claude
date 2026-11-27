// Scouting: one action "Oyuncu ara" (3 candidates) and "İzle" (potential becomes exact). Candidates wait in S.found.
import { BAL } from './constants.js';
import { pickBy, chance, pick } from './rng.js';
import { spendEnergy } from './economy.js';
import { hasUpgrade, signLevel } from './selectors.js';

/** @typedef {{ok:true,events:object[],[k:string]:any}|{ok:false,error:string}} Result */

/** Players you have not met yet who could eventually sign with you (unrepresented, at a club). */
function pool(S) {
  const out = [];
  for (const id in S.players) {
    const p = S.players[id];
    if (p.seen || p.agentId || !p.clubId) continue;
    out.push(p);
  }
  return out;
}

/** Quality target of the candidates you meet: grows with your reputation. */
export function targetLevel(S) { return BAL.scout.qBase + S.agency.rep * BAL.scout.qRep; }

function pickCandidates(S, list, count) {
  const B = BAL.scout;
  const Q = targetLevel(S);
  const gemChance = B.gemChance + (hasUpgrade(S, 'academy') ? BAL.upgrade.academyGem : 0);
  const out = [];
  const src = list.slice();
  while (out.length < count && src.length) {
    let p = null;
    if (chance(S, gemChance)) {
      const gems = src.filter(q => q.pa - q.ca >= B.gemMinGap && q.age <= 21 && signLevel(q) <= Q + 8);
      if (gems.length) p = pick(S, gems);
    }
    if (!p) p = pickBy(S, src, q => Math.exp(-0.5 * Math.pow((signLevel(q) - Q) / B.qSd, 2)) + 1e-6);
    out.push(p);
    src.splice(src.indexOf(p), 1);
  }
  return out;
}

/** How many candidates one search brings. */
export function searchCount(S) { return BAL.scout.count + (hasUpgrade(S, 'scouts') ? 1 : 0); }

/**
 * "Oyuncu ara": 1 energy → new candidates (not yet met, unrepresented), appended to S.found (newest first, max 6).
 * @param {object} S
 * @returns {Result} `{ok:true, events:[{type:'scout', playerIds}], candidates:string[]}`
 */
export function search(S) {
  const list = pool(S);
  if (!list.length) return { ok: false, error: 'Yeni isim kalmadı' };
  if (S.agency.energy < 1) return { ok: false, error: 'Enerjin yok' };
  const picks = pickCandidates(S, list, searchCount(S));
  spendEnergy(S, 1);
  const ids = [];
  for (const p of picks) { p.seen = true; ids.push(p.id); }
  S.found = ids.concat(S.found).slice(0, BAL.scout.foundMax);
  return { ok: true, events: [{ type: 'scout', playerIds: ids }], candidates: ids };
}

/**
 * "İzle": 1 energy → the candidate's potential is shown exactly (know = 100).
 * @param {object} S
 * @param {{playerId:string}} a
 * @returns {Result}
 */
export function watch(S, a) {
  const p = a && S.players[a.playerId];
  if (!p) return { ok: false, error: 'Oyuncu bulunamadı' };
  if (!p.seen) return { ok: false, error: 'Önce bu oyuncuyu bulmalısın' };
  if (p.know >= 100) return { ok: false, error: 'Zaten tanıyorsun' };
  if (S.agency.energy < 1) return { ok: false, error: 'Enerjin yok' };
  spendEnergy(S, 1);
  p.know = 100;
  return { ok: true, events: [{ type: 'watch', playerId: p.id }] };
}

/** One extra candidate without spending energy (event card). Returns the player id or null. */
export function pickCandidate(S) {
  const list = pool(S);
  if (!list.length) return null;
  const [p] = pickCandidates(S, list, 1);
  p.seen = true;
  S.found = [p.id].concat(S.found).slice(0, BAL.scout.foundMax);
  return p.id;
}
