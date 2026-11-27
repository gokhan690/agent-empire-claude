// The market: club needs, interest in your clients, AI↔AI transfers, "Kulübe öner" (pitch)
// and executeTransfer (move, fee, commission, career-fit effects). Randomness only through rng.js.
import { BAL, POS, POS_ORDER } from './constants.js';
import { rint, gauss, uid, shuffle, pickBy } from './rng.js';
import { clamp, hash01, mean, tidy } from './util.js';
import { fairWage } from './valuation.js';
import { squadIndex, squadOf, clubStrength, projectMinutes } from './selection.js';
import { myClients, hasUpgrade } from './selectors.js';
import { earn, spendEnergy, addRep } from './economy.js';
import { genYouth } from './world.js';
import * as news from './news.js';

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

/** Club cost of a package: wage·12·years + bonus + fee. */
export function packageCost(pkg) { return Math.round(pkg.wage * 12 * pkg.years + pkg.bonus + pkg.fee); }
/** Share of the package cost that is your commission (0..1). */
export function feeShare(pkg) { const c = packageCost(pkg); return c > 0 ? pkg.fee / c : 0; }

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

export function strengthMap(S, idx) {
  const A = {};
  for (const cid in S.clubs) A[cid] = clubStrength(S, cid, idx[cid]);
  return A;
}
/** Recompute every club's needs from its squad. */
export function refreshNeeds(S, idx, A) {
  for (const cid in S.clubs) S.clubs[cid].needs = computeNeeds(S, S.clubs[cid], idx[cid], A[cid]);
}

// ------------------------------------------------------------------------------------------ squads

function dropPlayer(S, id) {
  delete S.players[id];
  S.interests = S.interests.filter(i => i.playerId !== id);
  S.inbox = S.inbox.filter(c => c.playerId !== id);
  S.found = S.found.filter(x => x !== id);
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

/** Rough Bonservis (transfer fee) the buyer would pay: value × (0.95 + 0.05·(need−1)). */
export function estimateTransferFee(S, p, club) {
  const D = BAL.market.deal;
  const nl = Math.max(1, needLevel(club, p.pos));
  return tidy(p.value * (D.feeFactorBase + D.feeFactorNeed * (nl - 1)));
}

export function interestTarget(S, p, club, A) {
  const W = BAL.market.interest;
  const nl = needLevel(club, p.pos);
  if (!nl) return 0;
  if (p.moveAt !== undefined && p.clubId && S.time.season * 12 + S.time.month - p.moveAt < W.moveLock) return 0; // just settled in: nobody bids again yet
  const delta = p.ca - A;
  let t = nl * W.needW + clamp(W.fitBase + delta * W.fitK, W.fitMin, W.fitMax) + p.form * W.formW + p.hype / W.hypeDiv + club.trust / W.trustDiv;
  t += p.age <= 23 ? W.ageYoung : p.age <= 29 ? W.ageMid : p.age <= 30 ? 0 : p.age <= 32 ? W.age31 : W.age33;
  const ratio = club.budget / Math.max(1, estimateTransferFee(S, p, club));
  if (ratio < W.budgetMinRatio) t = Math.min(t, W.unaffordableCap);
  else if (ratio >= W.budgetRich) t += W.budgetBonus;
  return clamp(Math.round(t), 0, 100);
}

/** Interest bookkeeping for the month: every club may build interest in each of your clients. */
function updateInterests(S, A, events) {
  const W = BAL.market.interest;
  for (const i of S.interests) {
    if (i.cooldown > 0) i.cooldown--;
    if (i.boost) { i.boost = Math.round(i.boost * W.boostDecay); if (i.boost < 1) i.boost = 0; }
  }
  for (const p of myClients(S)) {
    const byClub = new Map();
    for (const i of S.interests) if (i.playerId === p.id) byClub.set(i.clubId, i);
    for (const cid of Object.keys(S.clubs).sort()) {
      if (cid === p.clubId) continue;
      const club = S.clubs[cid];
      const target = interestTarget(S, p, club, A[cid]);
      const ex = byClub.get(cid);
      if (ex) {
        const before = ex.level;
        const goal = target + (ex.boost || 0);
        if (target <= 0 && !(ex.boost > 0)) ex.level = Math.max(0, ex.level - W.decay);
        else ex.level = clamp(Math.round(ex.level + (goal - ex.level) * W.pull + gauss(S, 0, W.noise)), 0, 100);
        if (ex.level < W.drop) S.interests = S.interests.filter(x => x !== ex);
        else if (before < W.open && ex.level >= W.open) events.push({ type: 'interest', interestId: ex.id, playerId: p.id, clubId: cid, level: ex.level });
      } else if (target >= W.create) {
        const i = { id: uid(S, 'i'), playerId: p.id, clubId: cid, level: Math.round(target * 0.6), cooldown: 0, boost: 0 };
        S.interests.push(i);
        if (i.level >= W.open) events.push({ type: 'interest', interestId: i.id, playerId: p.id, clubId: cid, level: i.level });
      }
    }
    const mine = S.interests.filter(i => i.playerId === p.id).sort((a, b) => b.level - a.level);
    if (mine.length > W.perPlayer) {
      const drop = new Set(mine.slice(W.perPlayer).map(i => i.id));
      S.interests = S.interests.filter(i => !drop.has(i.id));
    }
  }
  S.interests = S.interests.filter(i => S.players[i.playerId] && S.players[i.playerId].agentId === 'you' && S.clubs[i.clubId]);
}

// ------------------------------------------------------------------------------------------ AI transfers

function aiTransfers(S, idx, A, events) {
  const AI = BAL.market.ai, SQ = BAL.squad;
  const month = S.time.month;
  const mf = AI.monthFactor[month] ?? 0; // AI clubs trade in July, August and January only
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
      p.clubId = bid;
      p.wage = Math.max(BAL.wage.min, r100(fairWage(S, p, buyer.leagueId) * clamp(gauss(S, 1, 0.1), 0.8, 1.25)));
      p.contractEnd = S.time.season + rint(S, AI.contract[0], AI.contract[1]);
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
 * Monthly: recompute needs, AI clubs trade in their windows (0–2 signings each), build/decay interest in your clients.
 * @returns {object[]} UI events (`{type:'interest'|'aiTransfer', ...}`)
 */
export function monthly(S) {
  const events = [];
  let idx = squadIndex(S);
  let A = strengthMap(S, idx);
  refreshNeeds(S, idx, A);
  if (BAL.market.ai.windowMonths.includes(S.time.month)) {
    aiTransfers(S, idx, A, events);
    idx = squadIndex(S);
    A = strengthMap(S, idx);
    refreshNeeds(S, idx, A);
  }
  updateInterests(S, A, events);
  return events;
}

// ------------------------------------------------------------------------------------------ pitch ("Kulübe öner")

/** The club's natural appetite (0..100) for a client — what the pitch is judged by. Pure. */
export function pitchTarget(S, p, club) {
  const A = clubStrength(S, club.id);
  return interestTarget(S, p, club, A);
}
/** Word shown in the club picker: how likely the club listens. */
export function pitchFit(S, p, club) {
  const t = pitchTarget(S, p, club) * (hasUpgrade(S, 'network') ? BAL.upgrade.networkBoost : 1);
  const P = BAL.market.pitch;
  return t >= P.listen ? 'İlgilenir' : t >= P.maybe ? 'Belki' : 'Zor';
}

function pitchCheck(S, a) {
  const p = a && S.players[a.playerId];
  const club = a && S.clubs[a.clubId];
  if (!p || p.agentId !== 'you') return 'Müşterin değil';
  if (!club) return 'Kulüp bulunamadı';
  if (p.clubId === club.id) return 'Zaten bu kulüpte';
  const ex = S.interests.find(i => i.playerId === p.id && i.clubId === club.id);
  if (ex && ex.cooldown > 0) return 'Direktör küs (' + ex.cooldown + ' ay)';
  return null;
}

/**
 * "Kulübe öner": 1 energy. A club whose appetite is high enough listens at once (a table can be opened);
 * a lukewarm one warms up a little.
 * @param {object} S
 * @param {{playerId:string, clubId:string}} a
 * @returns {Result} `{ok, events:[{type:'pitch', fit, level, offer}], interestId, offer}`
 */
export function pitchPlayer(S, a) {
  const err = pitchCheck(S, a);
  if (err) return fail(err);
  if (S.agency.energy < 1) return fail('Enerjin yetmiyor');
  const p = S.players[a.playerId], club = S.clubs[a.clubId];
  const P = BAL.market.pitch, W = BAL.market.interest;
  const mult = hasUpgrade(S, 'network') ? BAL.upgrade.networkBoost : 1;
  let t = pitchTarget(S, p, club) * mult;
  let ex = S.interests.find(i => i.playerId === p.id && i.clubId === club.id);
  if (!ex) { ex = { id: uid(S, 'i'), playerId: p.id, clubId: club.id, level: 0, cooldown: 0, boost: 0 }; S.interests.push(ex); }
  const before = ex.level;
  const offer = t >= P.listen;
  const fit = offer ? 'İlgilenir' : t >= P.maybe ? 'Belki' : 'Zor';
  if (offer) { ex.level = Math.max(ex.level, P.offerLevel); ex.boost = Math.min(W.boostMax, Math.max(0, P.offerLevel - Math.round(t))); }
  else ex.level = clamp(ex.level + (t >= P.maybe ? 12 : P.weak), 0, 59);
  spendEnergy(S, 1);
  return { ok: true, events: [{ type: 'pitch', playerId: p.id, clubId: club.id, fit, levelBefore: before, level: ex.level, offer, interestId: ex.id }], interestId: ex.id, offer };
}

// ------------------------------------------------------------------------------------------ executing a move

function careerFit(S, p, to, d, m, from) {
  const D = BAL.market.deal;
  const N = BAL.neg;
  let mood = clamp(Math.round((m - 0.5) * D.minutesMood), -12, 12) + D.moveMood;
  const demand = d.demand || d.wage;
  if (d.wage >= demand * N.happyWage) mood += N.mood.happy;
  return { mood };
}

/** Move a player and apply every consequence. Commission and deals[] are handled by executeTransfer. */
function applyMove(S, p, to, d) {
  const D = BAL.market.deal;
  const season = S.time.season;
  const from = p.clubId ? S.clubs[p.clubId] : null;
  const moved = !from || from.id !== to.id;
  const m = projectMinutes(S, p, to.id);
  let transferFee = d.transferFee ?? estimateTransferFee(S, p, to);
  transferFee = Math.min(transferFee, Math.max(0, to.budget));
  to.budget = Math.max(0, to.budget - transferFee);
  if (from) from.budget += transferFee;
  p.clubId = to.id;
  p.moveAt = season * 12 + S.time.month;
  p.wage = Math.round(d.wage);
  p.contractEnd = season + d.years - 1;
  const fit = careerFit(S, p, to, d, m, from);
  p.mood = clamp(p.mood + fit.mood, 0, 100);
  if (moved) {
    to.trust = clamp(to.trust + D.newClubTrust, 0, 100);
    if (from) from.trust = clamp(from.trust + D.oldClubTrust, 0, 100);
  }
  S.interests = S.interests.filter(i => i.playerId !== p.id);
  if (from) balanceSquad(S, from);
  balanceSquad(S, to);
  return { transferFee, minutes: m, fit, from };
}

/**
 * Execute an agreed transfer (used by negotiation.js): settle the club-to-club fee, pay your commission
 * (economy.earn 'commission'), record S.deals, move the player, news.
 * @param {object} S
 * @param {{playerId:string, toClubId:string, wage:number, years:number, bonus:number, fee:number, demand?:number, transferFee?:number}} deal
 * @returns {Result} `{ok:true, events:[{type:'dealDone', ...}], deal}`
 */
export function executeTransfer(S, deal) {
  const p = S.players[deal.playerId];
  const to = S.clubs[deal.toClubId];
  if (!p || !to) return fail('Oyuncu veya kulüp bulunamadı');
  const D = BAL.market.deal;
  const events = [];
  const d = { ...deal, fee: Math.max(0, Math.round(deal.fee || 0)) };
  const share = feeShare(d);
  const fromClubId = p.clubId || null;
  const r = applyMove(S, p, to, d);
  const from = r.from;
  news.push(S, { kind: 'transfer', playerId: p.id, clubId: to.id, text: p.name + ', ' + (from ? from.name : '?') + ' → ' + to.name + ' (Bonservis: ' + fmtMoney(r.transferFee) + ')' });
  const commission = d.fee;
  if (commission > 0) earn(S, commission, 'commission', 'Transfer: ' + p.name);
  if (share > BAL.neg.greedyShare + 1e-9) { p.mood = clamp(p.mood + BAL.neg.mood.greedy, 0, 100); events.push({ type: 'feeNoticed', playerId: p.id, share }); }
  const repRaw = clamp(D.repBase + D.repLog * Math.log10(Math.max(1, p.value / D.repDiv)), D.repBase, D.repMax);
  const repGain = addRep(S, repRaw);
  S.agency.stats.deals++;
  S.deals.push({ season: S.time.season, month: S.time.month, playerId: p.id, fromClubId, toClubId: to.id, fee: r.transferFee, commission });
  events.unshift({ type: 'dealDone', playerId: p.id, fromClubId, toClubId: to.id, fee: r.transferFee, commission, wage: d.wage, years: d.years, bonus: d.bonus, repGain, expectedMinutes: r.minutes });
  return { ok: true, events, deal: { ...d, fromClubId, transferFee: r.transferFee, commission } };
}
