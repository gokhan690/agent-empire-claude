// Phase 2b — the market: club needs, interest in your clients, AI↔AI transfers, pitch / lunch / media actions,
// and executeTransfer (move, fee, commission, career-fit effects). Randomness only through rng.js.
import { BAL, MONTHS, POS, POS_ORDER } from './constants.js';
import { rint, chance, gauss, uid, shuffle, pickBy } from './rng.js';
import { clamp, hash01, mean, tidy } from './util.js';
import { fairWage, playerValue } from './valuation.js';
import { squadIndex, squadOf, clubStrength, projectMinutes } from './selection.js';
import { myClients, upgradeEffects, agencyScale } from './selectors.js';
import { spend, earn, spendEnergy, addRep } from './economy.js';
import { genYouth } from './world.js';
import * as news from './news.js';
import { useAction } from './deadline.js';
import * as promises from './promises.js';

/** @typedef {{ok:true,events:object[],[k:string]:any}|{ok:false,error:string}} Result */

const fail = error => ({ ok: false, error });
const r100 = v => Math.round(v / 100) * 100;

/** "€1,2M" / "€450K" style money for news lines. */
export function fmtMoney(v) {
  v = Math.round(v);
  if (v >= 1e6) return '€' + (Math.round(v / 1e5) / 10).toString().replace('.', ',') + 'M';
  if (v >= 1e3) return '€' + Math.round(v / 1e3) + 'K';
  return '€' + v;
}

// ------------------------------------------------------------------------------------------ package math

/** Club cost of a package: (wage·12·years + bonus + fee) · (1 + clause rates). */
export function packageCost(pkg) {
  const C = BAL.neg.clause;
  const base = pkg.wage * 12 * pkg.years + pkg.bonus + pkg.fee;
  const c = pkg.clauses || {};
  return Math.round(base * (1 + (c.minutes ? C.minutes : 0) + (c.release ? C.release : 0)));
}
/** Share of the package cost that is your commission (0..1). */
export function feeShare(pkg) { const c = packageCost(pkg); return c > 0 ? pkg.fee / c : 0; }
/** Threshold above which the client notices your fee (archetype hukukcu 15%, else 12%). */
export function feeThreshold(S, cost) {
  const base = S.meta.archetype === 'hukukcu' ? BAL.archetype.hukukcu.feeThreshold : 0.12;
  if (!cost) return base;
  const B = BAL.neg.bigDeal;
  return Math.round(base * (1 - B.cut * clamp(Math.log10(Math.max(1, cost / B.from)) / B.span, 0, 1)) * 1000) / 1000;
}

// ------------------------------------------------------------------------------------------ needs

/** Need level of a club at a position (0 = none). */
export function needLevel(club, pos) {
  const n = club.needs.find(x => x.pos === pos);
  return n ? n.level : 0;
}

/** Compute `[{pos, level 1..3}]` (sorted desc) from the squad: thin (< minimum) = 3, weak starters by CA gap. */
export function computeNeeds(S, club, squad, A) {
  const T = BAL.market.need.gap;
  const out = [];
  for (const pos of POS_ORDER) {
    const all = squad.filter(p => p.pos === pos);
    const fit = all.filter(p => p.injured < 2).sort((a, b) => b.ca - a.ca);
    const slots = POS[pos].slots;
    const st = fit.slice(0, slots);
    let lvl = 0;
    if (st.length < slots) lvl = 3;
    else {
      const d = A - mean(st.map(p => p.ca));
      lvl = d >= T[2] ? 3 : d >= T[1] ? 2 : d >= T[0] ? 1 : 0;
    }
    if (all.length < BAL.squad.minByPos[pos]) lvl = 3;
    if (lvl > 0) out.push({ pos, level: lvl });
  }
  out.sort((a, b) => b.level - a.level);
  return out;
}

function strengthMap(S, idx) {
  const A = {};
  for (const cid in S.clubs) A[cid] = clubStrength(S, cid, idx[cid]);
  return A;
}
function refreshNeeds(S, idx, A) {
  for (const cid in S.clubs) S.clubs[cid].needs = computeNeeds(S, S.clubs[cid], idx[cid], A[cid]);
}

// ------------------------------------------------------------------------------------------ squads

function dropPlayer(S, id) {
  delete S.players[id];
  S.interests = S.interests.filter(i => i.playerId !== id);
  S.promises = S.promises.filter(p => p.playerId !== id);
  S.inbox = S.inbox.filter(c => c.playerId !== id);
}

/** Keep a club's squad inside 18–22 and every line above its minimum (trim worst non-clients / sign youths). */
export function balanceSquad(S, club) {
  const SQ = BAL.squad;
  let sq = squadOf(S, club.id);
  const cnt = { KL: 0, DF: 0, OS: 0, FV: 0 };
  for (const p of sq) cnt[p.pos]++;
  while (sq.length > SQ.max) {
    const c = sq.filter(p => p.agentId !== 'you' && cnt[p.pos] > SQ.minByPos[p.pos]).sort((a, b) => a.value - b.value || a.ca - b.ca);
    if (!c.length) break;
    const v = c[0];
    cnt[v.pos]--; sq = sq.filter(p => p !== v); dropPlayer(S, v.id);
  }
  const A = clubStrength(S, club.id, sq) || BAL.strengthByPrestige[S.leagues[club.leagueId].prestige];
  for (const pos of POS_ORDER) while (cnt[pos] < SQ.minByPos[pos]) { sq.push(genYouth(S, club, pos, A, cnt[pos] === 0)); cnt[pos]++; }
  while (sq.length < SQ.min) {
    const pos = POS_ORDER.slice().sort((a, b) => (cnt[a] / SQ.base[a]) - (cnt[b] / SQ.base[b]))[0];
    sq.push(genYouth(S, club, pos, A)); cnt[pos]++;
  }
  club.needs = computeNeeds(S, club, sq, clubStrength(S, club.id, sq));
}

// ------------------------------------------------------------------------------------------ interest

/** Which interest kind applies to (player, club) right now. */
export function kindFor(S, p, club) {
  if (!p.clubId) return 'free';
  if (club.id === p.clubId) return 'renewal';
  if (p.contractEnd === S.time.season && S.time.month >= BAL.market.interest.freeFrom) return 'free';
  return 'transfer';
}

/** Rough Bonservis (transfer fee) the buyer would pay: value × (0.95 + 0.05·(need−1)). */
export function estimateTransferFee(S, p, club) {
  const D = BAL.market.deal;
  const nl = Math.max(1, needLevel(club, p.pos));
  return tidy(p.value * (D.feeFactorBase + D.feeFactorNeed * (nl - 1)));
}

export function interestTarget(S, p, club, A, kind) {
  const W = BAL.market.interest;
  const nl = needLevel(club, p.pos);
  if (!nl) return 0;
  if (p.moveAt !== undefined && p.clubId && S.time.season * 12 + S.time.month - p.moveAt < W.moveLock) return 0; // just settled in: nobody bids again yet
  const delta = p.ca - A;
  let t = nl * W.needW + clamp(W.fitBase + delta * W.fitK, W.fitMin, W.fitMax) + p.form * W.formW + p.hype / W.hypeDiv + club.trust / W.trustDiv;
  t += p.age <= 23 ? W.ageYoung : p.age <= 29 ? W.ageMid : p.age <= 30 ? 0 : p.age <= 32 ? W.age31 : W.age33;
  if (kind === 'free') t += 6;
  const ratio = kind === 'free' ? 9 : club.budget / Math.max(1, estimateTransferFee(S, p, club));
  if (ratio < W.budgetMinRatio) t = Math.min(t, W.unaffordableCap);
  else if (ratio >= W.budgetRich) t += W.budgetBonus;
  return clamp(Math.round(t), 0, 100);
}

function renewalTarget(S, p, club) {
  const W = BAL.market.interest;
  const m = projectMinutes(S, p, club.id);
  const P = BAL.sel.proj;
  const base = m >= P.starter ? W.renewalStarter : m >= P.bench1 ? 52 : 30;
  return clamp(Math.round(base + p.form * 0.5 + (p.loyalty - 50) / 10), 0, 100);
}

/** Players' interest bookkeeping for the month. */
function updateInterests(S, A, events) {
  const W = BAL.market.interest;
  const { season, month } = S.time;
  for (const i of S.interests) {
    if (i.cooldown > 0) i.cooldown--;
    if (i.boost) { i.boost = Math.round(i.boost * W.boostDecay); if (i.boost < 1) i.boost = 0; }
  }
  const mineIds = new Set();
  for (const p of myClients(S)) {
    mineIds.add(p.id);
    if (p.preContract) { S.interests = S.interests.filter(i => !(i.playerId === p.id && i.kind !== 'renewal')); }
    const byClub = new Map();
    for (const i of S.interests) if (i.playerId === p.id) byClub.set(i.clubId, i);
    const clubs = Object.keys(S.clubs).sort();
    for (const cid of clubs) {
      const club = S.clubs[cid];
      let kind, target;
      if (cid === p.clubId) {
        const want = p.contractEnd === season && month >= W.renewalFrom && !p.preContract;
        if (!want) { const ex = byClub.get(cid); if (ex) S.interests = S.interests.filter(x => x !== ex); continue; }
        kind = 'renewal'; target = renewalTarget(S, p, club);
      } else {
        if (p.preContract) continue;
        kind = kindFor(S, p, club);
        target = interestTarget(S, p, club, A[cid], kind);
      }
      const ex = byClub.get(cid);
      if (ex) {
        const before = ex.level;
        const goal = target + (ex.boost || 0);
        ex.kind = kind;
        if (target <= 0 && !(ex.boost > 0)) ex.level = Math.max(0, ex.level - W.decay);
        else ex.level = clamp(Math.round(ex.level + (goal - ex.level) * W.pull + gauss(S, 0, W.noise)), 0, 100);
        if (ex.level < W.drop) S.interests = S.interests.filter(x => x !== ex);
        else if (before < W.open && ex.level >= W.open) events.push({ type: 'interest', interestId: ex.id, playerId: p.id, clubId: cid, level: ex.level, kind });
      } else if (target >= W.create) {
        const i = { id: uid(S, 'i'), playerId: p.id, clubId: cid, level: Math.round(target * 0.6), kind, cooldown: 0, boost: 0 };
        S.interests.push(i);
        if (i.level >= W.open) events.push({ type: 'interest', interestId: i.id, playerId: p.id, clubId: cid, level: i.level, kind });
      }
    }
    // cap per player (keep the strongest)
    const mine = S.interests.filter(i => i.playerId === p.id).sort((a, b) => b.level - a.level);
    if (mine.length > W.perPlayer) {
      const drop = new Set(mine.slice(W.perPlayer).map(i => i.id));
      S.interests = S.interests.filter(i => !drop.has(i.id));
    }
  }
  // interests in players that are no longer clients fade out
  S.interests = S.interests.filter(i => S.players[i.playerId] && S.clubs[i.clubId]);
}

// ------------------------------------------------------------------------------------------ AI transfers

function aiTransfers(S, idx, A, events) {
  const AI = BAL.market.ai, SQ = BAL.squad;
  const month = S.time.month;
  const mf = AI.monthFactor[month] ?? 0;
  if (!mf) return;
  const negPid = S.negotiation ? S.negotiation.playerId : null;
  const order = shuffle(S, Object.keys(S.clubs).sort());
  let newsLeft = AI.newsMax;
  for (const bid of order) {
    const buyer = S.clubs[bid];
    const lvlSum = buyer.needs.reduce((s, n) => s + n.level, 0);
    const n = clamp(Math.round(lvlSum * AI.needFactor * mf + gauss(S, 0, AI.noiseSd)), 0, AI.perClubMax);
    for (let k = 0; k < n; k++) {
      if (idx[bid].length >= SQ.max) break;
      const needs = buyer.needs;
      if (!needs.length) break;
      const nd = pickBy(S, needs, x => x.level);
      const starters = idx[bid].filter(p => p.pos === nd.pos).sort((a, b) => b.ca - a.ca);
      const weakest = starters.length >= POS[nd.pos].slots ? starters[POS[nd.pos].slots - 1].ca : A[bid] - 8;
      const bl = S.leagues[buyer.leagueId];
      const cands = [];
      for (const sid in idx) {
        if (sid === bid || idx[sid].length <= SQ.min) continue;
        const sl = S.leagues[S.clubs[sid].leagueId];
        if (sl.prestige > bl.prestige + 1 || sl.prestige < bl.prestige - 2) continue;
        for (const p of idx[sid]) {
          if (p.pos !== nd.pos || p.agentId === 'you' || p.id === negPid || p.injured > 1) continue;
          if (idx[sid].filter(q => q.pos === p.pos).length <= SQ.minByPos[p.pos]) continue;
          if (p.ca < weakest + 1 || p.ca > A[bid] + AI.caWindow[1] || p.ca < A[bid] + AI.caWindow[0]) continue;
          if (p.value > buyer.budget * AI.valueBudgetShare) continue;
          cands.push(p);
        }
      }
      if (!cands.length) continue;
      const p = pickBy(S, cands, q => 1 + (S.clubs[q.clubId].leagueId === buyer.leagueId ? 2 : 0) + (q.ca - weakest) * 0.3);
      const seller = S.clubs[p.clubId];
      const fee = tidy(p.value * (AI.feeLo + (AI.feeHi - AI.feeLo) * hash01(p.id + ':' + S.time.season + ':' + month)));
      const price = Math.min(fee, buyer.budget);
      buyer.budget -= price; seller.budget += price;
      idx[seller.id] = idx[seller.id].filter(q => q !== p);
      idx[bid].push(p);
      const from = seller;
      p.clubId = bid; p.guarantee = false; p.releaseClause = 0;
      p.wage = Math.max(BAL.wage.min, r100(fairWage(S, p, buyer.leagueId) * clamp(gauss(S, 1, 0.1), 0.8, 1.25)));
      p.contractEnd = S.time.season + rint(S, AI.contract[0], AI.contract[1]);
      p.loyalty = rint(S, 40, 65);
      p.st.sh = Math.round(projectMinutes(S, p, bid, {}, idx[bid]) * 100) / 100;
      buyer.needs = computeNeeds(S, buyer, idx[bid], A[bid]);
      seller.needs = computeNeeds(S, seller, idx[seller.id], A[seller.id]);
      if (newsLeft > 0 && (price >= AI.newsMinValue || p.ca >= 66)) {
        newsLeft--;
        news.push(S, { kind: 'transfer', playerId: p.id, clubId: bid, text: p.name + ' (' + p.pos + ', ' + p.ca + ') ' + from.name + ' → ' + buyer.name + ' (' + fmtMoney(price) + ')' });
      }
      events.push({ type: 'aiTransfer', playerId: p.id, fromClubId: from.id, toClubId: bid, fee: price });
    }
  }
}

/**
 * Monthly (turn step 5): recompute needs, AI clubs trade in open windows (0–2 signings each),
 * build/decay interest in your clients (≥60 in an open window → negotiable), cool-downs, free-agent offers.
 * @param {object} S
 * @returns {object[]} UI events (`{type:'interest'|'aiTransfer', ...}`)
 */
export function monthly(S) {
  const events = [];
  if (S.time.month === 0) for (const cid in S.clubs) S.clubs[cid].lunchKnown = false;
  let idx = squadIndex(S);
  let A = strengthMap(S, idx);
  refreshNeeds(S, idx, A);
  if (MONTHS[S.time.month].window) {
    aiTransfers(S, idx, A, events);
    idx = squadIndex(S);
    A = strengthMap(S, idx);
    refreshNeeds(S, idx, A);
  }
  if (S.time.month === 1) for (const p of myClients(S)) if (!p.clubId) { placeFreeAgent(S, p); events.push({ type: 'freeAgentPlaced', playerId: p.id, clubId: p.clubId }); }
  updateInterests(S, A, events);
  return events;
}

// ------------------------------------------------------------------------------------------ expiry

/**
 * Season-end hook for a CLIENT whose contract ends this June. Executes a signed pre-contract (the move happens
 * now); a client his club no longer wants may become a free agent (clubId null, placeable via kind 'free').
 * Returns true if handled; false → the engine auto-renews him at his club.
 * @param {object} S
 * @param {object} p player
 * @returns {boolean}
 */
export function handleExpiry(S, p) {
  if (!p.clubId) { placeFreeAgent(S, p, true); return true; }
  const pc = p.preContract;
  if (pc) {
    delete p.preContract;
    const to = S.clubs[pc.toClubId];
    if (to) { applyMove(S, p, to, { ...pc, kind: 'free' }, { seasonEnd: true, arranged: true }); return true; }
  }
  const club = p.clubId ? S.clubs[p.clubId] : null;
  const F = BAL.market.freeAgent;
  if (club && p.age >= F.minAge - 4) {
    const A = clubStrength(S, club.id);
    if (p.ca < A - F.minGap && chance(S, F.chance)) {
      news.push(S, { kind: 'transfer', playerId: p.id, clubId: club.id, text: p.name + ' ' + club.name + ' ile yollarını ayırdı, serbest kaldı.' });
      p.clubId = null; p.wage = 0; p.contractEnd = S.time.season + 1; p.guarantee = false; p.releaseClause = 0;
      p.loyalty = clamp(p.loyalty - 10, 0, 100); p.morale = clamp(p.morale - 10, 0, 100);
      S.interests = S.interests.filter(i => i.playerId !== p.id);
      return true;
    }
  }
  return false;
}

/**
 * A clubless client (free agent) who found no table in the window is signed by a fitting club at a modest wage
 * (no commission: you did not negotiate it). Keeps the world free of clubless players after September.
 */
export function placeFreeAgent(S, p, seasonEnd = false) {
  const leagues = Object.values(S.leagues).sort((a, b) => b.prestige - a.prestige);
  const L = leagues.find(l => BAL.strengthByPrestige[l.prestige] - 8 <= p.ca) || leagues[leagues.length - 1];
  const ids = L.clubIds.slice().sort();
  const needy = ids.filter(id => needLevel(S.clubs[id], p.pos) > 0);
  const pool = needy.length ? needy : ids;
  const to = S.clubs[pool[rint(S, 0, pool.length - 1)]];
  const wage = Math.max(BAL.wage.min, r100(fairWage(S, p, to.leagueId) * 0.9));
  applyMove(S, p, to, { kind: 'free', wage, years: 1 + rint(S, 0, 1), bonus: 0, clauses: { minutes: false, release: false } }, { seasonEnd });
  news.push(S, { kind: 'transfer', playerId: p.id, clubId: to.id, text: p.name + ' serbest kaldıktan sonra ' + to.name + ' ile anlaştı.' });
  return to;
}

// ------------------------------------------------------------------------------------------ pitch / lunch / media

function pitchDelta(S, p, club) {
  const P = BAL.market.pitch;
  const A = clubStrength(S, club.id);
  const nl = needLevel(club, p.pos);
  const fit = clamp(p.ca - A + 4, P.fitMin, P.fitMax) * P.fitW;
  let d = P.base + nl * P.perNeed + club.trust / BAL.market.interest.trustDiv + fit + p.hype / P.hypeDiv;
  const ex = S.interests.find(i => i.playerId === p.id && i.clubId === club.id);
  if (ex && ex.pitchedAt === S.time.season * 12 + S.time.month) d *= P.repeatMult;
  return clamp(Math.round(d), P.min, P.max);
}

function pitchCheck(S, a) {
  const p = a && S.players[a.playerId];
  const club = a && S.clubs[a.clubId];
  if (!p || p.agentId !== 'you') return 'Müşterin değil';
  if (!club) return 'Kulüp bulunamadı';
  if (p.clubId === club.id) return 'Kendi kulübüne öneremezsin';
  if (p.preContract) return 'Ön sözleşme zaten imzalı';
  const ex = S.interests.find(i => i.playerId === p.id && i.clubId === club.id);
  if (ex && ex.cooldown > 0) return 'Direktör küs (' + ex.cooldown + ' ay)';
  return null;
}

/**
 * Preview a pitch (shown, deterministic).
 * @param {object} S
 * @param {{playerId:string, clubId:string}} a
 * @returns {{energy:number, cash:number, delta:number, levelBefore:number, levelAfter:number, error?:string}}
 */
export function pitchPreview(S, a) {
  const err = pitchCheck(S, a);
  if (err) return { energy: 1, cash: 0, delta: 0, levelBefore: 0, levelAfter: 0, error: err };
  const p = S.players[a.playerId], club = S.clubs[a.clubId];
  const ex = S.interests.find(i => i.playerId === p.id && i.clubId === club.id);
  const before = ex ? ex.level : 0;
  const delta = pitchDelta(S, p, club);
  return { energy: S.time.phase === 'deadline' ? 0 : 1, cash: 0, delta, levelBefore: before, levelAfter: Math.min(100, before + delta), deadlineAction: S.time.phase === 'deadline' };
}

/**
 * Pitch a client to a club: 1 energy (during Son Gün: the hour's action instead), raises that club's interest
 * by the previewed amount (the gain sticks as a slowly fading boost, capped).
 * @param {object} S
 * @param {{playerId:string, clubId:string}} a
 * @returns {Result}
 */
export function pitchPlayer(S, a) {
  const err = pitchCheck(S, a);
  if (err) return fail(err);
  const p = S.players[a.playerId], club = S.clubs[a.clubId];
  const dl = S.time.phase === 'deadline' && S.deadline;
  if (dl) {
    if (dl.ended) return fail('Gece yarısı geçti');
    if (S.negotiation) return fail('Önce açık masayı kapat');
    if (dl.actionsLeft <= 0) return fail('Bu saatin hakkı bitti');
  } else if (S.agency.energy < 1) return fail('Enerjin yetmiyor');
  const delta = pitchDelta(S, p, club);
  let ex = S.interests.find(i => i.playerId === p.id && i.clubId === club.id);
  if (!ex) { ex = { id: uid(S, 'i'), playerId: p.id, clubId: club.id, level: 0, kind: kindFor(S, p, club), cooldown: 0, boost: 0 }; S.interests.push(ex); }
  const before = ex.level;
  ex.level = clamp(ex.level + delta, 0, 100);
  ex.boost = Math.min(BAL.market.interest.boostMax, (ex.boost || 0) + delta);
  ex.pitchedAt = S.time.season * 12 + S.time.month;
  ex.kind = kindFor(S, p, club);
  if (!dl) spendEnergy(S, 1);
  const events = [{ type: 'pitch', playerId: p.id, clubId: club.id, delta, levelBefore: before, levelAfter: ex.level, interestId: ex.id }];
  if (before < BAL.market.interest.open && ex.level >= BAL.market.interest.open) events.push({ type: 'interest', interestId: ex.id, playerId: p.id, clubId: club.id, level: ex.level, kind: ex.kind });
  if (dl) events.push(...useAction(S));
  return { ok: true, events, interestId: ex.id, delta };
}

/** Cost of a lunch with this club's director. */
export function lunchCost(S, club) {
  const L = BAL.market.lunch;
  return tidy((L.cashBase + L.cashPerPrestige * S.leagues[club.leagueId].prestige) * agencyScale(S));
}

/**
 * Club lunch: 1 energy + € → trust +10 (+15 at network L2), reveals needs & budget hint (club.lunchKnown=true).
 * @param {object} S
 * @param {{clubId:string}} a
 * @returns {Result} `events:[{type:'lunch', clubId, trust, needs, budgetHint:{lo,hi}}]`
 */
export function clubLunch(S, a) {
  const club = a && S.clubs[a.clubId];
  if (!club) return fail('Kulüp bulunamadı');
  const cash = lunchCost(S, club);
  if (S.agency.energy < 1) return fail('Enerjin yetmiyor');
  if (S.agency.cash < cash) return fail('Yeterli paran yok');
  spendEnergy(S, 1);
  spend(S, cash, 'lunch', club.short + ' yemeği');
  const L = BAL.market.lunch;
  const gain = upgradeEffects(S).lunchTrust;
  club.trust = clamp(club.trust + gain, 0, 100);
  club.lunchKnown = true;
  const f = hash01(club.id + ':bh' + S.time.season);
  const lo = Math.round(club.budget * (1 - L.band * f) / 10000) * 10000;
  const hi = Math.round((lo + club.budget * L.band * 1.0) / 10000) * 10000;
  const hint = { lo: Math.min(lo, club.budget), hi: Math.max(hi, club.budget) };
  return { ok: true, events: [{ type: 'lunch', clubId: club.id, trust: club.trust, gain, cash, needs: club.needs.map(n => ({ ...n })), budgetHint: hint }], budgetHint: hint, needs: club.needs.map(n => ({ ...n })) };
}

/** Cost of a media push for this player. */
export function mediaCost(S, p) {
  const M = BAL.market.media;
  return tidy(clamp(M.cashBase + p.value * M.valueShare, M.min, M.max) * agencyScale(S));
}

/**
 * Media push: 1 energy + € → hype +15 (value & interest up; yildiz morale +, sadik −).
 * @param {object} S
 * @param {{playerId:string}} a
 * @returns {Result}
 */
export function mediaPush(S, a) {
  const p = a && S.players[a.playerId];
  if (!p || p.agentId !== 'you') return fail('Müşterin değil');
  const cash = mediaCost(S, p);
  if (S.agency.energy < 1) return fail('Enerjin yetmiyor');
  if (S.agency.cash < cash) return fail('Yeterli paran yok');
  const M = BAL.market.media;
  spendEnergy(S, 1);
  spend(S, cash, 'media', 'Basın çalışması: ' + p.name);
  p.hype = clamp(p.hype + M.hype, 0, 100);
  if (p.trait === 'yildiz') p.morale = clamp(p.morale + M.yildizMorale, 0, 100);
  if (p.trait === 'sadik') p.morale = clamp(p.morale + M.sadikMorale, 0, 100);
  p.value = playerValue(S, p);
  return { ok: true, events: [{ type: 'media', playerId: p.id, hype: p.hype, cash, value: p.value }] };
}

// ------------------------------------------------------------------------------------------ executing a move

function careerFit(S, p, to, d, m, from, moved) {
  const D = BAL.market.deal;
  const notes = [];
  let morale = clamp(Math.round((m - 0.5) * D.minutesMorale), -12, 12);
  let loyalty = moved ? D.moveLoyalty : D.renewLoyalty;
  const curPrest = from ? S.leagues[from.leagueId].prestige : 1;
  const newPrest = S.leagues[to.leagueId].prestige;
  notes.push(m >= 0.5 ? 'İlk 11 şansı yüksek' : m >= 0.2 ? 'Yedek başlayacak' : 'Kadro dışı kalma riski');
  if (p.trait === 'hirsli' && m < 0.5) { morale += D.benchHirsliMorale; loyalty += D.benchHirsliLoyalty; notes.push('Hırslı: yedek kalmaktan nefret ediyor'); }
  if (p.trait === 'sadik' && moved) { morale -= 3; loyalty -= 4; }
  if (p.trait === 'yildiz') { if (newPrest > curPrest) morale += 5; else if (newPrest < curPrest) morale -= 6; }
  if (p.trait === 'ailebabasi' && moved) {
    const home = S.leagues[to.leagueId].country === 'Türkiye' ? p.nat === 'TR' : false;
    morale += home ? 3 : -4;
  }
  const dr = p.dream;
  if (dr && !dr.done) {
    if (dr.type === 'top_league' && newPrest === 5 && curPrest < 5) { morale += D.dreamMorale; loyalty += D.dreamLoyalty; notes.push('Hayaline bir adım yaklaştı'); }
    if (dr.type === 'big_wage' && d.wage >= dr.target) { morale += D.dreamMorale; loyalty += D.dreamLoyalty; notes.push('Hayalindeki maaşa kavuştu'); }
  }
  if (d.bonus > d.wage * 12 * 0.1) morale += 3;
  return { morale, loyalty, notes };
}

/** Move/extend a player and apply every consequence. Commission and deals[] are handled by executeTransfer. */
function applyMove(S, p, to, d, opts = {}) {
  const D = BAL.market.deal;
  const season = S.time.season;
  const from = p.clubId ? S.clubs[p.clubId] : null;
  const kind = d.kind;
  const clauses = d.clauses || { minutes: false, release: false };
  const moved = !from || from.id !== to.id;
  const m = projectMinutes(S, p, to.id, { guarantee: !!clauses.minutes });
  const oldM = from ? projectMinutes(S, p, from.id) : 0;
  let transferFee = 0;
  if (kind === 'transfer' && moved) {
    transferFee = d.transferFee ?? estimateTransferFee(S, p, to);
    transferFee = Math.min(transferFee, Math.max(0, to.budget));
    to.budget = Math.max(0, to.budget - transferFee);
    if (from) from.budget += transferFee;
  }
  p.clubId = to.id;
  if (moved) p.moveAt = S.time.season * 12 + S.time.month;
  p.wage = Math.round(d.wage);
  if (kind === 'renewal') p.contractEnd = Math.max(p.contractEnd, season) + d.years;
  else p.contractEnd = (opts.seasonEnd ? season + 1 : season) + d.years - 1;
  p.guarantee = !!clauses.minutes;
  p.releaseClause = clauses.release ? tidy(p.value * D.releaseMult) : 0;
  const fit = careerFit(S, p, to, d, m, from, moved);
  p.morale = clamp(p.morale + fit.morale, 0, 100);
  p.loyalty = clamp(p.loyalty + fit.loyalty, 0, 100);
  if (moved) {
    to.trust = clamp(to.trust + D.newClubTrust, 0, 100);
    if (kind === 'transfer' && from) from.trust = clamp(from.trust + D.oldClubTrust, 0, 100);
  } else to.trust = clamp(to.trust + D.renewTrust, 0, 100);
  S.interests = S.interests.filter(i => i.playerId !== p.id);
  if (moved) {
    if (from) balanceSquad(S, from);
    balanceSquad(S, to);
    if (p.agentId === 'you') promises.onMove(S, p, oldM, m, !!opts.arranged);
  }
  return { transferFee, minutes: m, fit, from };
}

/**
 * Execute an agreed move (used by negotiation.js and deadline.js): settle fee, pay commission
 * (economy.earn 'commission'), record S.deals, move/extend the player with career-fit effects, news.
 * `kind:'free'` for a client with a running contract is a PRE-CONTRACT: commission now, move at season end
 * (`p.preContract`, executed by handleExpiry; old club trust −20).
 * @param {object} S
 * @param {{playerId:string, toClubId:string, kind:'transfer'|'free'|'renewal', wage:number, years:number,
 *   bonus:number, fee:number, clauses:{minutes:boolean,release:boolean}, transferFee?:number}} deal
 * @returns {Result} `{ok:true, events:[{type:'dealDone', ...}], deal}`
 */
export function executeTransfer(S, deal) {
  const p = S.players[deal.playerId];
  const to = S.clubs[deal.toClubId];
  if (!p || !to) return fail('Oyuncu veya kulüp bulunamadı');
  if (!['transfer', 'free', 'renewal'].includes(deal.kind)) return fail('Geçersiz anlaşma türü');
  const D = BAL.market.deal;
  const A = S.agency;
  const from = p.clubId ? S.clubs[p.clubId] : null;
  const clauses = { minutes: !!(deal.clauses && deal.clauses.minutes), release: !!(deal.clauses && deal.clauses.release) };
  const d = { ...deal, clauses, fee: Math.max(0, Math.round(deal.fee || 0)) };
  const commission = d.fee;
  const share = feeShare({ wage: d.wage, years: d.years, bonus: d.bonus, fee: d.fee, clauses });
  const events = [];
  const pre = d.kind === 'free' && !!from && p.contractEnd >= S.time.season && from.id !== to.id;
  let transferFee = 0, fit = null, minutes = 0;
  const fromClubId = from ? from.id : null;
  if (pre) {
    p.preContract = { toClubId: to.id, wage: d.wage, years: d.years, bonus: d.bonus, fee: 0, clauses, season: S.time.season };
    from.trust = clamp(from.trust + D.oldClubTrustFree, 0, 100);
    to.trust = clamp(to.trust + D.newClubTrust, 0, 100);
    S.interests = S.interests.filter(i => !(i.playerId === p.id));
    minutes = projectMinutes(S, p, to.id, { guarantee: clauses.minutes });
    news.push(S, { kind: 'transfer', playerId: p.id, clubId: to.id, text: p.name + ', sezon sonunda ' + to.name + ' ile bedelsiz anlaştı (ön sözleşme). ' + from.name + ' öfkeli.' });
  } else {
    const r = applyMove(S, p, to, d, { arranged: true });
    transferFee = r.transferFee; fit = r.fit; minutes = r.minutes;
    const text = d.kind === 'renewal' ? p.name + ' ' + to.name + ' ile sözleşme uzattı.'
      : d.kind === 'free' ? p.name + ', ' + to.name + ' ile bedelsiz anlaştı.'
        : p.name + ', ' + (from ? from.name : '?') + ' → ' + to.name + ' (Bonservis: ' + fmtMoney(transferFee) + ')';
    news.push(S, { kind: 'transfer', playerId: p.id, clubId: to.id, text });
  }
  if (commission > 0) earn(S, commission, 'commission', (d.kind === 'renewal' ? 'Sözleşme: ' : 'Transfer: ') + p.name);
  if (share > (deal.feeThreshold || feeThreshold(S)) + 1e-9) { p.loyalty = clamp(p.loyalty + D.feeNoticeLoyalty, 0, 100); events.push({ type: 'feeNoticed', playerId: p.id, share }); }
  const repRaw = d.kind === 'renewal' ? D.repRenewal : clamp(D.repBase + D.repLog * Math.log10(Math.max(1, p.value / D.repDiv)), D.repBase, D.repMax);
  const repGain = addRep(S, repRaw);
  A.stats.deals++;
  S.deals.push({ season: S.time.season, month: S.time.month, playerId: p.id, fromClubId, toClubId: to.id, fee: transferFee, commission, kind: d.kind });
  events.unshift({
    type: 'dealDone', playerId: p.id, fromClubId, toClubId: to.id, fee: transferFee, commission, wage: d.wage, years: d.years,
    kind: d.kind, bonus: d.bonus, preContract: pre, repGain, expectedMinutes: minutes, fit: fit ? { ...fit } : null, clauses,
  });
  return { ok: true, events, deal: { ...d, fromClubId, transferFee, commission, preContract: pre } };
}
