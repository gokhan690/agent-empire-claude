// UI-facing read-only views (re-exported by selectors.js). Pure: never mutate S, never touch the RNG, never read negotiation.hidden.
import { BAL, MONTHS } from './constants.js';
import { myClients, clubOf, leagueOf, tableSorted, avgRecent, contractYearsLeft, monthlyCommission, officeUpkeep, interestOpenReason,
  potentialStars, starsOf, repNeeded, minutesShare } from './selectors.js';
import { squadOf, clubStrength, projectMinutes } from './selection.js';
import { fairPackage } from './negotiation.js';
import { pitchFit } from './market.js';
import { signBlock, moodWord } from './clients.js';
import { list as upgradeList } from './upgrades.js';
import * as goal from './goal.js';
import * as guide from './guide.js';

/** Rank (1..5) of your agency. */
export function myRank(S) { const i = S.ranking.findIndex(r => r.id === 'you'); return i < 0 ? 5 : i + 1; }

/** Why "Ayı Oynat" is blocked right now (Turkish) or null. */
export function advanceBlock(S) {
  if (S.time.phase === 'over') return 'Kariyer sona erdi';
  if (S.negotiation) return 'Açık bir masa var';
  return null;
}

/** Mood bucket for the single mood indicator: 'good' | 'mid' | 'bad'. */
export function moodTone(v) { return v >= 60 ? 'good' : v >= 35 ? 'mid' : 'bad'; }

/** Everything the Gündem (hub) needs in one call. */
export function hubSummary(S) {
  const A = S.agency, t = S.time;
  const card = S.inbox[0] || null;
  return {
    season: t.season, seasons: S.meta.careerSeasons, month: t.month, monthName: MONTHS[t.month].name, phase: t.phase,
    energy: A.energy, energyMax: A.energyMax, cash: A.cash, rep: Math.round(A.rep * 10) / 10, rank: myRank(S),
    rankScore: (S.ranking.find(r => r.id === 'you') || { score: 0 }).score, clients: myClients(S).length,
    offers: offerList(S).length, monthlyCommission: monthlyCommission(S), upkeep: officeUpkeep(S),
    loan: A.loan ? { ...A.loan } : null, negMonths: A.negMonths, loanOffered: !!A.loanOffered,
    goal: goal.status(S), guide: guide.current(S), card, advanceBlock: advanceBlock(S),
    alert: A.cash < 0 ? `${BAL.econ.negMonthsBankrupt} ay üst üste eksi kapatırsan iflas edersin (şimdi ${A.negMonths}/${BAL.econ.negMonthsBankrupt}).` : null,
    noClients: myClients(S).length === 0,
  };
}

function clubBrief(club) { return club ? { id: club.id, name: club.name, short: club.short, colors: club.colors, crest: club.crest } : null; }

/** All your clients as short rows (most valuable first): name, position, age, value, one mood indicator. */
export function clientList(S) {
  return myClients(S).map(p => {
    const club = clubOf(S, p);
    return { id: p.id, name: p.name, age: p.age, pos: p.pos, stars: starsOf(p.ca), value: p.value, mood: Math.round(p.mood), moodTone: moodTone(p.mood), moodWord: moodWord(p.mood),
      injured: p.injured, clubName: club ? club.name : '—', offers: S.interests.filter(i => i.playerId === p.id && !interestOpenReason(S, i)).length };
  }).sort((a, b) => b.value - a.value);
}

/** Dossier of one of your clients (null if he is not yours): everything fits one phone screen. */
export function clientView(S, id) {
  const p = S.players[id];
  if (!p || p.agentId !== 'you') return null;
  const club = clubOf(S, p), L = leagueOf(S, club);
  return {
    id: p.id, name: p.name, age: p.age, nat: p.nat, pos: p.pos, stars: starsOf(p.ca), potential: potentialStars(S, p),
    club: clubBrief(club), league: L ? { id: L.id, name: L.name, prestige: L.prestige } : null,
    value: p.value, wage: p.wage, contractEnd: p.contractEnd, contractYearsLeft: contractYearsLeft(S, p),
    mood: Math.round(p.mood), moodTone: moodTone(p.mood), moodWord: moodWord(p.mood), injured: p.injured, form: p.form,
    minutesShare: Math.round(minutesShare(S, p) * 100) / 100, avgRecent: avgRecent(p),
    offers: offerList(S, p.id),
  };
}

/** Candidates from "Oyuncu ara" that are still unsigned: position, age, club, current/potential stars, signable or why not. */
export function candidateList(S) {
  const out = [];
  for (const id of S.found) {
    const p = S.players[id];
    if (!p || p.agentId) continue;
    const club = clubOf(S, p);
    const block = signBlock(S, p);
    out.push({
      id: p.id, name: p.name, age: p.age, pos: p.pos, nat: p.nat, clubName: club ? club.name : '—', leagueName: club ? S.leagues[club.leagueId].name : '',
      stars: starsOf(p.ca), potential: potentialStars(S, p), watched: p.know >= 100, value: p.value, repNeeded: repNeeded(p), canSign: !block, block,
    });
  }
  return out;
}

/** Offers (negotiable interests) for your clients: `{id, playerId, playerName, clubId, clubName, leagueName, level, fee}` best first. */
export function offerList(S, playerId) {
  const out = [];
  for (const i of S.interests) {
    if (playerId && i.playerId !== playerId) continue;
    const p = S.players[i.playerId], club = S.clubs[i.clubId];
    if (!p || p.agentId !== 'you' || !club || interestOpenReason(S, i)) continue;
    const fair = fairPackage(S, p, club);
    const m = projectMinutes(S, p, club.id);
    out.push({ id: i.id, plays: m >= 0.5, playsWord: m >= 0.5 ? 'İlk 11' : m >= 0.2 ? 'Yedek' : 'Kadro dışı', playerId: p.id, playerName: p.name, pos: p.pos, clubId: club.id, clubName: club.name, colors: club.colors, crest: club.crest, leagueName: S.leagues[club.leagueId].name, level: i.level, fee: fair.fee, wage: fair.wage });
  }
  return out.sort((a, b) => b.level - a.level);
}

/** Clubs to pitch a client to, best fit first: `{clubId, name, leagueName, fit:'İlgilenir'|'Belki'|'Zor', needs:[pos]}` (max `limit`). */
export function pitchOptions(S, playerId, limit = 12) {
  const p = S.players[playerId];
  if (!p || p.agentId !== 'you') return [];
  const rank = { 'İlgilenir': 0, Belki: 1, Zor: 2 };
  const rows = [];
  for (const cid in S.clubs) {
    const club = S.clubs[cid];
    if (club.id === p.clubId) continue;
    const ex = S.interests.find(i => i.playerId === p.id && i.clubId === cid);
    const fit = pitchFit(S, p, club);
    rows.push({ clubId: cid, name: club.name, colors: club.colors, crest: club.crest, leagueName: S.leagues[club.leagueId].name, prestige: S.leagues[club.leagueId].prestige, fit, needs: club.needs.map(n => n.pos), cooldown: ex ? ex.cooldown : 0, offered: !!(ex && !interestOpenReason(S, ex)) });
  }
  rows.sort((a, b) => rank[a.fit] - rank[b.fit] || b.prestige - a.prestige || (a.name < b.name ? -1 : 1));
  return rows.filter(r => r.fit !== 'Zor').concat(rows.filter(r => r.fit === 'Zor')).slice(0, limit);
}

/** A league's clubs as short rows for the Piyasa tab: name, needs chips, strength stars. */
export function clubList(S, leagueId) {
  return tableSorted(S, leagueId).map((r, i) => {
    const c = S.clubs[r.clubId];
    return { id: c.id, name: c.name, short: c.short, colors: c.colors, crest: c.crest, position: i + 1, needs: c.needs.map(n => n.pos), stars: starsOf(clubStrength(S, c.id)) };
  });
}
/** Club sheet: needs plus your clients' pitch fit. */
export function clubView(S, clubId) {
  const club = S.clubs[clubId];
  if (!club) return null;
  const L = S.leagues[club.leagueId];
  const mine = myClients(S).filter(p => p.clubId !== clubId).map(p => ({ id: p.id, name: p.name, pos: p.pos, stars: starsOf(p.ca), fit: pitchFit(S, p, club) }));
  const squad = squadOf(S, clubId);
  return {
    id: club.id, name: club.name, short: club.short, colors: club.colors, crest: club.crest, leagueName: L.name, director: club.director.name,
    position: tableSorted(S, L.id).findIndex(r => r.clubId === clubId) + 1, needs: club.needs.map(n => ({ ...n })), squadSize: squad.length, clients: mine,
    yourClients: squad.filter(p => p.agentId === 'you').map(p => p.name),
  };
}

/** The five-agency ladder: `{rank,id,name,owner,score,isYou,rep,clients,color}`. */
export function rankingView(S) {
  const count = {};
  for (const id in S.players) { const a = S.players[id].agentId; if (a) count[a] = (count[a] || 0) + 1; }
  return S.ranking.map((r, i) => {
    const rv = S.rivals.find(x => x.id === r.id);
    return rv
      ? { rank: i + 1, id: r.id, name: r.name, owner: rv.name, score: r.score, isYou: false, rep: Math.round(rv.rep), clients: count[rv.id] || 0, color: rv.color }
      : { rank: i + 1, id: 'you', name: r.name, owner: S.meta.agentName, score: r.score, isYou: true, rep: Math.round(S.agency.rep), clients: count.you || 0, color: '#3DDC84' };
  });
}

/** The Ajans sheet: money, monthly flow, ladder, upgrades (one list). */
export function agencyView(S) {
  const income = monthlyCommission(S), upkeep = officeUpkeep(S);
  return {
    name: S.meta.agencyName, cash: S.agency.cash, rep: Math.round(S.agency.rep), income, upkeep, loan: S.agency.loan ? { ...S.agency.loan } : null,
    ranking: rankingView(S), upgrades: upgradeList(S), goal: goal.status(S), deals: S.agency.stats.deals, commission: S.agency.stats.commission,
  };
}
