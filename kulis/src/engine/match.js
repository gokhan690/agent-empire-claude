// Match simulation: Poisson-ish scores from XI strength + home advantage, scorers/assists,
// ratings, table, player stats, form, injuries.
import { BAL } from './constants.js';
import { rnd, rint, pick, chance, gauss, poisson, pickBy } from './rng.js';
import { clamp, r1, mean } from './util.js';
import { pickLineup, squadIndex } from './selection.js';

function avgPos(xi, pos) {
  const l = xi.filter(p => p.pos === pos);
  return l.length ? mean(l.map(p => p.ca + p.form * 0.4)) : mean(xi.map(p => p.ca)) - 8;
}
function attDef(xi) {
  const M = BAL.match;
  const a = {}; for (const k of ['FV', 'OS', 'DF', 'KL']) a[k] = avgPos(xi, k);
  let att = 0, def = 0;
  for (const k in M.attW) att += a[k] * M.attW[k];
  for (const k in M.defW) def += a[k] * M.defW[k];
  return { att, def };
}

/** Prepare one side: lineup, substitutions and minutes. */
function prepSide(S, club, squad) {
  const { xi, subs } = pickLineup(S, club, squad, true);
  const M = BAL.match;
  const mins = new Map();       // playerId → minutes
  const off = new Map();        // starter → minute subbed off
  const on = new Map();         // sub → minute subbed on
  for (const p of xi) mins.set(p.id, 90);
  const nSub = pick(S, M.subsUsed);
  const outfieldSubs = subs.filter(p => p.pos !== 'KL');
  for (let i = 0; i < nSub && i < outfieldSubs.length; i++) {
    const s = outfieldSubs[i];
    let cands = xi.filter(p => p.pos === s.pos && p.pos !== 'KL' && !off.has(p.id));
    if (!cands.length) cands = xi.filter(p => p.pos !== 'KL' && !off.has(p.id));
    if (!cands.length) break;
    cands.sort((a, b) => a.ca - b.ca);
    const out = cands[0];
    const m = rint(S, M.subMin[0], M.subMin[1]);
    off.set(out.id, m); on.set(s.id, m);
    mins.set(out.id, m); mins.set(s.id, 90 - m);
  }
  const played = xi.concat(outfieldSubs.filter(s => on.has(s.id)));
  return { club, xi, subs, mins, off, on, played, ...attDef(xi) };
}

function minuteFor(S, side, p) {
  let lo = 1, hi = 90;
  if (side.off.has(p.id)) hi = side.off.get(p.id);
  if (side.on.has(p.id)) lo = side.on.get(p.id);
  return rint(S, lo, Math.max(lo, hi));
}

function genGoals(S, side, n, gl) {
  const M = BAL.match;
  const out = [];
  for (let i = 0; i < n; i++) {
    const scorer = pickBy(S, side.played, p => M.scorerW[p.pos] * Math.pow(p.ca / M.scorerCaRef, M.scorerCaPow) * (side.mins.get(p.id) / 90));
    let assist = null;
    if (chance(S, M.assistChance)) {
      const cand = side.played.filter(p => p.id !== scorer.id);
      if (cand.length) assist = pickBy(S, cand, p => M.assistW[p.pos] * (p.ca / M.scorerCaRef));
    }
    out.push({ playerId: scorer.id, minute: minuteFor(S, side, scorer), clubId: side.club.id, assistId: assist ? assist.id : null });
  }
  out.sort((a, b) => a.minute - b.minute);
  for (const g of out) gl.push(g);
  return out;
}

function applyStats(S, side, goalsFor, goalsAgainst, goalList) {
  const M = BAL.match, R = M.rating;
  const teamAvg = mean(side.xi.map(p => p.ca));
  const gCount = {}, aCount = {};
  for (const g of goalList) {
    gCount[g.playerId] = (gCount[g.playerId] || 0) + 1;
    if (g.assistId) aCount[g.assistId] = (aCount[g.assistId] || 0) + 1;
  }
  const res = goalsFor > goalsAgainst ? R.win : goalsFor < goalsAgainst ? R.loss : 0;
  for (const p of side.played) {
    const mins = side.mins.get(p.id) || 0;
    const st = p.st;
    const g = gCount[p.id] || 0, a = aCount[p.id] || 0;
    st.mins += mins; st.m += mins; st.goals += g; st.assists += a;
    if (mins >= M.minRated) {
      let r = R.base + res + g * R.goal + a * R.assist + (p.ca - teamAvg) * R.caW + gauss(S, 0, R.sd);
      if (p.pos === 'KL' || p.pos === 'DF') r += goalsAgainst === 0 ? R.cleanSheet : Math.max(-0.75, goalsAgainst * R.concede);
      r = r1(clamp(r, R.min, R.max));
      st.apps++; st.ratingSum = r1(st.ratingSum + r);
      st.last.push(r); if (st.last.length > M.lastKeep) st.last.shift();
      p.form = r1(clamp(p.form * M.formKeep + (r - M.formRef) * M.formGain * (1 - M.formKeep), -M.formMax, M.formMax));
    }
    if (chance(S, M.injuryChance)) p.injured = pick(S, M.injuryMonths);
  }
}

function tableRow(L, id) { return L.table[id]; }
function book(L, h, a, hg, ag) {
  const T = BAL.match.points;
  const H = tableRow(L, h), A = tableRow(L, a);
  H.p++; A.p++; H.gf += hg; H.ga += ag; A.gf += ag; A.ga += hg;
  if (hg > ag) { H.w++; A.l++; H.pts += T.w; }
  else if (hg < ag) { A.w++; H.l++; A.pts += T.w; }
  else { H.d++; A.d++; H.pts += T.d; A.pts += T.d; }
}

/**
 * Play the next matchday of a league. Mutates tables, player stats, form, injuries.
 * @param {object} S
 * @param {string} leagueId
 * @param {Object<string,object[]>} [idx] squad index (pass one built per month for speed)
 * @returns {{leagueId:string, md:number, results:Array<{home:string,away:string,hg:number,ag:number,scorers:Array}>}|null}
 */
export function playMatchday(S, leagueId, idx) {
  const L = S.leagues[leagueId];
  const round = L.fixtures[L.matchday];
  if (!round) return null;
  const squads = idx || squadIndex(S);
  const M = BAL.match;
  const results = [];
  for (const [h, a] of round) {
    const H = prepSide(S, S.clubs[h], squads[h]);
    const A = prepSide(S, S.clubs[a], squads[a]);
    const hg = poisson(S, M.goalBase * M.homeMult * Math.exp(M.goalK * (H.att - A.def)));
    const ag = poisson(S, M.goalBase * M.awayMult * Math.exp(M.goalK * (A.att - H.def)));
    const gl = [];
    const hGoals = genGoals(S, H, hg, gl);
    const aGoals = genGoals(S, A, ag, gl);
    applyStats(S, H, hg, ag, hGoals);
    applyStats(S, A, ag, hg, aGoals);
    book(L, h, a, hg, ag);
    gl.sort((x, y) => x.minute - y.minute);
    results.push({ home: h, away: a, hg, ag, scorers: gl });
  }
  const md = L.matchday;
  L.matchday++;
  return { leagueId, md, results };
}
