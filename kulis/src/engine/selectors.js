// Read-only helpers. Safe to call from the UI every render. Never mutate S, never touch RNG.
import { BAL, MONTHS } from './constants.js';
import { clamp, hash01 } from './util.js';
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
/** League object of the club a player is at. */
export function leagueOfPlayer(S, p) { return leagueOf(S, clubOf(S, p)); }

/**
 * Potential band shown to the player: width ≈ (100−know)·0.3 CA points. The true `pa` is
 * always inside the band; the band's offset is a stable hash of the player id (not the centre).
 * @returns {{lo:number, hi:number}}
 */
export function potentialBand(S, p) {
  const w = (100 - p.know) * 0.3;
  const f = hash01(p.id + ':band');
  let lo = Math.max(p.ca, p.pa - f * w);
  let hi = Math.min(99, lo + w);
  if (hi < p.pa) hi = p.pa;
  return { lo: Math.round(lo), hi: Math.round(Math.max(hi, lo)) };
}

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
/** Is the transfer window open this month? */
export function isWindowOpen(S) { return MONTHS[S.time.month].window; }
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
/** Max energy given office upgrades. */
export function energyMaxFor(S) {
  const n = S.agency.upgrades.network;
  return Math.min(BAL.energy.max, BAL.energy.base + (n >= 1 ? 1 : 0) + (n >= 3 ? 1 : 0));
}
/** Monthly office upkeep (base + upgrade upkeep). */
export function officeUpkeep(S) {
  const u = S.agency.upgrades;
  let v = BAL.start.upkeep;
  for (const k in u) v += BAL.econ.upkeepUpgrade[u[k]] || 0;
  return v;
}
/** Expected monthly commission income from current clients' wages. */
export function monthlyCommission(S) {
  let v = 0;
  for (const p of myClients(S)) v += p.wage * (p.rep ? p.rep.commissionPct : 0) / 100;
  return Math.round(v);
}
/** Is anything the player must answer blocking "Ayı Oynat"? */
export function mustAnswer(S) { return S.inbox.some(c => c.must); }
