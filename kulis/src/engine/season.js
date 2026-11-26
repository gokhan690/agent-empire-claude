// End of season (June): awards, promotion/relegation, ageing, retirements, contract expiries/renewals,
// youth intake, squad balancing, finance refresh, new fixtures. Keeps the world alive for 8+ seasons.
import { BAL, POS_ORDER } from './constants.js';
import { rint, chance, gauss, pickBy, pickWeighted } from './rng.js';
import { clamp, r1 } from './util.js';
import { makeName } from './data/names.js';
import { fairWage, refreshValues } from './valuation.js';
import { squadIndex, clubStrength } from './selection.js';
import { tableSorted } from './selectors.js';
import { computeRanking } from './rivals.js';
import { genYouth, refreshClubFinance, resetLeague } from './world.js';
import { LEAGUE_DEFS } from './constants.js';
import * as news from './news.js';
import * as market from './market.js';

/** Remove a player from the world and every list that references him. */
export function purgePlayer(S, id) {
  delete S.players[id];
  S.interests = S.interests.filter(i => i.playerId !== id);
  S.promises = S.promises.filter(p => p.playerId !== id);
  S.inbox = S.inbox.filter(c => c.playerId !== id);
}

function retireChance(p) {
  const R = BAL.season.retire;
  const age = p.age - (p.pos === 'KL' ? R.gkBonus : 0);
  if (p.age >= R.force) return 1;
  if (age < R.startAge) return 0;
  return Math.min(0.95, R.base + (age - R.startAge) * R.step);
}

function newContract(S, p, leagueId) {
  const R = BAL.season;
  p.contractEnd = S.time.season + rint(S, R.renewYears[0], R.renewYears[1]);
  const fair = fairWage(S, p, leagueId);
  p.wage = Math.max(BAL.wage.min, Math.round(fair * clamp(gauss(S, 1, 0.08), 0.8, 1.2) / 100) * 100);
}

/**
 * Run all season-end processing. Called by turn.js in month 11 (after the month's other steps),
 * BEFORE season++. League tables are final at this point.
 * @param {object} S
 * @returns {{season:number, champions:Object<string,string>, promoted:string[], relegated:string[],
 *   retired:object[], released:number, renewed:number, awards:object[], clientEvents:object[]}}
 */
export function endSeason(S) {
  const season = S.time.season;
  const out = { season, champions: {}, promoted: [], relegated: [], retired: [], released: 0, renewed: 0, awards: [], clientEvents: [] };
  const clubLeague = {};
  for (const cid in S.clubs) clubLeague[cid] = S.clubs[cid].leagueId;

  // 1. champions, final tables, top scorers
  const finalTables = {};
  for (const lid in S.leagues) {
    const L = S.leagues[lid];
    const rows = tableSorted(S, lid);
    finalTables[lid] = rows;
    out.champions[lid] = rows[0].clubId;
    L.champions.push({ season, clubId: rows[0].clubId });
    if (L.champions.length > BAL.limits.careerMax) L.champions.shift();
    news.push(S, { kind: 'champion', clubId: rows[0].clubId, ctx: { club: S.clubs[rows[0].clubId].name, league: L.name } });
    out.awards.push({ kind: 'champion', leagueId: lid, clubId: rows[0].clubId });
  }
  const best = {};
  for (const id in S.players) {
    const p = S.players[id];
    const lid = clubLeague[p.clubId];
    if (p.st.goals > 0 && (!best[lid] || p.st.goals > best[lid].st.goals)) best[lid] = p;
  }
  for (const lid in best) {
    const p = best[lid];
    out.awards.push({ kind: 'topscorer', leagueId: lid, playerId: p.id, goals: p.st.goals });
    news.push(S, { kind: 'topscorer', playerId: p.id, ctx: { name: p.name, league: S.leagues[lid].name, goals: p.st.goals } });
  }

  // 2. career rows for tracked players (clients and players you have seen), then history row
  for (const id in S.players) {
    const p = S.players[id];
    if ((p.agentId === 'you' || p.seen) && p.st.apps > 0) {
      p.career.push({ season, clubId: p.clubId, apps: p.st.apps, goals: p.st.goals, avg: Math.round(p.st.ratingSum / p.st.apps * 10) / 10 });
      if (p.career.length > BAL.limits.careerMax) p.career.shift();
    }
  }
  computeRanking(S);
  let clients = 0;
  for (const id in S.players) if (S.players[id].agentId === 'you') clients++;
  S.history.push({ season, rank: S.ranking.findIndex(r => r.id === 'you') + 1, cash: S.agency.cash, rep: S.agency.rep, clients, champions: { ...out.champions }, awards: out.awards.slice() });

  // 3. ageing and retirement
  for (const id of Object.keys(S.players)) {
    const p = S.players[id];
    p.age++;
    if (chance(S, retireChance(p))) {
      out.retired.push({ id: p.id, name: p.name, age: p.age, client: p.agentId === 'you', clubId: p.clubId });
      if (p.agentId === 'you') out.clientEvents.push({ type: 'retire', playerId: p.id, name: p.name });
      if (p.ca >= 65 || p.agentId === 'you') news.push(S, { kind: 'retire', playerId: p.id, ctx: { name: p.name } });
      purgePlayer(S, id);
    }
  }

  // 4. contracts (clients first offer the market module a chance)
  let idx = squadIndex(S);
  const size = {};
  for (const cid in idx) size[cid] = idx[cid].length;
  const R = BAL.season;
  for (const id in S.players) {
    const p = S.players[id];
    if (p.contractEnd > season) continue;
    const lid = clubLeague[p.clubId];
    if (p.agentId === 'you') {
      if (market.handleExpiry(S, p)) continue;
      newContract(S, p, lid); out.renewed++;
      out.clientEvents.push({ type: 'renewed', playerId: p.id, clubId: p.clubId });
    } else if (chance(S, R.renewChance)) {
      newContract(S, p, lid); out.renewed++;
    } else {
      const L = S.leagues[lid];
      const dests = L.clubIds.filter(c => c !== p.clubId);
      let dest = dests[0];
      for (const c of dests) if (size[c] < size[dest]) dest = c;
      size[p.clubId]--; size[dest]++;
      p.clubId = dest; p.guarantee = false; p.loyalty = rint(S, 35, 70);
      newContract(S, p, lid); out.released++;
    }
  }
  // rival representation contracts churn
  for (const id in S.players) {
    const p = S.players[id];
    if (p.agentId && p.agentId !== 'you' && p.rep && p.rep.endSeason <= season) {
      if (chance(S, 0.75)) p.rep.endSeason = season + rint(S, 1, 3);
      else { p.agentId = null; p.rep = null; }
    }
  }

  // 5. promotion / relegation tr1 <-> tr2
  const n = BAL.season.promotion;
  const down = finalTables.tr1.slice(-n).map(r => r.clubId);
  const up = finalTables.tr2.slice(0, n).map(r => r.clubId);
  const T1 = S.leagues.tr1, T2 = S.leagues.tr2;
  T1.clubIds = T1.clubIds.filter(c => !down.includes(c)).concat(up);
  T2.clubIds = T2.clubIds.filter(c => !up.includes(c)).concat(down);
  for (const c of up) S.clubs[c].leagueId = 'tr1';
  for (const c of down) S.clubs[c].leagueId = 'tr2';
  out.promoted = up; out.relegated = down;
  for (const c of up) news.push(S, { kind: 'promoted', clubId: c, ctx: { club: S.clubs[c].name, league: T1.name } });
  for (const c of down) news.push(S, { kind: 'relegated', clubId: c, ctx: { club: S.clubs[c].name, league: T2.name } });

  // 6. squads: fill minimums with youth, trim above 22, refresh finance, directors
  idx = squadIndex(S);
  const SQ = BAL.squad;
  for (const cid in S.clubs) {
    const club = S.clubs[cid];
    const L = S.leagues[club.leagueId];
    const sq = idx[cid];
    const cnt = { KL: 0, DF: 0, OS: 0, FV: 0 };
    for (const p of sq) cnt[p.pos]++;
    const A = 0.6 * clubStrength(S, cid, sq) + 0.4 * BAL.strengthByPrestige[L.prestige];
    let culled = 0;
    for (const p of sq.slice()) {
      if (culled >= 2) break;
      if (p.age >= 23 && p.agentId !== 'you' && cnt[p.pos] > SQ.minByPos[p.pos] && p.ca < A - BAL.season.cullGap && chance(S, BAL.season.cullChance)) {
        cnt[p.pos]--; sq.splice(sq.indexOf(p), 1); purgePlayer(S, p.id); culled++; out.released++;
      }
    }
    for (const pos of POS_ORDER) while (cnt[pos] < SQ.minByPos[pos]) { sq.push(genYouth(S, club, pos, A, cnt[pos] === 0)); cnt[pos]++; }
    // youth intake: at least 1, fill to targetMin
    let intake = rint(S, 1, 2);
    while (sq.length < SQ.targetMin || intake > 0) {
      if (sq.length >= SQ.targetMax) break;
      const pos = pickWeighted(S, { DF: 2, OS: 2, FV: 1.3, KL: cnt.KL < 3 ? 0.3 : 0 });
      sq.push(genYouth(S, club, pos, A)); cnt[pos]++; intake--;
    }
    while (sq.length > SQ.max) {
      const cands = sq.filter(p => p.agentId !== 'you' && cnt[p.pos] > SQ.minByPos[p.pos]);
      if (!cands.length) break;
      cands.sort((a, b) => a.value - b.value || a.ca - b.ca);
      const v = cands[0];
      cnt[v.pos]--; sq.splice(sq.indexOf(v), 1); purgePlayer(S, v.id);
    }
    if (chance(S, BAL.directorChangeChance)) {
      club.director = { name: makeName(S, LEAGUE_DEFS.find(d => d.id === L.id).nat), persona: pickWeighted(S, BAL.persona.weights), info: club.director.info };
    }
    club.facilities = clamp(club.facilities + (chance(S, 0.08) ? 1 : chance(S, 0.05) ? -1 : 0), 1, 5);
    if (chance(S, 0.12)) club.youthTrust = clamp(club.youthTrust + (chance(S, 0.5) ? 1 : -1), 1, 5);
  }

  // 7. reset season state
  for (const id in S.players) {
    const p = S.players[id];
    const sh = p.st.sh;
    p.st = { apps: 0, mins: 0, goals: 0, assists: 0, ratingSum: 0, last: [], m: 0, sh };
    p.form = r1(p.form * R.formReset);
    if (p.injured > 2) p.injured -= 2; else p.injured = 0;
  }
  for (const lid in S.leagues) resetLeague(S, S.leagues[lid]);
  refreshValues(S);
  idx = squadIndex(S);
  for (const cid in S.clubs) refreshClubFinance(S, S.clubs[cid], idx[cid]);
  S.interests = S.interests.filter(i => S.players[i.playerId] && S.clubs[i.clubId]);
  return out;
}
