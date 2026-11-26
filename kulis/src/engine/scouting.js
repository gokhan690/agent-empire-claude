// Scouting: trips reveal prospects, watching narrows the potential band, shortlist, passive discovery.
// Hidden potential: p.know 0..100; band via selectors.potentialBand. Unrepresented discovered players
// have p.seen=true and p.heat 0..100 (rival interest; rivals.monthly raises it).
import { BAL, LEAGUE_DEFS } from './constants.js';
import { pickBy, chance, pick } from './rng.js';
import { clamp } from './util.js';
import { spend, spendEnergy } from './economy.js';
import { upg, upgradeEffects, prospectLevel, isRecruitable, monthIndex, potentialBand } from './selectors.js';

/** @typedef {{ok:true,events:object[],[k:string]:any}|{ok:false,error:string}} Result */

export const FOCUSES = ['any', 'u21', 'form', 'expiring'];

/** Players of a league (or all leagues when leagueId is null) you have not seen yet and could eventually sign. */
function pool(S, leagueId) {
  const out = [];
  for (const id in S.players) {
    const p = S.players[id];
    if (p.seen || !p.clubId || !isRecruitable(S, p)) continue;
    const c = S.clubs[p.clubId];
    if (!c || (leagueId && c.leagueId !== leagueId)) continue;
    out.push(p);
  }
  return out;
}

function focusPred(S, list, focus) {
  if (focus === 'u21') return p => p.age <= 21;
  if (focus === 'expiring') return p => p.contractEnd <= S.time.season;
  if (focus === 'form' && list.length) {
    const fs = list.map(p => p.form).sort((a, b) => b - a);
    const cut = fs[Math.min(fs.length - 1, Math.floor(fs.length * 0.35))];
    return p => p.form >= cut && p.form > 0;
  }
  return () => true;
}

/** Pick `count` prospects: quality target Q grows with league prestige and a little with your rep; gems stay rare. */
function pickProspects(S, list, count, prestige, focus) {
  const B = BAL.scout;
  const Q = B.qBase[prestige] + S.agency.rep * B.qRep;
  const pred = focusPred(S, list, focus);
  let pref = list.filter(pred);
  let rest = list.filter(p => !pred(p));
  const out = [];
  const gemOk = p => p.pa - p.ca >= B.gemMinGap && p.age <= 21;
  while (out.length < count && (pref.length || rest.length)) {
    const src = pref.length ? pref : rest;
    let p = null;
    if (chance(S, B.gemChance)) {
      const gems = src.filter(gemOk);
      if (gems.length) p = pick(S, gems);
    }
    if (!p) p = pickBy(S, src, q => Math.exp(-0.5 * Math.pow((prospectLevel(q) - Q) / B.qSd, 2)));
    out.push(p);
    const i = src.indexOf(p); src.splice(i, 1);
  }
  return out;
}

function reveal(S, p, know) {
  p.seen = true; p.know = Math.max(p.know, know); p.heat = p.heat || 0; p.seenAt = monthIndex(S);
}

function startKnow(S) { return BAL.scout.startKnow + upgradeEffects(S).scoutKnowBonus; }

function tripCost(S, a) {
  const L = a && S.leagues[a.leagueId];
  if (!L) return null;
  return { L, cash: BAL.scout.travel[L.prestige] };
}

/**
 * Preview of a scout trip (costs shown before confirming).
 * @param {object} S
 * @param {{leagueId:string, focus:'u21'|'form'|'expiring'|'any'}} a
 * @returns {{energy:number, cash:number, count:number, available:number, startKnow:number, error?:string}}
 *   cost (1 E + travel € by league prestige), prospects revealed (3, 4 at scout L1), how many unseen candidates exist
 */
export function tripPreview(S, a) {
  const c = tripCost(S, a);
  if (!c) return { energy: 1, cash: 0, count: 0, available: 0, startKnow: startKnow(S), error: 'Bilinmeyen lig' };
  const avail = pool(S, a.leagueId).length;
  return { energy: 1, cash: c.cash, count: Math.min(upgradeEffects(S).scoutCount, avail), available: avail, startKnow: startKnow(S) };
}

/**
 * Scout trip: spend 1 energy + travel €, reveal prospects (seen=true, know=starting know, +15 at scout L2).
 * @param {object} S
 * @param {{leagueId:string, focus:'u21'|'form'|'expiring'|'any'}} a
 * @returns {Result} on success `{ok:true, events:[{type:'scout', playerIds:[...]}], prospects:string[]}`
 */
export function scoutTrip(S, a) {
  const c = tripCost(S, a || {});
  if (!c) return { ok: false, error: 'Bilinmeyen lig' };
  const list = pool(S, a.leagueId);
  if (!list.length) return { ok: false, error: 'Bu ligde yeni isim kalmadı' };
  if (S.agency.energy < 1) return { ok: false, error: 'Enerjin yok' };
  if (S.agency.cash < c.cash) return { ok: false, error: 'Yeterli paran yok' };
  const picks = pickProspects(S, list, upgradeEffects(S).scoutCount, c.L.prestige, FOCUSES.includes(a.focus) ? a.focus : 'any');
  spendEnergy(S, 1);
  spend(S, c.cash, 'travel', 'Gözlem gezisi: ' + c.L.name);
  const ids = [];
  for (const p of picks) { reveal(S, p, startKnow(S)); ids.push(p.id); }
  return { ok: true, events: [{ type: 'scout', leagueId: a.leagueId, playerIds: ids }], prospects: ids };
}

/**
 * Watch a player: 1 energy, know +30 (narrower band), trait revealed at know ≥ 60.
 * @param {object} S
 * @param {{playerId:string}} a
 * @returns {Result}
 */
export function watchPlayer(S, a) {
  const p = a && S.players[a.playerId];
  if (!p) return { ok: false, error: 'Oyuncu bulunamadı' };
  if (!p.seen && p.agentId !== 'you') return { ok: false, error: 'Önce bu oyuncuyu keşfetmelisin' };
  if (p.know >= 100) return { ok: false, error: 'Bu oyuncuyu zaten çok iyi tanıyorsun' };
  if (S.agency.energy < 1) return { ok: false, error: 'Enerjin yok' };
  spendEnergy(S, 1);
  const before = p.know;
  p.know = clamp(p.know + BAL.scout.watchKnow, 0, 100);
  return { ok: true, events: [{ type: 'watch', playerId: p.id, know: p.know, delta: p.know - before, traitRevealed: before < BAL.scout.traitKnow && p.know >= BAL.scout.traitKnow, band: potentialBand(S, p) }] };
}

/**
 * Toggle p.shortlisted (free action).
 * @param {object} S
 * @param {{playerId:string}} a
 * @returns {Result}
 */
export function toggleShortlist(S, a) {
  const p = a && S.players[a.playerId];
  if (!p) return { ok: false, error: 'Oyuncu bulunamadı' };
  if (!p.seen) return { ok: false, error: 'Önce bu oyuncuyu keşfetmelisin' };
  if (!p.shortlisted) {
    let n = 0; for (const id in S.players) if (S.players[id].shortlisted) n++;
    if (n >= BAL.scout.shortlistMax) return { ok: false, error: 'Takip listesi dolu' };
  }
  p.shortlisted = !p.shortlisted;
  return { ok: true, events: [{ type: 'shortlist', playerId: p.id, on: p.shortlisted }] };
}

/**
 * Monthly hook (turn step 8): passive discovery at scout L3+ (one new prospect from a random league,
 * quality by that league's prestige); the L4 heat slowdown lives in rivals.monthly.
 * @param {object} S
 * @returns {object[]} UI events
 */
export function monthly(S) {
  if (upg(S, 'scout') < 3) return [];
  const list = pool(S, null);
  if (!list.length) return [];
  const L = pick(S, LEAGUE_DEFS);
  const sub = list.filter(p => S.clubs[p.clubId].leagueId === L.id);
  if (!sub.length) return [];
  const [p] = pickProspects(S, sub, 1, L.prestige, 'any');
  reveal(S, p, BAL.upgrade.scoutPassiveKnow + upgradeEffects(S).scoutKnowBonus);
  return [{ type: 'scout', passive: true, leagueId: L.id, playerIds: [p.id] }];
}
