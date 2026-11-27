// The Masa — negotiation. State: S.negotiation (null when closed). Two sliders: the player's monthly wage and your commission (fee).
// Years and signing bonus are filled by the engine from the club's fair package. The director's ceiling lives under
// `S.negotiation.hidden` — the UI reads the table through selectors.negotiationView(S) only.
// Rules: the club accepts when cost ≤ K (hidden ceiling). Otherwise patience −1 and a counter-package; patience is 3 → at most 3 rounds.
// The player refuses any wage below `minWage`. Every table can be closed at its minimum (K ≥ minimum package).
import { BAL } from './constants.js';
import { gauss } from './rng.js';
import { clamp, tidy } from './util.js';
import { fairWage } from './valuation.js';
import { spendEnergy } from './economy.js';
import { interestOpenReason, negotiationView } from './selectors.js';
import * as market from './market.js';
import { tellLine, directorLine } from './data/tells.js';

/** @typedef {{ok:true,events:object[],[k:string]:any}|{ok:false,error:string}} Result */

const fail = error => ({ ok: false, error });
const r100 = v => Math.round(v / 100) * 100;
const floorTidy = v => (v >= 20000 ? Math.floor(v / 1000) * 1000 : Math.floor(v / 100) * 100);
const ceil100 = v => Math.ceil(v / 100) * 100;

export const packageCost = market.packageCost;

// ------------------------------------------------------------------------------------------ fair package & ceiling

/** The "fair" package the club considers normal: the suggested start of both sliders. */
export function fairPackage(S, p, club) {
  const N = BAL.neg;
  const W0 = fairWage(S, p, club.leagueId);
  const years = p.age >= N.years.oldAge ? N.years.old : p.age <= N.years.youngAge ? N.years.young : N.years.default;
  const wage = Math.max(BAL.wage.min, r100(W0));
  const bonus = tidy(W0 * N.bonusMonths);
  const tot = wage * 12 * years + bonus;
  const fee = Math.min(p.value * N.fee.valueShare / (1 + p.value / N.fee.valueDamp), tot * N.fee.wageShare);
  return { wage, years, bonus, fee: tidy(fee) };
}

/** The wage the player asks for at this club, and the minimum he will sign for. */
export function demandWage(S, p, club) {
  const W0 = fairWage(S, p, club.leagueId);
  return Math.max(r100(W0 * BAL.neg.demandMult), r100(p.wage * 0.95));
}
export function minWageOf(S, p, club) { return Math.max(BAL.wage.min, ceil100(demandWage(S, p, club) * BAL.neg.minWageShare)); }

/** Smallest fee a counter keeps for you: max(3% of the target cost, €1.500). */
function feeFloor(T) { const F = BAL.neg.feeFloor; return Math.ceil(Math.max(F.share * T, F.min) / 100) * 100; }

/** Hidden ceiling K of the club for a package cost. */
function ceilingOf(S, p, club, level, fair, transferFee, minCost) {
  const N = BAL.neg, G = N.gen;
  const nl = Math.max(1, market.needLevel(club, p.pos));
  const F = market.packageCost(fair);
  let g = G.base + G.need * nl + G.level * (Math.max(level, N.minLevel) - 60);
  const ratio = club.budget / Math.max(1, transferFee + F * 0.5);
  g += clamp((Math.log10(Math.max(ratio, 1e-3)) - 1) * G.budget, -G.budget, G.budget);
  g = clamp(g + gauss(S, 0, G.noise), G.min, G.max);
  let K = F * g;
  K = Math.max(K, minCost * 1.02); // every table can be closed at its minimum
  return K;
}

// ------------------------------------------------------------------------------------------ package handling

function limitsFor(fair, minWage) {
  const N = BAL.neg;
  return { wage: [minWage, Math.max(r100(fair.wage * N.maxWageMult), minWage + 1000)], fee: [0, Math.max(tidy(fair.fee * N.maxFeeMult), 5000)] };
}
const eur = v => Math.round(v).toLocaleString('tr-TR') + ' €';

/**
 * Normalise a package. Only `wage` and `fee` are required; years/bonus default to the club's suggestion.
 * @returns {{pkg?:object, error?:string}}
 */
export function validatePackage(n, raw) {
  if (!raw || typeof raw !== 'object') return { error: 'Teklif eksik' };
  const num = v => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : NaN);
  const wage = num(raw.wage), fee = num(raw.fee ?? n.fair.fee);
  const years = raw.years === undefined ? n.years : num(raw.years), bonus = raw.bonus === undefined ? n.bonus : num(raw.bonus);
  if (![wage, fee, years, bonus].every(Number.isFinite)) return { error: 'Teklifte geçersiz sayı var' };
  const L = n.limits;
  if (wage < L.wage[0]) return { error: 'Oyuncu bu maaşı kabul etmez (en az ' + eur(L.wage[0]) + ')' };
  if (wage > L.wage[1]) return { error: 'Maaş en fazla ' + eur(L.wage[1]) + ' olabilir' };
  if (fee < 0 || fee > L.fee[1]) return { error: 'Komisyon 0 ile ' + eur(L.fee[1]) + ' arasında olmalı' };
  if (years < 1 || years > 5 || bonus < 0) return { error: 'Geçersiz süre ya da prim' };
  return { pkg: { wage, years, bonus, fee } };
}

/** Tell level by gap = (C−K)/K: ≤5% → 0 … >35% → 4. */
export function tellLevel(gap) {
  const T = BAL.neg.tell;
  return gap <= T[0] ? 0 : gap <= T[1] ? 1 : gap <= T[2] ? 2 : gap <= T[3] ? 3 : 4;
}
/** "Kabul şansı" from the hidden gap, with margins so the exact ceiling is never revealed: Yüksek (sure), Orta (either way), Düşük (sure no). */
export function acceptHint(cost, K) {
  const gap = (cost - K) / K, H = BAL.neg.hint;
  return gap <= H.high ? 'Yüksek' : gap <= H.mid ? 'Orta' : 'Düşük';
}

function tellFor(level, n = 0) {
  const t = tellLine(level, n);
  return { level, line: t.line, face: t.face };
}

/** A counter-package costing ≈ T: cuts your fee first (60%), then the wage, never below the floors. */
function shapeCounter(n, pkg, T) {
  const cost = packageCost(pkg);
  const floorFee = pkg.fee <= 0 ? 0 : Math.min(pkg.fee, feeFloor(T));
  let R = cost - T;
  const out = { ...pkg };
  if (R <= 0) return out;
  const wageRoom = Math.max(0, (pkg.wage - n.minWage) * 12 * pkg.years);
  const feeRoom = Math.max(0, pkg.fee - floorFee);
  let cutFee = Math.min(feeRoom, R * BAL.neg.counter.feeW);
  let cutWage = Math.min(wageRoom, R - cutFee);
  cutFee = Math.min(feeRoom, R - cutWage);
  out.fee = Math.max(floorFee, floorTidy(pkg.fee - cutFee));
  out.wage = Math.max(n.minWage, Math.floor((pkg.wage * 12 * pkg.years - cutWage) / (12 * pkg.years) / 100) * 100);
  // tidy rounding may leave a little over T: trim the fee
  const over = packageCost(out) - T;
  if (over > 0) out.fee = Math.max(floorFee, out.fee - ceil100(over));
  return out;
}

// ------------------------------------------------------------------------------------------ open

/**
 * Open a table for an interest (1 energy).
 * @param {object} S
 * @param {{interestId:string}} a
 * @returns {Result}
 */
export function open(S, a) {
  if (S.negotiation) return fail('Zaten açık bir masa var');
  const it = S.interests.find(i => i.id === (a && a.interestId));
  if (!it) return fail('Teklif bulunamadı');
  const reason = interestOpenReason(S, it);
  if (reason) return fail(reason);
  if (S.agency.energy < 1) return fail('Enerjin yetmiyor');
  const p = S.players[it.playerId], club = S.clubs[it.clubId];
  const N = BAL.neg;
  const fair = fairPackage(S, p, club);
  const minWage = minWageOf(S, p, club);
  const tf = market.estimateTransferFee(S, p, club);
  const minPkg = { wage: minWage, years: fair.years, bonus: fair.bonus, fee: feeFloor(market.packageCost(fair)) };
  const level = it.level;
  let K = ceilingOf(S, p, club, level, fair, tf, packageCost(minPkg));
  const first = !S.flags.firstTableDone;
  if (first) K = Math.max(K, market.packageCost(fair) * N.firstTable.headroom, packageCost({ wage: minWage, years: fair.years, bonus: fair.bonus, fee: fair.fee }) * 1.05);
  spendEnergy(S, 1);
  S.negotiation = {
    id: 'n' + S.time.season + '_' + S.time.month + '_' + it.id,
    interestId: it.id, playerId: p.id, clubId: club.id, fromClubId: p.clubId || null,
    round: 0, patience: N.rounds, patienceMax: N.rounds,
    fair, years: fair.years, bonus: fair.bonus, minWage, limits: limitsFor(fair, minWage), transferFee: tf, demandWage: demandWage(S, p, club),
    package: null, counter: null, lastTell: null, log: [], first, openLine: directorLine('open', p.id.length + it.id.length + S.time.month),
    hidden: { K },
  };
  return { ok: true, events: [{ type: 'tableOpen', playerId: p.id, clubId: club.id, patience: N.rounds }], negotiation: negotiationView(S) };
}

// ------------------------------------------------------------------------------------------ preview

/**
 * Live preview while the sliders move (no state change, never reveals the ceiling).
 * @param {object} S
 * @param {{package:{wage:number,fee:number}}} a
 * @returns {{cost:number, hint:'Yüksek'|'Orta'|'Düşük'|null, happy:boolean, greedy:boolean, feeSharePct:number, transferFee:number, error?:string}}
 */
export function preview(S, a) {
  const n = S.negotiation;
  const blank = { cost: 0, hint: null, happy: false, greedy: false, feeSharePct: 0, transferFee: 0 };
  if (!n) return { ...blank, error: 'Açık masa yok' };
  const v = validatePackage(n, a && a.package);
  const raw = (a && a.package) || {};
  const pkg = v.pkg || { wage: Math.max(0, +raw.wage || 0), years: n.years, bonus: n.bonus, fee: Math.max(0, +raw.fee || 0) };
  const cost = packageCost(pkg);
  const share = market.feeShare(pkg);
  const res = {
    cost, hint: acceptHint(cost, n.hidden.K), happy: pkg.wage >= n.demandWage * BAL.neg.happyWage, greedy: share > BAL.neg.greedyShare + 1e-9,
    feeSharePct: Math.round(share * 1000) / 10, transferFee: n.transferFee,
  };
  if (v.error) res.error = v.error;
  return res;
}

// ------------------------------------------------------------------------------------------ closing

function close(S) { S.negotiation = null; }

function settle(S, n, pkg) {
  const deal = { playerId: n.playerId, toClubId: n.clubId, wage: pkg.wage, years: pkg.years, bonus: pkg.bonus, fee: pkg.fee, demand: n.demandWage, transferFee: n.transferFee };
  close(S);
  const r = market.executeTransfer(S, deal);
  if (r.ok) S.flags.firstTableDone = true;
  return r;
}

function leave(S, n) {
  const club = S.clubs[n.clubId];
  club.trust = clamp(club.trust + BAL.neg.leave.trust, 0, 100);
  const it = S.interests.find(i => i.id === n.interestId);
  if (it) it.cooldown = BAL.neg.leave.cooldown;
  const ev = { type: 'directorLeft', clubId: n.clubId, playerId: n.playerId, trust: club.trust, cooldown: BAL.neg.leave.cooldown };
  close(S);
  return ev;
}

// ------------------------------------------------------------------------------------------ propose

/**
 * Make an offer. The club accepts iff cost ≤ its hidden ceiling; otherwise patience −1 (3 rounds at most), a tell and a counter-package.
 * @param {object} S
 * @param {{package:{wage:number, fee:number, years?:number, bonus?:number}}} a
 * @returns {Result} `{ok:true, outcome:'accepted'|'countered'|'left', round, patience, tell?, counter?, line, events}`
 */
export function propose(S, a) {
  const n = S.negotiation;
  if (!n) return fail('Açık masa yok');
  const v = validatePackage(n, a && a.package);
  if (v.error) return fail(v.error);
  const pkg = v.pkg;
  const club = S.clubs[n.clubId];
  const H = n.hidden;
  const C = packageCost(pkg);
  const K = Math.round(H.K);
  n.package = pkg;
  if (C <= K) {
    n.log.push({ round: n.round + 1, cost: C, outcome: 'accepted' });
    const r = settle(S, n, pkg);
    if (!r.ok) return r;
    return { ...r, outcome: 'accepted', round: n.round + 1, line: directorLine('accept', n.round), events: r.events };
  }
  n.round++;
  n.patience--;
  const level = tellLevel((C - K) / K);
  const tell = tellFor(level, n.round);
  n.lastTell = tell;
  n.log.push({ round: n.round, cost: C, outcome: 'refused', tell: level });
  const events = [{ type: 'tell', level, face: tell.face, line: tell.line }];
  if (n.patience <= 0) {
    events.push(leave(S, n));
    return { ok: true, outcome: 'left', round: n.round, patience: 0, tell, line: directorLine('walkout', n.round), events };
  }
  const CN = BAL.neg.counter;
  const minPkg = { wage: n.minWage, years: pkg.years, bonus: pkg.bonus, fee: n.fair.fee ? feeFloor(K) : 0 };
  const target = clamp(K * (CN.base + CN.step * (n.round - 1) + gauss(S, 0, CN.noise)), Math.min(K, packageCost(minPkg)), K);
  const cp = shapeCounter(n, pkg, target);
  n.counter = { package: cp, cost: packageCost(cp) };
  return { ok: true, outcome: 'countered', round: n.round, patience: n.patience, patienceMax: n.patienceMax, tell, counter: n.counter, line: directorLine('counter', n.round), events };
}

/**
 * Accept the director's last counter-package.
 * @param {object} S
 * @returns {Result}
 */
export function acceptCounter(S) {
  const n = S.negotiation;
  if (!n) return fail('Açık masa yok');
  if (!n.counter) return fail('Karşı teklif yok');
  const pkg = n.counter.package;
  n.package = pkg;
  n.log.push({ round: n.round, cost: n.counter.cost, outcome: 'counterAccepted' });
  const r = settle(S, n, pkg);
  if (!r.ok) return r;
  return { ...r, outcome: 'accepted', round: n.round, line: directorLine('accept', n.round) };
}

/** Walk away (no penalty). Closes S.negotiation. */
export function walkAway(S) {
  const n = S.negotiation;
  if (!n) return fail('Açık masa yok');
  const ev = { type: 'walkAway', clubId: n.clubId, playerId: n.playerId };
  close(S);
  return { ok: true, events: [ev] };
}
