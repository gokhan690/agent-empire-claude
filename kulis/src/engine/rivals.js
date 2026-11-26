// Rivals: S.rivals[] hold portfolios via player.agentId === rival.id. Heat, background signings, poaching, ranking.
import { BAL } from './constants.js';
import { rint, chance, pick, pickBy, gauss } from './rng.js';
import { clamp } from './util.js';
import { myClients, upgradeEffects, prospectLevel, monthIndex, isRecruitable } from './selectors.js';
import { fairWage } from './valuation.js';
import * as events from './events.js';
import * as promises from './promises.js';
import * as news from './news.js';

/**
 * agencyScore = Σ(top-N client values: clientW·√(€M))  + cash·0.5 + rep·50_000 (N = BAL.rank.topClients,
 * so rivals with 70-man portfolios do not run away with it). Writes rival.score and S.ranking
 * (sorted desc, 5 rows, id 'you' for the player).
 * @param {object} S
 * @returns {Array<{id:string,name:string,score:number}>}
 */
export function computeRanking(S) {
  const R = BAL.rank;
  const byAgent = {};
  for (const id in S.players) {
    const p = S.players[id];
    if (p.agentId) (byAgent[p.agentId] = byAgent[p.agentId] || []).push(p.value);
  }
  // portfolio points: Σ over the top-N clients of clientW · √(value in €M) — star-heavy portfolios count, but sub-linearly
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

/** How strongly a rival persona wants this player (for picking who signs him). */
function rivalWeight(r, p) {
  switch (r.persona) {
    case 'holding': return Math.max(0, p.ca - 55) / 10 + 0.2 + (prospectLevel(p) >= 70 ? 2 : 0);
    case 'akademisyen': return p.age <= 21 ? 3 : 0.4;
    case 'eskidost': return p.age >= 27 ? 2 : 0.7;
    default: return 1;
  }
}

function signRival(S, r, p, moves, report) {
  const A = BAL.rivalAI;
  p.agentId = r.id;
  p.rep = { commissionPct: rint(S, A.commission[0], A.commission[1]), endSeason: S.time.season + rint(S, 1, 3) };
  p.heat = 0; p.shortlisted = false;
  if (report) {
    const text = `${r.agency}, ${p.name} (${p.age}) ile anlaştı.`;
    news.push(S, { kind: 'rivalSign', playerId: p.id, text });
    moves.push({ type: 'rival', rivalId: r.id, playerId: p.id, text });
    r.rep = clamp(r.rep + 0.3, BAL.rivalAI.repMin, BAL.rivalAI.repMax);
  }
}

function heatRate(S, p, fx, hasAkademisyen) {
  const A = BAL.rivalAI;
  const obv = clamp((prospectLevel(p) - A.heatObvFrom) / A.heatObvSpan, 0, 1);
  let rate = A.heatBase + A.heatObv * obv + p.hype * A.heatHype;
  if (hasAkademisyen && p.age <= 21) rate *= A.akademisyenU21;
  if (p.shortlisted) rate *= fx.heatMult;
  return rate;
}

/** Current monthly heat gain of a discovered prospect (for the UI: "ısı +x/ay"). Read-only. */
export function heatPerMonth(S, p) {
  return Math.round(heatRate(S, p, upgradeEffects(S), S.rivals.some(r => r.persona === 'akademisyen')) * 10) / 10;
}

function resolvePoaching(S, moves) {
  const pend = S.flags.poach;
  if (!pend) return;
  const A = BAL.rivalAI;
  const now = monthIndex(S);
  for (const pid of Object.keys(pend)) {
    const rec = pend[pid];
    const p = S.players[pid];
    const r = S.rivals.find(x => x.id === rec.rid);
    const cardOpen = S.inbox.some(c => c.id === rec.cardId);
    if (!p || !r) { delete pend[pid]; continue; }
    if (cardOpen && now - rec.at < 3) continue;
    if (cardOpen) S.inbox = S.inbox.filter(c => c.id !== rec.cardId);
    delete pend[pid];
    if (p.agentId === 'you') {
      if (p.loyalty > rec.loy + 10 || p.loyalty >= A.poachLoyalty) continue; // he stayed
      p.agentId = null; p.rep = null; // ignored: he walks
      S.promises = S.promises.filter(pr => pr.playerId !== p.id || pr.status !== 'open');
    } else if (p.agentId) continue;
    signRival(S, r, p, moves, false);
    const text = `${p.name}, ${S.meta.agencyName} ile yollarını ayırıp ${r.agency} ile anlaştı.`;
    news.push(S, { kind: 'poach', playerId: p.id, text });
    moves.push({ type: 'rival', rivalId: r.id, playerId: p.id, text, poached: true });
  }
}

function pickPoacher(S, p) {
  const rs = S.rivals.filter(r => {
    if (r.persona === 'akademisyen') return p.age <= 21;
    if (r.persona === 'holding') return p.ca >= 60;
    if (r.persona === 'eskidost') return p.loyalty < 20;
    return true;
  });
  if (!rs.length) return null;
  return pickBy(S, rs, r => (r.persona === 'kopekbaligi' ? 3 : 1));
}

function poachCard(S, p, r) {
  const A = BAL.rivalAI;
  const bonus = clamp(Math.round(p.wage * A.poachBonusK / 1000) * 1000, A.poachBonusMin, A.poachBonusMax);
  const type = p.trait === 'paraci' ? 'wage' : p.trait === 'sadik' || p.trait === 'ailebabasi' ? 'visit' : 'minutes';
  const prom = promises.make(S, p, type);
  return {
    key: 'poach:' + p.id, kind: 'rival', title: `${r.agency} ${p.name} için devrede`, from: r.name, playerId: p.id, expiresIn: 2,
    body: `${r.name} (${r.agency}), ${p.name}'e kancayı attı. Son zamanlarda kendini ihmal edilmiş hissediyor. Hamle yapmazsan gidebilir.`,
    options: [
      { id: 'promise', label: 'Söz ver', hint: prom.text, cost: { energy: 0, cash: 0 }, risk: null, effects: [{ promise: prom, playerId: p.id }, { loyalty: A.poachPromiseLoyalty, playerId: p.id }] },
      { id: 'bonus', label: `Bağlılık primi öde (€${bonus.toLocaleString('tr-TR')})`, hint: `Bağlılık +${A.poachBonusLoyalty}`, cost: { energy: 0, cash: bonus }, risk: null, effects: [{ loyalty: A.poachBonusLoyalty, playerId: p.id }] },
      { id: 'letgo', label: 'Gitmesine izin ver', hint: `${r.agency} ile anlaşır`, cost: { energy: 0, cash: 0 }, risk: null, effects: [{ releaseClient: p.id }] },
    ],
  };
}

/**
 * Monthly (turn step 7): raise heat of discovered unrepresented players (faster for obvious talents;
 * akademisyen faster on U21; scout L4 −30% on shortlist); at 100 a rival signs him. Rivals also sign unseen players
 * at a slow rate and lose clients; poaching approaches on your clients with loyalty < 35; rival rep/cash evolve.
 * Always ends with computeRanking(S).
 * @param {object} S
 * @returns {object[]} rivalMoves `[{type:'rival', rivalId, text, playerId?}]`
 */
export function monthly(S) {
  const A = BAL.rivalAI;
  const moves = [];
  const fx = upgradeEffects(S);
  const hasAk = S.rivals.some(r => r.persona === 'akademisyen');
  resolvePoaching(S, moves);

  // 1. heat on discovered, unrepresented prospects
  const unseen = [];
  const sizes = {};
  for (const id in S.players) {
    const p = S.players[id];
    if (p.agentId && p.agentId !== 'you') sizes[p.agentId] = (sizes[p.agentId] || 0) + 1;
    if (p.agentId || !p.clubId) continue;
    if (p.seen) {
      p.heat = Math.min(100, Math.round((p.heat + heatRate(S, p, fx, hasAk)) * 10) / 10);
      if (p.heat >= 100) {
        const r = pickBy(S, S.rivals, rv => rivalWeight(rv, p));
        signRival(S, r, p, moves, true);
      }
    } else unseen.push(p);
  }

  // 2. background: rivals sign unseen players slowly, lose clients
  for (const r of S.rivals) {
    const mine = [];
    if (unseen.length && chance(S, A.bgSign * ((sizes[r.id] || 0) < A.minPortfolio ? 2 : 1))) {
      let best = null, bw = -1;
      for (let i = 0; i < A.bgSample; i++) {
        const p = pick(S, unseen);
        if (p.agentId) continue;
        const w = rivalWeight(r, p) + (p.ca - 40) / 20;
        if (w > bw) { bw = w; best = p; }
      }
      if (best) {
        signRival(S, r, best, moves, false);
        sizes[r.id] = (sizes[r.id] || 0) + 1;
        if (best.ca >= 62 || (best.age <= 19 && best.pa >= 75)) {
          const text = `${r.agency}, ${best.name} (${best.age}) ile anlaştı.`;
          news.push(S, { kind: 'rivalSign', playerId: best.id, text });
          moves.push({ type: 'rival', rivalId: r.id, playerId: best.id, text });
        }
      }
    }
    if (chance(S, A.bgLose) && (sizes[r.id] || 0) > A.minPortfolio / 2) {
      for (const id in S.players) { const p = S.players[id]; if (p.agentId === r.id) mine.push(p); }
      if (mine.length) { const p = pick(S, mine); p.agentId = null; p.rep = null; sizes[r.id]--; }
    }
  }

  // 3. poaching approaches on weak-loyalty clients (one per month)
  const pend = S.flags.poach = S.flags.poach || {};
  const cool = S.flags.poachCool = S.flags.poachCool || {};
  const now = monthIndex(S);
  if (Object.keys(pend).length < A.poachMaxPending) {
    const cands = myClients(S).filter(p => p.loyalty < A.poachLoyalty && !pend[p.id] && (cool[p.id] === undefined || now - cool[p.id] >= A.poachCooldown));
    cands.sort((a, b) => a.loyalty - b.loyalty || (a.id < b.id ? -1 : 1));
    if (cands.length && chance(S, A.poachChance)) {
      const p = cands[0];
      const r = pickPoacher(S, p);
      if (r) {
        const card = events.addCard(S, poachCard(S, p, r));
        pend[p.id] = { rid: r.id, cardId: card.id, at: now, loy: p.loyalty };
        cool[p.id] = now;
        moves.push({ type: 'rival', rivalId: r.id, playerId: p.id, text: `${r.agency}, müşterin ${p.name} ile temasa geçti.`, approach: true });
      }
    }
  }

  // 4. rival rep & cash evolve
  const income = {};
  for (const id in S.players) { const p = S.players[id]; if (p.agentId && p.agentId !== 'you' && p.rep) income[p.agentId] = (income[p.agentId] || 0) + p.wage * p.rep.commissionPct / 100; }
  for (const r of S.rivals) {
    const base = BAL.rivals.find(x => x.id === r.id);
    const inc = income[r.id] || 0;
    const goal = base.cash * (1 + A.cashGrowth * (S.time.season - 1));
    r.cash = Math.max(A.cashFloor, Math.round(r.cash + inc * A.incomeShare - A.upkeepBase - r.rep * A.upkeepRep + (goal - r.cash) * A.cashPull));
    const target = base.rep + Math.min(20, (sizes[r.id] || 0) / 5) - 6;
    r.rep = Math.round(clamp(r.rep + (target - r.rep) * A.repPull + gauss(S, 0, A.repNoise), A.repMin, A.repMax) * 10) / 10;
  }
  computeRanking(S);
  return moves;
}
