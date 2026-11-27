// World generation: leagues, clubs, squads, rivals' portfolios, the player's 3 starting clients.
import { BAL, LEAGUE_DEFS, POS, POS_ORDER } from './constants.js';
import { rint, pick, chance, gauss, uid, pickWeighted } from './rng.js';
import { clamp } from './util.js';
import { makeName, pickNat } from './data/names.js';
import { CLUB_DATA } from './data/clubs.js';
import { fairWage, refreshValues } from './valuation.js';
import { generateFixtures } from './fixtures.js';
import { squadIndex, projectMinutes, clubStrength } from './selection.js';
import { computeRanking, isElite } from './rivals.js';
import { refreshNeeds, strengthMap } from './market.js';

/** Hidden potential for a player of this age/ca. */
function genPa(S, ca, age) {
  const G = BAL.gen;
  const mean = age >= 28 ? 0 : (G.gapMean[age] ?? 0);
  let gap = mean > 0 ? Math.max(0, gauss(S, mean, mean * G.gapSdFactor + 1)) : 0;
  if (age <= 19 && chance(S, G.gemChance)) gap += rint(S, G.gemExtra[0], G.gemExtra[1]);
  return Math.min(G.paCap, ca + Math.round(gap));
}

/**
 * Create one player and register it in S.players.
 * @param {object} S
 * @param {{clubId:string, leagueId:string, age:number, pos:string, ca:number, pa?:number, nat?:string, contractEnd?:number, wageMult?:number}} o
 * @returns {object} player
 */
export function genPlayer(S, o) {
  const G = BAL.gen;
  const nat = o.nat || pickNat(S, o.leagueId);
  const ca = clamp(Math.round(o.ca), G.caMin, G.caMax);
  const age = o.age;
  const pa = Math.max(ca, Math.min(G.paCap, o.pa ?? genPa(S, ca, age)));
  const p = {
    id: uid(S, 'p'), name: makeName(S, nat), age, nat, pos: o.pos, ca, cf: ca, pa, form: 0,
    clubId: o.clubId, wage: 0, contractEnd: 0, value: 0,
    hype: Math.round(clamp((ca - BAL.dev.hypeBaseFrom) * BAL.dev.hypeBase, 0, BAL.dev.hypeBaseMax)),
    injured: 0,
    st: { apps: 0, mins: 0, goals: 0, assists: 0, ratingSum: 0, last: [], m: 0, sh: 0.15 },
    career: [], agentId: null, mood: rint(S, BAL.moodStart[0], BAL.moodStart[1]),
    know: 0, seen: false,
  };
  p.wage = Math.max(BAL.wage.min, Math.round(fairWage(S, p, o.leagueId) * clamp(gauss(S, 1, G.wageSpread), 0.7, 1.35) * (o.wageMult || 1) / 100) * 100);
  p.contractEnd = o.contractEnd ?? S.time.season + rint(S, 0, age <= 20 ? G.contractMax : G.contractMax - 1);
  S.players[p.id] = p;
  return p;
}

function caFor(S, A, age, starter) {
  const G = BAL.gen;
  if (starter) return A + gauss(S, 0, G.starterSd);
  const disc = G.ageDiscount[age] ?? 0;
  return A - G.benchDrop - disc * G.discountFactor + gauss(S, 0, G.benchSd);
}

/** Generate a club's initial squad around strength A. */
function genSquad(S, club, A) {
  const G = BAL.gen, SQ = BAL.squad;
  const counts = { ...SQ.base };
  const extra = rint(S, SQ.extraMin, SQ.extraMax);
  for (let i = 0; i < extra; i++) counts[pickWeighted(S, SQ.extraWeights)]++;
  for (const pos of POS_ORDER) {
    for (let i = 0; i < counts[pos]; i++) {
      const starter = i < POS[pos].slots;
      let age;
      if (starter) {
        age = chance(S, G.youngStarterChance) ? rint(S, 19, 21) : clamp(Math.round(gauss(S, G.starterAgeMean, G.starterAgeSd)), 22, 35);
      } else {
        age = chance(S, G.youthBenchShare) ? rint(S, 17, 21) : rint(S, 22, 33);
      }
      const ca = caFor(S, A, age, starter) - (starter && age < 22 ? 2 : 0);
      genPlayer(S, { clubId: club.id, leagueId: club.leagueId, age, pos, ca });
    }
  }
}

/** A youth (or free-agent adult when `adult`) for a club, strength-relative. */
export function genYouth(S, club, pos, A, adult = false) {
  const G = BAL.gen;
  const age = adult ? rint(S, 19, 24) : rint(S, G.youthAge[0], G.youthAge[1]);
  const ca = adult ? A - G.benchDrop + gauss(S, 0, G.benchSd) : A - G.youthDrop + gauss(S, 0, G.youthSd);
  const p = genPlayer(S, { clubId: club.id, leagueId: club.leagueId, age, pos, ca, contractEnd: S.time.season + rint(S, BAL.season.youthContract[0], BAL.season.youthContract[1]) });
  assignAgent(S, p);
  return p;
}

/** With probability BAL.rivalShare hand the player to a rival agency. */
export function assignAgent(S, p) {
  if (!chance(S, isElite(p) ? BAL.rivalEliteShare : BAL.rivalShare)) return;
  p.agentId = pick(S, S.rivals).id;
}

/** Recompute club budget & wage budget from current strength and wages. */
export function refreshClubFinance(S, club, squad) {
  const L = S.leagues[club.leagueId];
  const A = clubStrength(S, club.id, squad);
  const base = BAL.strengthByPrestige[L.prestige];
  const f = clamp(1 + (A - base) * 0.04, 0.5, 1.8);
  club.budget = Math.round(BAL.clubBudgetByPrestige[L.prestige] * f / 10000) * 10000;
  let w = 0; for (const p of squad) w += p.wage;
  club.wageBudget = Math.round(w * 1.05);
}

function makeClub(S, leagueDef, d, i) {
  const [name, short, c1, c2, crest] = d;
  const tier = BAL.tierPattern[i];
  const prestige = leagueDef.prestige;
  const club = {
    id: short.toLowerCase(), name, short, leagueId: leagueDef.id, colors: [c1, c2], crest,
    budget: 0, wageBudget: 0,
    facilities: clamp(Math.round(1 + (prestige - 1) * 0.5 + (tier - 3) * 0.4 + gauss(S, 0, 0.5)), 1, 5),
    youthTrust: rint(S, 1, 5),
    director: { name: makeName(S, leagueDef.nat) },
    trust: clamp(Math.round(gauss(S, BAL.clubTrustBase, BAL.clubTrustSd)), 0, 100),
    needs: [],
  };
  return { club, tier };
}

function createClients(S, tiers) {
  const season = S.time.season;
  const byTier = (leagueId, pred) => S.leagues[leagueId].clubIds.filter(id => pred(tiers[id]));
  const mk = (clubId, o) => {
    const c = S.clubs[clubId];
    const p = genPlayer(S, { clubId, leagueId: c.leagueId, nat: 'TR', ...o });
    p.agentId = 'you'; p.seen = true; p.know = 100; p.mood = BAL.start.clientMood; p.signed = { idx: 0 };
    return p;
  };
  // the gem: 17, hidden upside, weak tr2 club that trusts youth
  const gemClub = pick(S, byTier('tr2', t => t <= 2));
  const gc = S.clubs[gemClub]; gc.youthTrust = Math.max(gc.youthTrust, 4);
  const Ag = BAL.strengthByPrestige[1] + (tiers[gemClub] - 3) * BAL.tierSpread;
  const gem = mk(gemClub, { age: BAL.start.gemAge, pos: pick(S, ['OS', 'FV']), ca: Ag - 6 + rint(S, -1, 2), pa: rint(S, 82, 88), contractEnd: season + 2 });
  // two journeymen CA 55–60
  const j1c = pick(S, byTier('tr2', t => t >= 4));
  const j2c = pick(S, byTier('tr1', t => t <= 2));
  const j1 = mk(j1c, { age: rint(S, 26, 28), pos: pick(S, ['DF', 'OS']), ca: rint(S, 55, 58), contractEnd: season + 1 });
  const j2 = mk(j2c, { age: rint(S, 28, 30), pos: pick(S, ['FV', 'OS']), ca: rint(S, 57, 60), contractEnd: season + 2 });
  for (const p of [j1, j2]) p.pa = p.ca;
  for (const p of [gem, j1, j2]) {
    const lg = S.clubs[p.clubId].leagueId;
    p.wage = Math.round(fairWage(S, p, lg) * 0.95 / 100) * 100;
  }
}

/**
 * Populate S with leagues, clubs, players, rivals, clients, fixtures, ranking.
 * Expects S.meta, S.time, S.agency, S.rng to exist (game.newGame builds the skeleton).
 * @param {object} S
 */
export function createWorld(S) {
  S.rivals = BAL.rivals.map(r => ({ id: r.id, name: r.name, agency: r.agency, rep: r.rep, cash: r.cash, color: r.color, score: 0 }));
  const tiers = {};
  for (const ld of LEAGUE_DEFS) {
    const L = { id: ld.id, name: ld.name, country: ld.country, prestige: ld.prestige, clubIds: [], fixtures: [], matchday: 0, table: {}, champions: [] };
    S.leagues[ld.id] = L;
    CLUB_DATA[ld.id].forEach((d, i) => {
      const { club, tier } = makeClub(S, ld, d, i);
      S.clubs[club.id] = club; L.clubIds.push(club.id); tiers[club.id] = tier;
      const A = BAL.strengthByPrestige[ld.prestige] + (tier - 3) * BAL.tierSpread + gauss(S, 0, BAL.strengthNoise);
      genSquad(S, club, A);
    });
  }
  createClients(S, tiers);
  // representation: ~16% of the world starts with a rival agent
  for (const id of Object.keys(S.players)) { const p = S.players[id]; if (!p.agentId) assignAgent(S, p); }
  // minutes hierarchy, values, finance, fixtures, tables
  const idx = squadIndex(S);
  for (const cid in S.clubs) {
    const club = S.clubs[cid];
    for (const p of idx[cid]) p.st.sh = Math.round(projectMinutes(S, p, cid, {}, idx[cid]) * 100) / 100;
    refreshClubFinance(S, club, idx[cid]);
  }
  refreshValues(S);
  refreshNeeds(S, idx, strengthMap(S, idx));
  for (const lid in S.leagues) resetLeague(S, S.leagues[lid]);
  S.flags.leagueBase = leagueMeans(S); S.flags.drift = {};
  computeRanking(S);
}

/** Mean strength (average of the best XI) of the clubs of every league. */
export function leagueMeans(S) {
  const idx = squadIndex(S), out = {};
  for (const lid in S.leagues) {
    const ids = S.leagues[lid].clubIds;
    out[lid] = ids.reduce((a, c) => a + clubStrength(S, c, idx[c]), 0) / Math.max(1, ids.length);
  }
  return out;
}

/** New fixtures + empty table for a league (start of a season). */
export function resetLeague(S, L) {
  L.fixtures = generateFixtures(S, L.clubIds);
  L.matchday = 0;
  L.table = {};
  for (const id of L.clubIds) L.table[id] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
}
