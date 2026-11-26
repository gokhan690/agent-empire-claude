// Endings: legacy score, ranking tier, per-client epilogues. Texts live in data/ending.js, numbers in BAL.legacy / BAL.ending.
// S.ending = {kind:'efsane'|'buyuk'|'saygin'|'siradan'|'iflas'|'yalniz', rank, legacy, title, text, stats:[{label,value,raw?}],
//             epilogues:[{playerId, name, tone:'good'|'neutral'|'bitter', text}], careerOver:true}
//
// legacy = commission/commissionDiv + deals·deal + dreams·dream + kept·kept + broken·broken      (BAL.legacy)
//        + 25 per €1M of the five most valuable client peak values + champion·(titles won by clients' clubs)
//        + rank points (1st 600 … 5th 0) + rep·4 + seasons played·20, never below 0.
import { BAL } from './constants.js';
import { energyMaxFor } from './selectors.js';
import * as objectives from './objectives.js';
import { myClients, tableSorted } from './selectors.js';
import { eur, fmt, hpick } from './data/text.js';
import { ENDING_TITLES, ENDING_TEXTS, EPILOGUES, TAIL, DREAM_PHRASE, DREAM_DONE, DREAM_MISS } from './data/ending.js';

const ENDLESS_BLOCKED = new Set(['iflas', 'yalniz']);

/**
 * Keep a compact career record of every client (S.flags.cl): peaks, titles, status. Called monthly by events.monthly
 * (in June it still sees the final league tables) and once more by build().
 * @param {object} S
 */
export function track(S) {
  const cl = S.flags.cl || (S.flags.cl = {});
  const season = S.time.season;
  const mine = myClients(S);
  for (const p of mine) {
    let r = cl[p.id];
    if (!r) r = cl[p.id] = { id: p.id, name: p.name, since: season, startCa: p.ca, peakCa: p.ca, peakValue: p.value, titles: 0, scorer: 0, apps: 0, goals: 0, clubs: [], status: 'client' };
    r.status = 'client';
    r.peakCa = Math.max(r.peakCa, p.ca);
    r.peakValue = Math.max(r.peakValue, p.value);
    r.trait = p.trait; r.pos = p.pos; r.age = p.age; r.loyalty = p.loyalty;
    r.dream = { type: p.dream ? p.dream.type : null, done: !!(p.dream && p.dream.done) };
    if (r.clubs[r.clubs.length - 1] !== p.clubId) { r.clubs.push(p.clubId); if (r.clubs.length > 6) r.clubs.shift(); }
    if (S.time.month === 11 && r.seasonLogged !== season) {
      r.seasonLogged = season;
      r.apps += p.st.apps; r.goals += p.st.goals;
      const club = S.clubs[p.clubId];
      if (club && p.st.apps >= BAL.ending.minApps) {
        const rows = tableSorted(S, club.leagueId);
        if (rows[0].clubId === p.clubId) r.titles++;
      }
    }
  }
  for (const id in cl) {
    const r = cl[id];
    if (r.status !== 'client') continue;
    const p = S.players[id];
    if (!p || p.agentId !== 'you') {
      r.status = p ? 'left' : 'retired';
      if (p) { r.loyalty = p.loyalty; r.dream = { type: p.dream ? p.dream.type : null, done: !!(p.dream && p.dream.done) }; }
    }
  }
}

function rankOf(S) {
  const i = S.ranking.findIndex(r => r.id === 'you');
  return i < 0 ? 5 : i + 1;
}

/** Sum of the most valuable client peaks (€). */
function peakSum(S) {
  const cl = S.flags.cl || {};
  const vals = Object.values(cl).map(r => r.peakValue).sort((a, b) => b - a).slice(0, BAL.legacy.peakCount);
  return vals.reduce((a, b) => a + b, 0);
}
function titles(S) { return Object.values(S.flags.cl || {}).reduce((a, r) => a + r.titles, 0); }

/**
 * Legacy score (formula at the top of this file; weights in BAL.legacy).
 * @param {object} S
 * @returns {number}
 */
export function legacyScore(S) {
  const L = BAL.legacy, A = S.agency.stats;
  const v = A.commission / L.commissionDiv + A.deals * L.deal + A.dreams * L.dream + A.promisesKept * L.kept + A.promisesBroken * L.broken
    + peakSum(S) / L.peakValueDiv * L.peakValueW + titles(S) * L.champion + (L.rank[rankOf(S)] || 0) + S.agency.rep * L.rep + S.history.length * L.seasonSurvived;
  return Math.max(0, Math.round(v));
}

function tier(rank, legacy) {
  const E = BAL.ending;
  if (rank <= E.efsane.rank && legacy >= E.efsane.min) return 'efsane';
  if (rank <= E.buyuk.rank && legacy >= E.buyuk.min) return 'buyuk';
  if ((rank <= E.saygin.rank && legacy >= E.saygin.min) || legacy >= E.saygin.min * 1.8) return 'saygin';
  return 'siradan';
}

const cap = s => s ? s[0].toLocaleUpperCase('tr-TR') + s.slice(1) : s;

function epilogueFor(S, r, seedKey) {
  const p = S.players[r.id];
  let broken = 0;
  for (const q of S.promises) if (q.playerId === r.id && q.status === 'broken') broken++;
  const dreamDone = !!(r.dream && r.dream.done);
  let score = 0;
  if (dreamDone) score += 2;
  if (r.loyalty >= 60) score += 1; else if (r.loyalty < 35) score -= 2;
  if (r.status === 'left') score -= 2;
  if (r.peakCa - r.startCa >= 8) score += 1;
  if (r.titles > 0) score += 1;
  score -= broken;
  const tone = score >= 2 ? 'good' : score <= -1 ? 'bitter' : 'neutral';
  const club = S.clubs[(p && p.clubId) || r.clubs[r.clubs.length - 1]];
  let dream = '';
  if (r.dream && r.dream.type && DREAM_PHRASE[r.dream.type]) {
    dream = cap(fmt(dreamDone ? DREAM_DONE : DREAM_MISS, { phrase: DREAM_PHRASE[r.dream.type] }));
  }
  const R = { name: r.name, club: club ? club.name : 'son kulübü', peak: r.peakCa, dream };
  let text = fmt(hpick(EPILOGUES[tone], seedKey + r.id), R).replace(/\s+$/, '');
  if (r.status === 'retired' && tone !== 'bitter') text += TAIL.retired;
  return { playerId: r.id, name: r.name, tone, text };
}

function statsRows(S, rank, legacy) {
  const A = S.agency.stats;
  const cl = Object.values(S.flags.cl || {}).sort((a, b) => b.peakValue - a.peakValue);
  const best = cl[0];
  return [
    { label: 'Sıralama', value: rank + '. / 5', raw: rank },
    { label: 'Miras puanı', value: String(legacy), raw: legacy },
    { label: 'Toplam komisyon', value: eur(A.commission), raw: A.commission },
    { label: 'Tamamlanan transfer', value: String(A.deals), raw: A.deals },
    { label: 'Gerçekleşen hayal', value: String(A.dreams), raw: A.dreams },
    { label: 'Tutulan söz', value: String(A.promisesKept), raw: A.promisesKept },
    { label: 'Bozulan söz', value: String(A.promisesBroken), raw: A.promisesBroken },
    { label: 'En değerli müşteri', value: best ? best.name + ' (' + eur(best.peakValue) + ')' : '—' },
    { label: 'Müşterilerle şampiyonluk', value: String(titles(S)), raw: titles(S) },
    { label: 'İtibar', value: String(Math.round(S.agency.rep)), raw: S.agency.rep },
    { label: 'Oynanan sezon', value: String(S.history.length), raw: S.history.length },
  ];
}

/**
 * Build S.ending and set S.time.phase='over' (turn.js/economy call it).
 * @param {object} S
 * @param {'kariyer'|'efsane'|'buyuk'|'saygin'|'siradan'|'iflas'|'yalniz'|'musterisiz'} [kind='kariyer'] 'kariyer' picks the tier from rank + legacy;
 *   'musterisiz' is the old name of 'yalniz'
 * @returns {object} the ending
 */
export function build(S, kind = 'kariyer') {
  track(S);
  const rank = rankOf(S);
  const legacy = legacyScore(S);
  if (kind === 'musterisiz') kind = 'yalniz';
  if (kind === 'kariyer') kind = tier(rank, legacy);
  const A = S.agency.stats;
  const R = {
    agent: S.meta.agentName, agency: S.meta.agencyName, seasons: S.history.length || S.time.season, rank,
    commission: eur(A.commission), deals: A.deals, dreams: A.dreams,
  };
  const key = String(S.seed) + kind;
  const text = fmt(hpick(ENDING_TEXTS[kind], key), R);
  const cl = Object.values(S.flags.cl || {}).sort((a, b) => b.peakValue - a.peakValue).slice(0, BAL.ending.epilogueMax);
  S.ending = {
    kind, rank, legacy, title: ENDING_TITLES[kind], text, stats: statsRows(S, rank, legacy),
    epilogues: cl.map(r => epilogueFor(S, r, key)), careerOver: true,
  };
  S.time.phase = 'over';
  return S.ending;
}

/**
 * Endless mode: after a finished career flip phase back to 'plan' and extend careerSeasons.
 * Not possible after bankruptcy or with no clients left.
 * @param {object} S
 * @returns {{ok:boolean, error?:string, events?:object[]}}
 */
export function continueEndless(S) {
  if (!S.ending || ENDLESS_BLOCKED.has(S.ending.kind)) return { ok: false, error: 'Devam edilemez' };
  if (S.meta.endless) return { ok: false, error: 'Zaten devam ediyorsun' };
  S.meta.endless = true;
  S.meta.careerSeasons = 999;
  S.time.phase = 'plan';
  S.ending.continued = true;
  S.agency.energyMax = energyMaxFor(S);
  S.agency.energy = S.agency.energyMax;
  if (!S.objectives.active) objectives.offer(S);
  return { ok: true, events: [{ type: 'endless' }] };
}
