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

// ---- Phase 2a helpers (append-only; read-only, no RNG) ----
/** Office upgrade level (0..4) of a branch: 'scout' | 'table' | 'network'. Other modules read upgrades through this. */
export function upg(S, branch) { return S.agency.upgrades[branch] || 0; }
/** Resolved effect numbers of the current office upgrades (for scouting/negotiation/market/deadline modules). */
export function upgradeEffects(S) {
  const s = upg(S, 'scout'), t = upg(S, 'table'), n = upg(S, 'network');
  return {
    scoutCount: BAL.scout.count + (s >= 1 ? 1 : 0), scoutKnowBonus: s >= 2 ? 15 : 0, passiveDiscovery: s >= 3, heatMult: s >= 4 ? BAL.upgrade.heatSlow : 1,
    tablePatience: t >= 1 ? 1 : 0, kurnazTrue: t >= 2, blofRiskDelta: t >= 3 ? -0.10 : 0, kozMax: t >= 3 ? 5 : 4, ceilingBand: t >= 4 ? 0.15 : 0,
    energyBonus: (n >= 1 ? 1 : 0) + (n >= 3 ? 1 : 0), lunchTrust: n >= 2 ? BAL.upgrade.lunchTrust : 10, loyaltyDecayMult: n >= 2 ? BAL.upgrade.loyaltyDecayMult : 1, deadlineActionsPerHour: n >= 4 ? 2 : 1,
  };
}
/** Monthly office upkeep (alias of officeUpkeep; economy.js already charges it). */
export function monthlyUpkeep(S) { return officeUpkeep(S); }
/** Absolute month counter (season*12+month) for "months since" arithmetic. */
export function monthIndex(S) { return S.time.season * 12 + S.time.month; }
/** How good a prospect looks to the market/agents: CA plus half (≤21) / 30% (22-24) of the potential gap. */
export function prospectLevel(p) {
  const gap = Math.max(0, p.pa - p.ca);
  return p.ca + gap * (p.age <= 21 ? 0.5 : p.age <= 24 ? 0.3 : 0);
}
/** Can this player be recruited by you right now? (unrepresented, or rival-held in the last season of his rep contract) */
export function isRecruitable(S, p) {
  if (!p || p.agentId === 'you') return false;
  return !p.agentId || (p.rep && p.rep.endSeason <= S.time.season);
}

/**
 * Why an interest cannot be turned into a table right now (Turkish), or null when it can.
 * Pure read; used by negotiation.open and the Piyasa tab.
 */
export function interestOpenReason(S, i) {
  const p = S.players[i.playerId];
  if (!p || p.agentId !== 'you') return 'Müşterin değil';
  if (!S.clubs[i.clubId]) return 'Kulüp yok';
  if (i.cooldown > 0) return 'Direktör küs (' + i.cooldown + ' ay)';
  if (i.level < BAL.neg.minLevel) return 'İlgi yetersiz (en az ' + BAL.neg.minLevel + ')';
  if (p.preContract && i.kind !== 'renewal') return 'Ön sözleşme zaten imzalı';
  if (i.kind === 'transfer' && !MONTHS[S.time.month].window && S.time.phase !== 'deadline') return 'Transfer dönemi kapalı';
  if (i.kind === 'free' && p.clubId && (p.contractEnd !== S.time.season || S.time.month < BAL.market.interest.freeFrom)) return 'Ön sözleşme Ocak\'ta başlar';
  if (i.kind === 'renewal' && p.contractEnd !== S.time.season) return 'Sözleşme henüz bitmiyor';
  return null;
}
/** Interests in your clients, best first: `{...interest, negotiable, reason}`. */
export function interestList(S) {
  return S.interests
    .filter(i => S.players[i.playerId] && S.players[i.playerId].agentId === 'you')
    .map(i => { const reason = interestOpenReason(S, i); return { ...i, negotiable: !reason, reason }; })
    .sort((a, b) => b.level - a.level);
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

/** Months elapsed since the start of the career (season 1, month 0 = 0). Handy for cooldown bookkeeping. */
export function absMonth(S) { return (S.time.season - 1) * 12 + S.time.month; }

/** Son Gün calls with an `available` flag (visible now, not taken, not expired). Empty when no deadline is running. */
export function deadlineCalls(S) {
  const d = S.deadline;
  if (!d) return [];
  return d.calls.map(c => ({ ...c, available: !d.ended && !c.taken && c.fromHour <= d.hour && d.hour <= c.expiresHour }));
}
