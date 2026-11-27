// Rivals: S.rivals[] hold portfolios via player.agentId === rival.id. Background signings, candidate sniping, ranking.
import { BAL } from './constants.js';
import { chance, pick, gauss } from './rng.js';
import { clamp } from './util.js';
import * as news from './news.js';

/**
 * agencyScore = Σ(top-N client values: clientW·√(€M)) + cash·cashW + rep·repW. Writes rival.score and S.ranking
 * (sorted desc, 5 rows, id 'you' for the player).
 * @param {object} S
 */
export function computeRanking(S) {
  const R = BAL.rank;
  const byAgent = {};
  for (const id in S.players) {
    const p = S.players[id];
    if (p.agentId) (byAgent[p.agentId] = byAgent[p.agentId] || []).push(p.value);
  }
  const top = vals => (vals || []).sort((a, b) => b - a).slice(0, R.topClients).reduce((s, v) => s + R.clientW * Math.sqrt(v / 1e6), 0);
  const rows = [{ id: 'you', name: S.meta.agencyName, score: Math.round(top(byAgent.you) + S.agency.cash * R.cashW + S.agency.rep * R.repW) }];
  for (const r of S.rivals) {
    r.score = Math.round(top(byAgent[r.id]) + r.cash * R.cashW + r.rep * R.repW);
    rows.push({ id: r.id, name: r.agency, score: r.score });
  }
  rows.sort((a, b) => b.score - a.score);
  S.ranking = rows;
  return rows;
}

/** A "star" for the purposes of rival portfolio caps: a strong player or a top prospect. */
export function isElite(p) {
  const A = BAL.rivalAI;
  return p.ca >= A.eliteCa || (p.age <= 21 && p.pa >= A.eliteYouthPa);
}
function eliteCount(S, rid) {
  let n = 0;
  for (const id in S.players) { const p = S.players[id]; if (p.agentId === rid && isElite(p)) n++; }
  return n;
}
function hasRoom(S, r, p, cache) {
  if (!isElite(p)) return true;
  const base = BAL.rivals.find(x => x.id === r.id);
  if (!cache[r.id]) cache[r.id] = eliteCount(S, r.id);
  return cache[r.id] < (base && base.eliteCap !== undefined ? base.eliteCap : 99);
}

/** A rival takes an unrepresented player. */
export function signRival(S, r, p, moves, report = true) {
  p.agentId = r.id;
  if (report) {
    const text = `${r.agency}, ${p.name} (${p.age}) ile anlaştı.`;
    news.push(S, { kind: 'rivalSign', playerId: p.id, text });
    moves.push({ type: 'rival', rivalId: r.id, playerId: p.id, text });
    r.rep = clamp(r.rep + 0.3, BAL.rivalAI.repMin, BAL.rivalAI.repMax);
  }
}

/**
 * Monthly: rivals snipe candidates you found but did not sign (a flat monthly chance, no meters), sign unseen players
 * slowly in the background and lose some; rival rep/cash evolve. Always ends with computeRanking(S).
 * @returns {object[]} rivalMoves `[{type:'rival', rivalId, text, playerId?, sniped?}]`
 */
export function monthly(S) {
  const A = BAL.rivalAI;
  const moves = [];
  const eliteCache = {};
  const sizes = {};
  const unseen = [];
  for (const id in S.players) {
    const p = S.players[id];
    if (p.agentId && p.agentId !== 'you') sizes[p.agentId] = (sizes[p.agentId] || 0) + 1;
    else if (!p.agentId && p.clubId && !p.seen) unseen.push(p);
  }
  // 1. candidates you found and left alone
  for (const pid of S.found.slice()) {
    const p = S.players[pid];
    if (!p || p.agentId) { S.found = S.found.filter(x => x !== pid); continue; }
    if (!chance(S, A.snipe)) continue;
    const open = S.rivals.filter(rv => hasRoom(S, rv, p, eliteCache));
    if (!open.length) continue;
    const r = pick(S, open);
    signRival(S, r, p, moves, false);
    S.found = S.found.filter(x => x !== pid);
    const text = `${p.name}, ${r.agency} ile anlaştı: elinden kaçtı.`;
    news.push(S, { kind: 'rivalSign', playerId: p.id, text });
    moves.push({ type: 'rival', rivalId: r.id, playerId: p.id, text, sniped: true });
  }
  // 2. background: rivals sign unseen players slowly, lose clients
  for (const r of S.rivals) {
    if (unseen.length && chance(S, A.bgSign * ((sizes[r.id] || 0) < A.minPortfolio ? 2 : 1))) {
      let best = null, bw = -1;
      for (let i = 0; i < A.bgSample; i++) {
        const p = pick(S, unseen);
        if (p.agentId) continue;
        const w = (p.ca - 40) / 20 + (p.age <= 21 ? 1 : 0);
        if (w > bw) { bw = w; best = p; }
      }
      if (best && hasRoom(S, r, best, eliteCache)) {
        signRival(S, r, best, moves, false);
        if (isElite(best)) delete eliteCache[r.id];
        sizes[r.id] = (sizes[r.id] || 0) + 1;
      }
    }
    if (chance(S, A.bgLose) && (sizes[r.id] || 0) > A.minPortfolio / 2) {
      const mine = [];
      for (const id in S.players) { const p = S.players[id]; if (p.agentId === r.id) mine.push(p); }
      if (mine.length) { const p = pick(S, mine); p.agentId = null; sizes[r.id]--; }
    }
  }
  // 3. rival rep & cash evolve
  const income = {};
  for (const id in S.players) { const p = S.players[id]; if (p.agentId && p.agentId !== 'you') income[p.agentId] = (income[p.agentId] || 0) + p.wage * 0.07; }
  for (const r of S.rivals) {
    const base = BAL.rivals.find(x => x.id === r.id);
    const goal = base.cash * (1 + A.cashGrowth * (S.time.season - 1));
    r.cash = Math.max(A.cashFloor, Math.round(r.cash + (income[r.id] || 0) * A.incomeShare - A.upkeepBase - r.rep * A.upkeepRep + (goal - r.cash) * A.cashPull));
    const target = base.rep + Math.min(14, (sizes[r.id] || 0) / 8) - 4;
    r.rep = Math.round(clamp(r.rep + (target - r.rep) * A.repPull + gauss(S, 0, A.repNoise), A.repMin, A.repMax) * 10) / 10;
  }
  computeRanking(S);
  return moves;
}
