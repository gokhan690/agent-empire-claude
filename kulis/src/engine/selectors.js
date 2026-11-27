// Read-only helpers. Safe to call from the UI every render. Never mutate S, never touch RNG.
import { BAL, MONTHS } from './constants.js';
import { clamp, hash01 } from './util.js';
import { squadOf } from './selection.js';
export { squadOf, squadIndex, projectMinutes, clubStrength } from './selection.js';

/** All players represented by you (agentId === 'you'). */
export function myClients(S) {
  const out = [];
  for (const id in S.players) { const p = S.players[id]; if (p.agentId === 'you') out.push(p); }
  return out;
}
/** The club object of a player (or null). */
export function clubOf(S, p) { return p && p.clubId ? S.clubs[p.clubId] || null : null; }
/** The league object a club plays in. */
export function leagueOf(S, club) { return club ? S.leagues[club.leagueId] || null : null; }

// ---------------------------------------------------------------- stars
/** Current level as 1..5 stars (CA < 50 → 1, 50s → 2, 60s → 3, 70s → 4, 80+ → 5). */
export function starsOf(v) { return clamp(Math.floor((v - 30) / 10), 1, 5); }
/**
 * Potential as stars: an exact value once the player was watched ("İzle", know = 100), else a small range
 * (≈ 18 CA points wide with a stable hashed offset; the true potential is always inside).
 * @returns {{lo:number, hi:number, exact:boolean}}
 */
export function potentialStars(S, p) {
  if (p.know >= 100) { const s = starsOf(p.pa); return { lo: s, hi: s, exact: true }; }
  const w = BAL.scout.bandWidth;
  const lo = Math.max(p.ca, p.pa - hash01(p.id + ':band') * w);
  const hi = Math.max(p.pa, Math.min(99, lo + w));
  let a = starsOf(lo), b = starsOf(hi);
  if (a === b) { // an unknown potential never looks exact: widen the range by one star (the truth stays inside)
    if (b < 5 && (hash01(p.id + ':wide') > 0.5 || a <= starsOf(p.ca))) b++;
    else a--;
  }
  return { lo: a, hi: b, exact: false };
}
/** Level used for the "who can I sign" gate: CA plus a small premium for youngsters (no hidden data). */
export function signLevel(p) { const R = BAL.recruit; return p.ca + (p.age <= 21 ? R.youth21 : p.age <= 24 ? R.youth24 : 0); }
/** Reputation needed to sign this player. */
export function repNeeded(p) { const R = BAL.recruit; return Math.max(0, Math.ceil((signLevel(p) - R.repBase) / R.repSlope)); }

/** Season-to-date share of available minutes (0..1); falls back to the smoothed recent share early on. */
export function minutesShare(S, p) {
  const club = S.clubs[p.clubId];
  const L = club ? S.leagues[club.leagueId] : null;
  if (!L || L.matchday < 2) return p.st.sh;
  return clamp(p.st.mins / (L.matchday * 90), 0, 1);
}
/** Table rows sorted: pts, goal difference, goals for, id. Each row: {clubId,p,w,d,l,gf,ga,gd,pts}. */
export function tableSorted(S, leagueId) {
  const L = S.leagues[leagueId];
  const rows = L.clubIds.map(id => ({ clubId: id, ...L.table[id], gd: L.table[id].gf - L.table[id].ga }));
  rows.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || (a.clubId < b.clubId ? -1 : 1));
  return rows;
}
/** Turkish name of the current month. */
export function monthName(S) { return MONTHS[S.time.month].name; }
/** Can the agency pay `cost = {energy?, cash?}`? */
export function canAfford(S, cost = {}) {
  return (cost.energy || 0) <= S.agency.energy && (cost.cash || 0) <= S.agency.cash;
}
/** Season-average match rating (0 when no apps). */
export function avgRating(p) { return p.st.apps ? Math.round(p.st.ratingSum / p.st.apps * 10) / 10 : 0; }
/** Average of the last ≤4 ratings (0 when none). */
export function avgRecent(p) {
  const l = p.st.last;
  return l.length ? Math.round(l.reduce((a, b) => a + b, 0) / l.length * 10) / 10 : 0;
}
/** Years left on a contract: 0 means it expires this June. */
export function contractYearsLeft(S, p) { return p.contractEnd - S.time.season; }

// ---------------------------------------------------------------- upgrades & money
/** Do you own this office upgrade? (`office scouts lawyer network academy brand`) */
export function hasUpgrade(S, id) { return !!S.agency.upgrades[id]; }
/** Max energy per month. */
export function energyMaxFor(S) { return BAL.energy.base + (hasUpgrade(S, 'office') ? 1 : 0); }
/** Share (%) of each client's wage you earn every month. */
export function commissionPct(S) { return hasUpgrade(S, 'lawyer') ? BAL.upgrade.lawyerPct : BAL.start.commissionPct; }
/** Monthly office upkeep (base + upgrades + staff per client + reputation tier). */
export function officeUpkeep(S) {
  const E = BAL.econ;
  let v = BAL.start.upkeep;
  for (const k in S.agency.upgrades) if (S.agency.upgrades[k]) v += E.upkeepUpgrade;
  const mine = myClients(S);
  v += Math.max(0, mine.length - E.staff.free) * E.staff.perClient;
  for (const p of mine) v += Math.max(0, p.value - E.staff.valueFrom) * E.staff.valueShare;
  let tier = 0;
  for (const [rep, cost] of E.repTier) if (S.agency.rep >= rep) tier = cost;
  return Math.round(v + tier);
}
/** Expected monthly commission income from current clients' wages. */
export function monthlyCommission(S) {
  let v = 0;
  for (const p of myClients(S)) v += p.wage * commissionPct(S) / 100;
  return Math.round(v);
}
/** Absolute month counter (season*12+month) for "months since" arithmetic. */
export function monthIndex(S) { return S.time.season * 12 + S.time.month; }

/** Why an interest cannot be turned into a table right now (Turkish), or null when it can. */
export function interestOpenReason(S, i) {
  const p = S.players[i.playerId];
  if (!p || p.agentId !== 'you') return 'Müşterin değil';
  if (!S.clubs[i.clubId]) return 'Kulüp yok';
  if (i.cooldown > 0) return 'Direktör küs (' + i.cooldown + ' ay)';
  if (i.level < BAL.neg.minLevel) return 'İlgi yetersiz';
  return null;
}
/**
 * The player-visible part of the open table (S.negotiation minus the hidden ceiling). Safe for the UI.
 * @returns {object|null}
 */
export function negotiationView(S) {
  const n = S.negotiation;
  if (!n) return null;
  const { hidden, ...pub } = n;
  return JSON.parse(JSON.stringify(pub));
}

// UI-facing views (hubSummary, clientView, candidateList, offerList, rankingView, ...).
export * from './views.js';
