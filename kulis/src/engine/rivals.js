// PHASE 2a (partly done): computeRanking works; monthly() is a stub.
// Rivals: S.rivals[] hold portfolios via player.agentId === rival.id.
import { BAL } from './constants.js';
import { myClients } from './selectors.js';

/**
 * agencyScore = Σ(top-N client values · 0.08) + cash·0.5 + rep·50_000 (N = BAL.rank.topClients,
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
  const top = vals => (vals || []).sort((a, b) => b - a).slice(0, R.topClients).reduce((s, v) => s + v, 0);
  const rows = [{ id: 'you', name: S.meta.agencyName, score: Math.round(top(byAgent.you) * R.clientW + S.agency.cash * R.cashW + S.agency.rep * R.repW) }];
  for (const r of S.rivals) {
    r.score = Math.round(top(byAgent[r.id]) * R.clientW + r.cash * R.cashW + r.rep * R.repW);
    rows.push({ id: r.id, name: r.agency, score: r.score });
  }
  rows.sort((a, b) => b.score - a.score);
  S.ranking = rows;
  return rows;
}

/**
 * STUB — phase 2a. Monthly (turn step 7): raise heat of discovered unrepresented players (faster for obvious
 * talents; akademisyen faster on U21; scout L4 −30% on shortlist), rivals sign prospects at heat 100,
 * approach your clients with loyalty < 35 (inbox event: match with a promise / pay a loyalty bonus / let go),
 * grow rival rep/cash. MUST call computeRanking(S) at the end.
 * @param {object} S
 * @returns {object[]} rivalMoves `[{type:'rival', rivalId, text, playerId?}]`
 */
export function monthly(S) { computeRanking(S); return []; }
