// UI-facing read-only views (re-exported by selectors.js). Pure: never mutate S, never touch the RNG, never read negotiation.hidden.
import { BAL, MONTHS, TRAITS, DREAMS, PERSONAS, RIVAL_PERSONAS, LEAGUE_DEFS } from './constants.js';
import { hash01 } from './util.js';
import { potentialBand, myClients, clubOf, leagueOf, tableSorted, minutesShare, avgRating, avgRecent, contractYearsLeft, monthlyCommission,
  officeUpkeep, isRecruitable, interestList, upgradeEffects, deadlineCalls, mustAnswer } from './selectors.js';
import { squadOf, clubStrength, projectMinutes } from './selection.js';
import { fairWage } from './valuation.js';
import { recruitPreview } from './clients.js';
import { heatPerMonth } from './rivals.js';
import { lunchCost, mediaCost } from './market.js';
import { preview as upgradePreview } from './upgrades.js';
import { tripPreview } from './scouting.js';
import { FOCUSES } from './scouting.js';
import * as promises from './promises.js';
import * as objectives from './objectives.js';
import * as tutorial from './tutorial.js';

const sameMonth = lv => lv && lv.season !== undefined;
const moneyLevelLabel = v => (v >= 75 ? 'Çok yüksek' : v >= 55 ? 'Yüksek' : v >= 35 ? 'Orta' : v >= 18 ? 'Düşük' : 'Çok düşük');
/** Turkish word for a 0..100 loyalty / morale value. */
export function levelWord(v) { return moneyLevelLabel(v); }

/** Rank (1..5) of your agency. */
export function myRank(S) { const i = S.ranking.findIndex(r => r.id === 'you'); return i < 0 ? 5 : i + 1; }

/** Why "Ayı Oynat" is blocked right now (Turkish) or null. */
export function advanceBlock(S) {
  if (S.time.phase === 'over') return 'Kariyer sona erdi';
  if (S.time.phase === 'deadline') return 'Son Gün sürüyor';
  if (S.negotiation) return 'Açık bir masa var';
  if (mustAnswer(S)) return 'Önce zorunlu kartı yanıtla';
  return null;
}

/**
 * Everything the Gündem (hub) header needs in one call.
 * @returns {{season:number, seasons:number, month:number, monthName:string, window:boolean, deadlineMonth:boolean, phase:string, energy:number, energyMax:number,
 *   cash:number, rep:number, rank:number, rankScore:number, clients:number, inbox:number, must:number, openInterests:number,
 *   monthlyCommission:number, upkeep:number, loan:object|null, negMonths:number, loanOffered:boolean, objective:object|null, objectivesOffered:object[],
 *   tutorialStep:string|null, advanceBlock:string|null, alerts:Array<{kind:string,text:string,playerId?:string}>}}
 */
export function hubSummary(S) {
  const A = S.agency, t = S.time;
  const mine = myClients(S);
  const alerts = [];
  if (A.cash < 0) alerts.push({ kind: 'danger', text: `Kasa eksiye düştü (${A.negMonths}/${BAL.econ.negMonthsBankrupt}. ay). ${BAL.econ.negMonthsBankrupt} ay üst üste eksi = iflas.` });
  if (S.flags.loanOfferPending && !A.loan) alerts.push({ kind: 'loan', text: 'Banka kredi teklif ediyor.' });
  for (const p of mine) {
    if (p.loyalty < 35) alerts.push({ kind: 'loyalty', playerId: p.id, text: `${p.name} küsmeye başladı (bağlılık ${Math.round(p.loyalty)}).` });
    if (p.injured > 0) alerts.push({ kind: 'injury', playerId: p.id, text: `${p.name} sakat (${p.injured} ay).` });
    if (p.contractEnd === t.season && t.month >= 6 && !p.preContract) alerts.push({ kind: 'contract', playerId: p.id, text: `${p.name}: sözleşmesi bu sezon bitiyor.` });
    if (p.rep && p.rep.endSeason <= t.season && t.month >= 8) alerts.push({ kind: 'repContract', playerId: p.id, text: `${p.name}: temsil sözleşmen bu sezon bitiyor.` });
  }
  const open = interestList(S).filter(i => i.negotiable).length;
  return {
    season: t.season, seasons: S.meta.careerSeasons, month: t.month, monthName: MONTHS[t.month].name, window: MONTHS[t.month].window, deadlineMonth: MONTHS[t.month].deadline,
    phase: t.phase, energy: A.energy, energyMax: A.energyMax, cash: A.cash, rep: Math.round(A.rep * 10) / 10, rank: myRank(S),
    rankScore: (S.ranking.find(r => r.id === 'you') || { score: 0 }).score, clients: mine.length, inbox: S.inbox.length, must: S.inbox.filter(c => c.must).length,
    openInterests: open, monthlyCommission: monthlyCommission(S), upkeep: officeUpkeep(S), loan: A.loan ? { ...A.loan } : null, negMonths: A.negMonths, loanOffered: !!A.loanOffered,
    objective: objectives.status(S), objectivesOffered: S.objectives.offered.map(o => ({ ...o })), tutorialStep: S.flags.tutorial && typeof S.flags.tutorial === 'object' && !S.flags.tutorial.done ? tutorial.currentStep(S) : null,
    advanceBlock: advanceBlock(S), alerts,
  };
}

/** Level as YOU perceive it (current CA plus a share of the visible band's centre) — never uses the hidden pa. */
function perceivedLevel(S, p) {
  const b = potentialBand(S, p);
  const gap = Math.max(0, (b.lo + b.hi) / 2 - p.ca);
  return Math.round(p.ca + gap * (p.age <= 21 ? 0.5 : p.age <= 24 ? 0.3 : 0));
}

function bandOf(S, p) {
  const b = potentialBand(S, p);
  return { lo: b.lo, hi: b.hi, width: b.hi - b.lo };
}

/** One row of the squad / club listing. */
function playerRow(S, p) {
  return { id: p.id, name: p.name, age: p.age, pos: p.pos, ca: p.ca, form: p.form, injured: p.injured, mine: p.agentId === 'you' };
}

/**
 * Full dossier of one of your clients (or null if he is not yours).
 * @returns {object|null} `{id,name,age,nat,pos,ca,form,trait,traitLabel,dream:{type,label,text,target,done},wage,fairWage,wageRatio,value,hype,morale,loyalty,moraleWord,loyaltyWord,
 *   club,league,minutesShare,expectedShare,avgRating,avgRecent,stats,career,band,contractEnd,contractYearsLeft,preContract,rep:{commissionPct,endSeason},
 *   promises:[{...promise,progress:{value,target,text}}],interests:[...],lastVisit,visitedThisMonth,injured,heat,know,flags:{expiring,freeAgent},valueTrend}`
 */
export function clientView(S, id) {
  const p = S.players[id];
  if (!p || p.agentId !== 'you') return null;
  const club = clubOf(S, p), L = leagueOf(S, club);
  const fair = fairWage(S, p, club ? club.leagueId : 'tr2');
  const lv = p.lastVisit;
  const dreamText = (DREAMS[p.dream.type] || { text: '' }).text.replace('{target}', Math.round(p.dream.target).toLocaleString('tr-TR'));
  return {
    id: p.id, name: p.name, age: p.age, nat: p.nat, pos: p.pos, ca: p.ca, form: p.form, trait: p.trait, traitLabel: TRAITS[p.trait].label,
    dream: { type: p.dream.type, label: DREAMS[p.dream.type].label, text: dreamText, target: p.dream.target, done: p.dream.done, known: true },
    wage: p.wage, fairWage: fair, wageRatio: fair ? Math.round(p.wage / fair * 100) / 100 : 0, value: p.value, hype: p.hype,
    morale: Math.round(p.morale), loyalty: Math.round(p.loyalty), moraleWord: levelWord(p.morale), loyaltyWord: levelWord(p.loyalty),
    club: club ? { id: club.id, name: club.name, short: club.short, colors: club.colors, crest: club.crest } : null,
    league: L ? { id: L.id, name: L.name, prestige: L.prestige } : null,
    minutesShare: Math.round(minutesShare(S, p) * 100) / 100, expectedShare: club ? Math.round(projectMinutes(S, p, club.id) * 100) / 100 : 0,
    avgRating: avgRating(p), avgRecent: avgRecent(p), stats: { apps: p.st.apps, mins: p.st.mins, goals: p.st.goals, assists: p.st.assists }, career: p.career.slice(),
    band: bandOf(S, p), contractEnd: p.contractEnd, contractYearsLeft: contractYearsLeft(S, p), preContract: p.preContract ? { ...p.preContract } : null,
    rep: p.rep ? { ...p.rep } : null, promises: promises.forPlayer(S, p.id).map(pr => ({ ...pr, progress: promises.progressOf(S, pr) })),
    interests: interestList(S, p.id), lastVisit: lv ? { ...lv } : null,
    visitedThisMonth: !!(sameMonth(lv) && lv.season === S.time.season && lv.month === S.time.month), injured: p.injured, know: p.know,
    flags: { expiring: p.contractEnd === S.time.season, freeAgent: !p.clubId, unhappy: p.loyalty < 35 },
  };
}

/** All your clients as short rows (for the Oyuncular list), most valuable first. */
export function clientList(S) {
  return myClients(S).map(p => {
    const club = clubOf(S, p);
    return { id: p.id, name: p.name, age: p.age, pos: p.pos, ca: p.ca, form: p.form, value: p.value, loyalty: Math.round(p.loyalty), morale: Math.round(p.morale), injured: p.injured,
      clubId: p.clubId, clubName: club ? club.name : 'Serbest', minutesShare: Math.round(minutesShare(S, p) * 100) / 100, openPromises: promises.forPlayer(S, p.id).length,
      interestCount: S.interests.filter(i => i.playerId === p.id && i.level >= BAL.neg.minLevel).length, trait: p.trait, hasPreContract: !!p.preContract };
  }).sort((a, b) => b.value - a.value);
}

/**
 * Discovered players you could still sign (Keşif tab): unrepresented, or rival-held in the last season of his contract (`rival:true`).
 * Hidden fields respect knowledge: trait only with know ≥ 60, dream with know ≥ 85.
 * @param {object} S
 * @param {{shortlistedOnly?:boolean, leagueId?:string}} [f]
 * @returns {Array<object>} sorted by prospect level desc
 */
export function prospectList(S, f = {}) {
  const out = [];
  for (const id in S.players) {
    const p = S.players[id];
    if (!p.seen || p.agentId === 'you' || !p.clubId) continue;
    if (f.shortlistedOnly && !p.shortlisted) continue;
    const club = S.clubs[p.clubId];
    if (f.leagueId && club.leagueId !== f.leagueId) continue;
    const recruitable = isRecruitable(S, p);
    const rv = p.agentId ? S.rivals.find(r => r.id === p.agentId) : null;
    const pv = recruitPreview(S, { playerId: p.id });
    out.push({
      id: p.id, name: p.name, age: p.age, nat: p.nat, pos: p.pos, ca: p.ca, form: p.form, hype: p.hype, value: p.value,
      clubId: club.id, clubName: club.name, leagueId: club.leagueId, leagueName: S.leagues[club.leagueId].name, contractEnd: p.contractEnd,
      know: p.know, band: bandOf(S, p), trait: p.know >= BAL.scout.traitKnow ? p.trait : null, traitLabel: p.know >= BAL.scout.traitKnow ? TRAITS[p.trait].label : null,
      dream: p.know >= BAL.scout.dreamKnow ? { type: p.dream.type, label: DREAMS[p.dream.type].label } : null,
      heat: Math.round(p.heat), heatPerMonth: p.agentId ? 0 : heatPerMonth(S, p), shortlisted: p.shortlisted, level: perceivedLevel(S, p),
      rival: rv ? { id: rv.id, agency: rv.agency } : null, recruitable, score: pv.score, threshold: pv.threshold, canSign: !!pv.canSign, gap: pv.gap,
    });
  }
  out.sort((a, b) => b.level - a.level || (a.id < b.id ? -1 : 1));
  return out;
}

/**
 * Club page. Needs, budget hint and director persona stay hidden until you have had lunch with him (`club.lunchKnown`, reset each July).
 * @returns {object|null}
 */
export function clubView(S, clubId) {
  const club = S.clubs[clubId];
  if (!club) return null;
  const L = S.leagues[club.leagueId];
  const known = !!club.lunchKnown;
  const f = hash01(club.id + ':bh' + S.time.season);
  const lo = Math.round(club.budget * (1 - BAL.market.lunch.band * f) / 10000) * 10000;
  const hi = Math.round((lo + club.budget * BAL.market.lunch.band) / 10000) * 10000;
  const rows = tableSorted(S, L.id);
  const squad = squadOf(S, clubId).sort((a, b) => b.ca - a.ca);
  const my = interestList(S).filter(i => i.clubId === clubId);
  return {
    id: club.id, name: club.name, short: club.short, colors: club.colors, crest: club.crest, leagueId: L.id, leagueName: L.name, prestige: L.prestige,
    strength: Math.round(clubStrength(S, clubId) * 10) / 10, facilities: club.facilities, youthTrust: club.youthTrust, trust: Math.round(club.trust),
    position: rows.findIndex(r => r.clubId === clubId) + 1, table: rows.find(r => r.clubId === clubId),
    director: { name: club.director.name, persona: known ? club.director.persona : null, personaLabel: known ? PERSONAS[club.director.persona].label : null, info: known ? club.director.info : null },
    lunchKnown: known, lunch: { cash: lunchCost(S, club), gain: upgradeEffects(S).lunchTrust },
    needs: known ? club.needs.map(n => ({ ...n })) : null, budgetHint: known ? { lo: Math.min(lo, club.budget), hi: Math.max(hi, club.budget) } : null,
    squad: squad.map(p => playerRow(S, p)), yourClients: squad.filter(p => p.agentId === 'you').map(p => p.id), interests: my,
    champions: L.champions.filter(c => c.clubId === clubId).length,
  };
}

/** All clubs of a league as short rows (Piyasa tab). */
export function clubList(S, leagueId) {
  return tableSorted(S, leagueId).map((r, i) => {
    const c = S.clubs[r.clubId];
    return { id: c.id, name: c.name, short: c.short, colors: c.colors, crest: c.crest, position: i + 1, pts: r.pts, trust: Math.round(c.trust), strength: Math.round(clubStrength(S, c.id) * 10) / 10, lunchKnown: !!c.lunchKnown };
  });
}

/**
 * Cash history for the Finans chart, oldest first. `cash` is the end-of-month balance (reconstructed from the current cash).
 * @returns {Array<{season:number, month:number, label:string, net:number, cash:number, items:Array<{k:string,label:string,amt:number}>}>}
 */
export function financeSeries(S) {
  let cash = S.agency.cash;
  const rows = [];
  for (const e of S.ledger) {
    rows.push({ season: e.season, month: e.month, label: MONTHS[e.month].short + ' ' + e.season, net: e.net, cash, items: e.items.map(i => ({ ...i })) });
    cash -= e.net;
  }
  return rows.reverse();
}

/**
 * The five-agency ladder.
 * @returns {Array<{rank:number,id:string,name:string,score:number,isYou:boolean,persona?:string,personaLabel?:string,rep:number,clients:number,color:string,owner:string}>}
 */
export function rankingView(S) {
  const count = {};
  for (const id in S.players) { const a = S.players[id].agentId; if (a) count[a] = (count[a] || 0) + 1; }
  return S.ranking.map((r, i) => {
    const rv = S.rivals.find(x => x.id === r.id);
    return rv
      ? { rank: i + 1, id: r.id, name: r.name, owner: rv.name, score: r.score, isYou: false, persona: rv.persona, personaLabel: RIVAL_PERSONAS[rv.persona].label, rep: Math.round(rv.rep), clients: count[rv.id] || 0, color: rv.color }
      : { rank: i + 1, id: 'you', name: r.name, owner: S.meta.agentName, score: r.score, isYou: true, rep: Math.round(S.agency.rep), clients: count.you || 0, color: '#3DDC84' };
  });
}

/** Office upgrades screen: three branches with next-level preview. */
export function upgradeView(S) {
  return ['scout', 'table', 'network'].map(b => upgradePreview(S, { branch: b }));
}

/** Objectives screen: offered (July), active with progress, history. */
export function objectiveView(S) {
  return { offered: S.objectives.offered.map(o => ({ ...o })), active: objectives.status(S), history: S.objectives.history.slice() };
}

/** Son Gün screen model (null when no deadline is running). */
export function deadlineView(S) {
  const d = S.deadline;
  if (!d) return null;
  return {
    hour: d.hour, hoursLeft: Math.max(0, BAL.deadline.hours[1] - d.hour), actionsLeft: d.actionsLeft, actionsMax: d.actionsMax, ended: d.ended, deals: d.deals,
    calls: deadlineCalls(S).map(c => ({ ...c, clubName: S.clubs[c.clubId].name, playerName: S.players[c.playerId] ? S.players[c.playerId].name : '?' })),
    log: d.log.slice(-12), hasTable: !!S.negotiation, interests: interestList(S).filter(i => i.negotiable),
  };
}

const NO = reason => ({ ok: false, reason });
const OK = { ok: true, reason: null };

function baseGate(S, cost) {
  if (S.time.phase === 'over') return NO('Kariyer sona erdi');
  if (S.negotiation) return NO('Önce açık masayı kapat');
  if (S.time.phase === 'deadline' && cost.energy) return NO('Son Gün sürüyor');
  if (cost.energy > S.agency.energy) return NO('Enerjin yok');
  if (cost.cash > S.agency.cash) return NO('Yeterli paran yok');
  return OK;
}
function entry(S, id, label, payload, cost, extra = {}) {
  const gate = extra.gate || baseGate(S, cost);
  return { id, label, payload, cost, ok: gate.ok, reason: gate.reason, ...(extra.rest || {}) };
}

/**
 * Which actions are possible right now for a target, with cost and a Turkish disabled-reason.
 * `{playerId}` → client or prospect actions; `{clubId}` → lunch (+ pitch when playerId is also given); `{}` → global actions
 * (scout trips per league, upgrades, loan).
 * @param {object} S
 * @param {{playerId?:string, clubId?:string}} [t]
 * @returns {Array<{id:string,label:string,payload:object,cost:{energy:number,cash:number},ok:boolean,reason:string|null}>}
 */
export function availableActions(S, t = {}) {
  const out = [];
  const p = t.playerId ? S.players[t.playerId] : null;
  const club = t.clubId ? S.clubs[t.clubId] : null;
  if (p && p.agentId === 'you') {
    const lv = p.lastVisit;
    const visited = lv && lv.season === S.time.season && lv.month === S.time.month;
    out.push(entry(S, 'visitClient', 'Ziyaret et', { playerId: p.id }, { energy: 1, cash: 0 }, visited ? { gate: NO('Bu ay zaten ziyaret ettin') } : {}));
    out.push(entry(S, 'mediaPush', 'Basın çalışması', { playerId: p.id }, { energy: 1, cash: mediaCost(S, p) }));
    if (club && p.clubId !== club.id) {
      const pc = S.time.phase === 'deadline' ? { energy: 0, cash: 0 } : { energy: 1, cash: 0 };
      let gate = null;
      if (p.preContract) gate = NO('Ön sözleşme zaten imzalı');
      const ex = S.interests.find(i => i.playerId === p.id && i.clubId === club.id);
      if (!gate && ex && ex.cooldown > 0) gate = NO('Direktör küs (' + ex.cooldown + ' ay)');
      out.push(entry(S, 'pitchPlayer', 'Kulübe öner', { playerId: p.id, clubId: club.id }, pc, gate ? { gate } : (S.time.phase === 'deadline' ? { gate: S.deadline && !S.deadline.ended && S.deadline.actionsLeft > 0 ? OK : NO('Bu saatin hakkı bitti') } : {})));
    }
    out.push({ id: 'releaseClient', label: 'Yolları ayır', payload: { playerId: p.id }, cost: { energy: 0, cash: 0 }, ok: S.time.phase !== 'over', reason: null });
  } else if (p) {
    const pv = recruitPreview(S, { playerId: p.id });
    out.push(entry(S, 'watchPlayer', 'Gözle', { playerId: p.id }, { energy: 1, cash: 0 }, p.know >= 100 ? { gate: NO('Zaten çok iyi tanıyorsun') } : {}));
    out.push(entry(S, 'recruit', 'İmza teklifi', { playerId: p.id, promises: [] }, { energy: 1, cash: 0 }, pv.error ? { gate: NO(pv.error) } : { rest: { score: pv.score, threshold: pv.threshold } }));
    out.push({ id: 'toggleShortlist', label: p.shortlisted ? 'Takipten çıkar' : 'Takibe al', payload: { playerId: p.id }, cost: { energy: 0, cash: 0 }, ok: true, reason: null });
  } else if (club) {
    out.push(entry(S, 'clubLunch', 'Direktörle yemek', { clubId: club.id }, { energy: 1, cash: lunchCost(S, club) }));
  } else {
    for (const ld of LEAGUE_DEFS) {
      const tp = tripPreview(S, { leagueId: ld.id, focus: 'any' });
      out.push(entry(S, 'scoutTrip', 'Gözlem gezisi: ' + ld.name, { leagueId: ld.id, focus: 'any', focuses: FOCUSES }, { energy: 1, cash: tp.cash }, tp.available <= 0 ? { gate: NO('Bu ligde yeni isim kalmadı') } : { rest: { count: tp.count } }));
    }
    for (const pv of upgradeView(S)) {
      out.push({ id: 'buyUpgrade', label: pv.name + (pv.maxed ? ' (en üst)' : ' Sv.' + pv.nextLevel), payload: { branch: pv.branch }, cost: { energy: 0, cash: pv.cost },
        ok: !pv.maxed && pv.canAfford && S.time.phase !== 'over', reason: pv.maxed ? 'En üst seviye' : pv.canAfford ? null : 'Yeterli paran yok' });
    }
    if (S.agency.loanOffered && !S.agency.loan) out.push({ id: 'takeLoan', label: 'Krediyi al', payload: {}, cost: { energy: 0, cash: 0 }, ok: true, reason: null });
  }
  return out;
}

