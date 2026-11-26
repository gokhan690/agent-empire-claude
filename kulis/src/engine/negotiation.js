// Phase 2b — the Masa (negotiation mini-game). State: S.negotiation (null when closed), owned by this module.
// Everything the UI may show lives at the top level of S.negotiation; the director's ceiling and other secrets
// live under `S.negotiation.hidden` — the UI must read the table through selectors.negotiationView(S) only.
// Package: {wage (monthly €), years 1..5, bonus, fee (your commission, lump sum), clauses:{minutes,release}}.
import { BAL } from './constants.js';
import { rnd, chance } from './rng.js';
import { clamp, tidy } from './util.js';
import { fairWage } from './valuation.js';
import { projectMinutes, clubStrength } from './selection.js';
import { avgRecent, interestOpenReason, negotiationView } from './selectors.js';
import { spendEnergy } from './economy.js';
import * as market from './market.js';
import { useAction } from './deadline.js';
import { tellLine } from './data/tells.js';

/** @typedef {{ok:true,events:object[],[k:string]:any}|{ok:false,error:string}} Result */

const fail = error => ({ ok: false, error });
const r100 = v => Math.round(v / 100) * 100;
const floorTidy = v => (v >= 20000 ? Math.floor(v / 1000) * 1000 : Math.floor(v / 100) * 100);
const KIND_LABEL = { transfer: 'Transfer', free: 'Bedelsiz Transfer', renewal: 'Sözleşme Uzatma' };

export const packageCost = market.packageCost;
/** The player-visible table (no hidden ceiling). */
export const publicView = negotiationView;

// ------------------------------------------------------------------------------------------ fair package & ceiling

/** The "fair" package the club considers normal for this deal. Shown to the player as the suggested start. */
export function fairPackage(S, p, club, kind) {
  const N = BAL.neg;
  const W0 = fairWage(S, p, club.leagueId);
  const years = kind === 'renewal' ? N.years.renew : p.age >= N.years.oldAge ? N.years.old : p.age <= N.years.youngAge ? N.years.young : N.years.default;
  let wage = W0;
  if (kind === 'renewal') wage = Math.max(W0, p.wage * 1.05);
  if (kind === 'free') wage = W0 * 1.05;
  wage = Math.max(BAL.wage.min, r100(wage));
  const bonus = tidy(W0 * N.bonusMonths[kind]);
  const tot = wage * 12 * years + bonus;
  let fee;
  if (kind === 'transfer') fee = Math.min(p.value * N.fee.valueShare / (1 + p.value / N.fee.valueDamp), tot * N.fee.wageShare);
  else if (kind === 'free') fee = tot * N.fee.freeShare;
  else fee = tot * N.fee.renewShare;
  return { wage, years, bonus, fee: tidy(fee), clauses: { minutes: false, release: false } };
}

function ceilingParts(S, p, club, kind, level, fair, transferFee) {
  const N = BAL.neg, G = N.gen;
  const nl = kind === 'renewal' ? 2 : Math.max(1, market.needLevel(club, p.pos));
  const F = market.packageCost(fair);
  let g = G.base + G.need * nl + G.level * (Math.max(level, N.minLevel) - 60);
  const ratio = club.budget / Math.max(1, (kind === 'transfer' ? transferFee : 0) + F * 0.5);
  g += clamp((Math.log10(Math.max(ratio, 1e-3)) - 1) * G.budget, -G.budget, G.budget);
  g = clamp(g, G.min, G.max);
  const P = BAL.persona[club.director.persona] || BAL.persona.durust;
  let pf = 1 + (P.k || 0);
  if (club.director.persona === 'gosterisci') pf = 1 + (p.hype >= P.hypeMin ? P.hypeBonus : P.otherMalus);
  const saved = kind === 'free' ? p.value * N.saveFactor * N.freeSaved : 0;
  return { K: F * g * pf + saved, gen: g, persona: pf, saved, F, need: nl };
}

// ------------------------------------------------------------------------------------------ client satisfaction

/** The wage the client asks for at this club. */
export function demandWage(S, p, club, kind) {
  const W0 = fairWage(S, p, club.leagueId);
  const tm = p.trait === 'paraci' ? 1.15 : 1;
  if (kind === 'renewal') return Math.max(W0 * tm, p.wage);
  return Math.max(r100(W0 * tm), r100(p.wage * 0.95));
}

/**
 * Client satisfaction 0..100 for a package. `parts` are the labelled contributions (sum = value, before clamping).
 * @returns {{value:number, parts:{label:string,value:number}[], minutes:number, demand:number}}
 */
export function satisfaction(S, p, club, kind, pkg) {
  const Z = BAL.neg.sat;
  const parts = [{ label: 'Temel', value: Z.base }];
  const add = (label, v) => { v = Math.round(v); if (v !== 0) parts.push({ label, value: v }); };
  const demand = demandWage(S, p, club, kind);
  const paraci = p.trait === 'paraci';
  let w = clamp(Z.wageFair + (pkg.wage / demand - 1) * Z.wageSlope, Z.wageMin, Z.wageMax);
  if (paraci) w *= Z.paraci;
  add('Maaş', w);
  let b = clamp(pkg.bonus / (demand * 12) * Z.bonusSlope, 0, Z.bonusMax);
  if (paraci) b *= Z.paraciBonus;
  add('İmza primi', b);
  const m = projectMinutes(S, p, club.id, { guarantee: !!(pkg.clauses && pkg.clauses.minutes) });
  let mv = (m - 0.5) * Z.minutesW;
  if (mv < 0 && p.trait === 'hirsli') mv *= Z.hirsliMinutes;
  if (p.trait === 'profesyonel') mv *= Z.profMinutes;
  add('Forma şansı', mv);
  const cur = p.clubId ? S.clubs[p.clubId] : null;
  const curPrest = cur ? S.leagues[cur.leagueId].prestige : 1;
  const L = S.leagues[club.leagueId];
  const moved = kind !== 'renewal';
  if (moved) {
    let pv = (L.prestige - curPrest) * Z.prestigeW;
    if (p.trait === 'hirsli') pv *= pv > 0 ? Z.hirsliPrestige : 1;
    add('Lig seviyesi', pv);
    if (p.trait === 'sadik') add('Taşınmayı sevmiyor', Z.sadikMove);
  }
  if (p.trait === 'ailebabasi' && moved) add('Aile', L.country === 'Türkiye' && p.nat === 'TR' ? Z.family.home : Z.family.away);
  if (p.trait === 'yildiz' && p.hype >= 60 && L.prestige > curPrest) add('Şöhret', Z.yildiz);
  const dr = p.dream;
  if (dr && !dr.done) {
    let dv = 0;
    if (dr.type === 'top_league' && L.prestige === 5) dv = Z.dream.top_league;
    else if (dr.type === 'big_wage' && pkg.wage >= dr.target) dv = Z.dream.big_wage;
    else if (dr.type === 'champion') {
      const rank = L.clubIds.map(id => clubStrength(S, id)).sort((a, c) => c - a);
      if (clubStrength(S, club.id) >= rank[2]) dv = Z.dream.champion;
    } else if (dr.type === 'star' && m >= 0.5) dv = Z.dream.star;
    else if (dr.type === 'hometown' && L.country === 'Türkiye' && m >= 0.5) dv = Z.dream.hometown;
    add('Hayali', dv);
  }
  if (pkg.clauses && pkg.clauses.release) add('Serbest kalma maddesi', Z.release);
  const value = clamp(parts.reduce((s, x) => s + x.value, 0), 0, 100);
  return { value, parts, minutes: m, demand };
}

// ------------------------------------------------------------------------------------------ package validation

function limitsFor(fair, p) {
  const N = BAL.neg;
  return {
    wage: [BAL.wage.min, Math.max(r100(fair.wage * N.maxWageMult), BAL.wage.min * 2)],
    years: [1, 5],
    bonus: [0, tidy(fair.wage * N.maxBonusMonths)],
    fee: [0, Math.max(tidy(fair.fee * 10), 50000)],
  };
}
const eur = v => Math.round(v).toLocaleString('tr-TR') + ' €';

/** @returns {{pkg?:object, error?:string}} normalised package or a Turkish error */
export function validatePackage(n, raw) {
  if (!raw || typeof raw !== 'object') return { error: 'Teklif eksik' };
  const L = n.limits;
  const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
  const wage = Math.round(num(raw.wage)), years = Math.round(num(raw.years)), bonus = Math.round(num(raw.bonus ?? 0)), fee = Math.round(num(raw.fee ?? 0));
  if (![wage, years, bonus, fee].every(Number.isFinite)) return { error: 'Teklifte geçersiz sayı var' };
  if (wage < L.wage[0] || wage > L.wage[1]) return { error: 'Maaş ' + eur(L.wage[0]) + ' ile ' + eur(L.wage[1]) + ' arasında olmalı' };
  if (years < 1 || years > 5) return { error: 'Süre 1 ile 5 yıl arasında olmalı' };
  if (bonus < 0 || bonus > L.bonus[1]) return { error: 'İmza primi 0 ile ' + eur(L.bonus[1]) + ' arasında olmalı' };
  if (fee < 0 || fee > L.fee[1]) return { error: 'Komisyon 0 ile ' + eur(L.fee[1]) + ' arasında olmalı' };
  const c = raw.clauses || {};
  return { pkg: { wage, years, bonus, fee, clauses: { minutes: !!c.minutes, release: !!c.release } } };
}

// ------------------------------------------------------------------------------------------ tells & counters

/** Tell level by gap = (C−K)/K: ≤5% → 0 … >35% → 4. */
export function tellLevel(gap) {
  const T = BAL.neg.tell;
  return gap <= T[0] ? 0 : gap <= T[1] ? 1 : gap <= T[2] ? 2 : gap <= T[3] ? 3 : 4;
}
const FALLBACK = ['Neredeyse tamam.', 'Biraz fazla istiyorsun.', 'Bu rakamlar bizi zorlar.', 'Çok uzaksın.', 'Bu bir hakaret!'];
function tellFor(club, level) {
  let t = null;
  try { t = tellLine(club.director.persona, level); } catch (e) { t = null; }
  return { level, line: (t && t.line) || FALLBACK[level], face: (t && t.face) || ['calm', 'calm', 'frown', 'angry', 'furious'][level] };
}

function shapeCounter(n, pkg, T) {
  const W = BAL.neg.counterW[n.hidden.persona] || BAL.neg.counterW.durust;
  const c = pkg.clauses || {};
  const rate = 1 + (c.minutes ? BAL.neg.clause.minutes : 0) + (c.release ? BAL.neg.clause.release : 0);
  const comp = { wage: pkg.wage * 12 * pkg.years, bonus: pkg.bonus, fee: pkg.fee };
  const total = comp.wage + comp.bonus + comp.fee;
  const R = Math.max(0, total - T / rate);
  const cut = { wage: 0, bonus: 0, fee: 0 };
  const keys = ['wage', 'bonus', 'fee'];
  for (let pass = 0; pass < 4; pass++) {
    const rem = R - cut.wage - cut.bonus - cut.fee;
    const caps = keys.filter(k => comp[k] - cut[k] > 1);
    const ws = caps.reduce((s, k) => s + W[k], 0);
    if (rem < 1 || !caps.length || ws <= 0) break;
    for (const k of caps) cut[k] += Math.min(comp[k] - cut[k], rem * W[k] / ws);
  }
  const out = {
    wage: Math.max(BAL.wage.min, Math.floor((comp.wage - cut.wage) / (12 * pkg.years) / 100) * 100),
    years: pkg.years,
    bonus: Math.max(0, floorTidy(comp.bonus - cut.bonus)),
    fee: Math.max(0, floorTidy(comp.fee - cut.fee)),
    clauses: { minutes: !!c.minutes, release: !!c.release },
  };
  return out;
}

// ------------------------------------------------------------------------------------------ koz hand

function buildHand(S, p, club, kind, isDeadline, needLvl) {
  const Z = BAL.neg.koz, N = BAL.neg;
  const hand = [];
  const rival = S.interests.find(i => i.playerId === p.id && i.clubId !== club.id && i.level >= Z.rakipMin && S.clubs[i.clubId]);
  if (rival) hand.push({ id: 'rakip', label: 'Rakip Teklif', text: S.clubs[rival.clubId].name + ' de peşinde.', effect: 'Tavan +%' + Math.round(Z.rakip * 100), kPct: Z.rakip, patience: 0, risk: null, clubId: rival.clubId });
  if (!rival) {
    const bl = BAL.neg.bluff;
    const risk = clamp(bl.base + bl.info * club.director.info - bl.table * S.agency.upgrades.table, bl.min, bl.max);
    hand.push({ id: 'blof', label: 'Blöf', text: 'Başka teklifin varmış gibi yap.', effect: 'Tavan +%' + Math.round(Z.blof * 100), kPct: Z.blof, patience: 0, risk: Math.round(risk * 100) });
  }
  if (isDeadline && needLvl >= Z.songunNeed) hand.push({ id: 'songun', label: 'Son Gün Baskısı', text: 'Saat daralıyor, kulüp ihtiyacını biliyor.', effect: 'Tavan +%' + Math.round(Z.songun * 100), kPct: Z.songun, patience: 0, risk: null });
  if (p.st.last.length >= Z.formApps && avgRecent(p) >= Z.formMin) hand.push({ id: 'formda', label: 'Formda', text: 'Son maçlarda ortalama ' + avgRecent(p).toFixed(1).replace('.', ',') + '.', effect: 'Tavan +%' + Math.round(Z.formda * 100), kPct: Z.formda, patience: 0, risk: null });
  if (p.hype >= Z.hypeMin) hand.push({ id: 'taraftar', label: 'Taraftar', text: 'Tribünler adını haykırıyor.', effect: 'Sabır +1, tavan +%' + Math.round(Z.taraftar * 100), kPct: Z.taraftar, patience: 1, risk: null });
  if (kind === 'free' || p.contractEnd === S.time.season) hand.push({ id: 'sozlesme', label: 'Sözleşme Bitiyor', text: kind === 'free' ? 'Bonservis ödemeden alabilirler.' : 'Sözleşmesi bu sezon bitiyor.', effect: 'Tavan +%' + Math.round(Z.sozlesme * 100), kPct: Z.sozlesme, patience: 0, risk: null });
  if (club.trust >= Z.trustMin) hand.push({ id: 'dostluk', label: 'Eski Dostluk', text: 'Direktörle aranız iyi.', effect: 'Tavan aralığını gösterir, sabır +1', kPct: 0, patience: 1, risk: null });
  const max = S.agency.upgrades.table >= 3 ? Z.handMaxL3 : Z.handMax;
  return hand.slice(0, max).map(c => ({ ...c, used: false }));
}

function makeBand(S, K, half) {
  const u = rnd(S);
  const w = 2 * half;
  const lo = K * (1 - w * u);
  return { lo: Math.round(lo), hi: Math.round(lo + K * w) };
}

// ------------------------------------------------------------------------------------------ open

/**
 * Build a table. `opts.free` skips the energy cost (Son Gün); `opts.kBoost` raises K; `opts.patiencePenalty`;
 * `opts.deadline` = {callId, level}.
 * @returns {Result}
 */
export function openTable(S, a, opts = {}) {
  if (S.negotiation) return fail('Zaten açık bir masa var');
  const it = S.interests.find(i => i.id === (a && a.interestId));
  if (!it) return fail('İlgi bulunamadı');
  const reason = interestOpenReason(S, it);
  if (reason) return fail(reason);
  if (!opts.free && S.agency.energy < 1) return fail('Enerjin yetmiyor');
  const p = S.players[it.playerId], club = S.clubs[it.clubId];
  const N = BAL.neg;
  const kind = it.kind;
  const fair = fairPackage(S, p, club, kind);
  const tf = kind === 'transfer' ? market.estimateTransferFee(S, p, club) : 0;
  const cp = ceilingParts(S, p, club, kind, it.level, fair, tf);
  let K = cp.K * (1 + (opts.kBoost || 0));
  const persona = club.director.persona;
  let patience = (BAL.persona[persona] || BAL.persona.durust).patience;
  patience += S.agency.upgrades.table >= 1 ? N.table.patience : 0;
  if (S.meta.archetype === 'hukukcu') patience += BAL.archetype.hukukcu.patience;
  patience = Math.max(1, patience - (opts.patiencePenalty || 0));
  const isDl = !!opts.deadline || S.time.phase === 'deadline';
  const hand = buildHand(S, p, club, kind, isDl, cp.need);
  const band = S.agency.upgrades.table >= N.table.bandTable ? { ...makeBand(S, K, N.table.band), source: 'masa' } : null;
  if (!opts.free) spendEnergy(S, 1);
  S.negotiation = {
    id: 'n' + S.time.season + '_' + S.time.month + '_' + it.id,
    interestId: it.id, kind, kindLabel: KIND_LABEL[kind] + (kind === 'free' && !p.clubId ? ' (Serbest oyuncu)' : ''),
    playerId: p.id, clubId: club.id, fromClubId: p.clubId || null,
    round: 0, patience, patienceMax: patience, insults: 0,
    fair, limits: limitsFor(fair, p), transferFee: tf, demandWage: demandWage(S, p, club, kind),
    feeThreshold: market.feeThreshold(S),
    hand, package: null, counter: null, lastTell: null, ceilingBand: band, pending: null, log: [],
    deadline: opts.deadline ? { ...opts.deadline } : null,
    hidden: { K, K0: K, persona, gen: cp.gen, trueLevel: null, kBoost: opts.kBoost || 0, saved: cp.saved },
  };
  const ev = [{ type: 'tableOpen', playerId: p.id, clubId: club.id, kind, patience }];
  return { ok: true, events: ev, negotiation: negotiationView(S) };
}

/**
 * Open a table for an interest (1 energy; free during Son Gün, where it uses the hour's action).
 * @param {object} S
 * @param {{interestId:string}} a
 * @returns {Result}
 */
export function open(S, a) {
  if (S.time.phase === 'deadline') {
    const dl = S.deadline;
    if (!dl || dl.ended) return fail('Gece yarısı geçti');
    if (dl.actionsLeft <= 0) return fail('Bu saatin hakkı bitti');
    const r = openTable(S, a, { free: true, deadline: { callId: null, level: 0 } });
    if (!r.ok) return r;
    r.events.push(...useAction(S));
    return r;
  }
  return openTable(S, a);
}

// ------------------------------------------------------------------------------------------ preview

/**
 * Live preview while sliders move (no state change, never reveals the ceiling).
 * @param {object} S
 * @param {{package:object, koz?:string|null}} a
 * @returns {{cost:number, satisfaction:number, satisfactionParts:{label:string,value:number}[], feeSharePct:number,
 *   feeWarning:boolean, clientOk:boolean, clientLean:boolean, transferFee:number, expectedMinutes:number, demandWage:number, error?:string}}
 */
export function preview(S, a) {
  const n = S.negotiation;
  const blank = { cost: 0, satisfaction: 0, satisfactionParts: [], feeSharePct: 0, feeWarning: false, clientOk: false, clientLean: false, transferFee: 0, expectedMinutes: 0, demandWage: 0 };
  if (!n) return { ...blank, error: 'Açık masa yok' };
  const v = validatePackage(n, a && a.package);
  const raw = (a && a.package) || {};
  const p = S.players[n.playerId], club = S.clubs[n.clubId];
  const pkg = v.pkg || { wage: Math.max(0, +raw.wage || 0), years: clamp(Math.round(+raw.years || 1), 1, 5), bonus: Math.max(0, +raw.bonus || 0), fee: Math.max(0, +raw.fee || 0), clauses: { minutes: !!(raw.clauses && raw.clauses.minutes), release: !!(raw.clauses && raw.clauses.release) } };
  const sat = satisfaction(S, p, club, n.kind, pkg);
  const share = market.feeShare(pkg);
  const res = {
    cost: packageCost(pkg), satisfaction: sat.value, satisfactionParts: sat.parts,
    feeSharePct: Math.round(share * 1000) / 10, feeWarning: share > n.feeThreshold + 1e-9,
    clientOk: sat.value >= BAL.neg.sat.ok, clientLean: sat.value >= BAL.neg.sat.lean && sat.value < BAL.neg.sat.ok,
    transferFee: n.transferFee, expectedMinutes: sat.minutes, demandWage: sat.demand,
  };
  if (v.error) res.error = v.error;
  return res;
}

// ------------------------------------------------------------------------------------------ closing

function close(S) { S.negotiation = null; }

function settle(S, n, pkg) {
  const deal = { playerId: n.playerId, toClubId: n.clubId, kind: n.kind, wage: pkg.wage, years: pkg.years, bonus: pkg.bonus, fee: pkg.fee, clauses: pkg.clauses, transferFee: n.transferFee };
  const dl = n.deadline && S.deadline ? S.deadline : null;
  close(S);
  const r = market.executeTransfer(S, deal);
  if (dl && r.ok) { dl.deals = (dl.deals || 0) + 1; dl.log.push({ hour: dl.hour, kind: 'deal', text: S.players[deal.playerId].name + ' için anlaşma imzalandı', playerId: deal.playerId }); }
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

/** Client check after the club said yes. */
function clientStep(S, n, pkg, sat) {
  if (sat.value >= BAL.neg.sat.ok) return { done: true, result: settle(S, n, pkg) };
  n.pending = { package: pkg, satisfaction: sat.value };
  return { done: false };
}

// ------------------------------------------------------------------------------------------ propose

/**
 * Make an offer (at most one Koz per round). The client must agree to the package (satisfaction ≥ 40);
 * the director accepts iff cost ≤ his hidden ceiling, otherwise patience −1 (−2 when > 1.35×: "hakaret"),
 * a tell and a counter-package costing K·(0.80+0.05·round).
 * @param {object} S
 * @param {{package:object, koz?:string|null}} a
 * @returns {Result} `{ok:true, outcome:'accepted'|'countered'|'hesitates'|'left', round, patience, tell?, counter?, insult?, koz?, events}`
 */
export function propose(S, a) {
  const n = S.negotiation;
  if (!n) return fail('Açık masa yok');
  const v = validatePackage(n, a && a.package);
  if (v.error) return fail(v.error);
  const pkg = v.pkg;
  const p = S.players[n.playerId], club = S.clubs[n.clubId];
  const sat = satisfaction(S, p, club, n.kind, pkg);
  if (sat.value < BAL.neg.sat.lean) return fail('Oyuncu bu teklifi kabul etmez (memnuniyet ' + sat.value + '). Maaşı ya da primi artır.');
  let card = null;
  if (a.koz) {
    card = n.hand.find(h => h.id === a.koz && !h.used);
    if (!card) return fail('Bu koz elinde yok');
  }
  const H = n.hidden;
  const events = [];
  let kozRes = null;
  // --- play the Koz
  if (card) {
    card.used = true;
    kozRes = { id: card.id, label: card.label, caught: false };
    const scale = f => { H.K *= f; if (n.ceilingBand) { n.ceilingBand.lo = Math.round(n.ceilingBand.lo * f); n.ceilingBand.hi = Math.round(n.ceilingBand.hi * f); } };
    if (card.id === 'blof') {
      if (chance(S, card.risk / 100)) {
        kozRes.caught = true;
        n.patience += BAL.neg.bluff.patience;
        club.trust = clamp(club.trust + BAL.neg.bluff.trust, 0, 100);
        S.agency.rep = clamp(S.agency.rep + BAL.neg.bluff.rep, 0, 100);
        S.agency.stats.bluffsCaught++;
        events.push({ type: 'bluffCaught', clubId: club.id, trust: club.trust });
      } else scale(1 + card.kPct);
    } else {
      if (card.kPct) scale(1 + card.kPct);
      if (card.patience) { n.patience += card.patience; n.patienceMax = Math.max(n.patienceMax, n.patience); }
      if (card.id === 'dostluk') n.ceilingBand = { ...makeBand(S, H.K, 0.08), source: 'dostluk' };
    }
    if (kozRes.caught && n.patience <= 0) {
      n.log.push({ round: n.round, cost: packageCost(pkg), koz: card.id, outcome: 'left' });
      const ev = leave(S, n);
      events.push(ev);
      return { ok: true, outcome: 'left', round: n.round, patience: 0, koz: kozRes, events };
    }
  }
  const C = packageCost(pkg);
  const K = Math.round(H.K);
  n.package = pkg;
  n.pending = null;
  // --- accepted?
  if (C <= K) {
    n.log.push({ round: n.round + 1, cost: C, koz: card ? card.id : null, outcome: 'accepted' });
    const st = clientStep(S, n, pkg, sat);
    if (st.done) { const r = st.result; return { ...r, outcome: 'accepted', round: n.round, koz: kozRes, events: [...events, ...r.events] }; }
    n.counter = null;
    return { ok: true, outcome: 'hesitates', round: n.round, patience: n.patience, satisfaction: sat.value, canLean: true, koz: kozRes, events };
  }
  // --- refused
  n.round++;
  const insult = C > K * BAL.neg.insult;
  if (insult) n.insults++;
  n.patience -= insult ? 2 : 1;
  const trueLevel = tellLevel((C - K) / K);
  H.trueLevel = trueLevel;
  const T = BAL.neg.table;
  const honest = club.trust >= T.kurnazTrust || S.agency.upgrades.table >= T.kurnazTable;
  const shown = H.persona === 'kurnaz' && !honest ? Math.min(4, trueLevel + 1) : trueLevel;
  const tell = tellFor(club, shown);
  n.lastTell = tell;
  n.log.push({ round: n.round, cost: C, koz: card ? card.id : null, outcome: 'refused', tell: shown });
  events.push({ type: 'tell', level: shown, face: tell.face, line: tell.line, insult });
  if (n.patience <= 0) {
    events.push(leave(S, n));
    return { ok: true, outcome: 'left', round: n.round, patience: 0, tell, insult, koz: kozRes, events };
  }
  const target = Math.min(K, K * (BAL.neg.creep.base + BAL.neg.creep.step * n.round));
  const cp = shapeCounter(n, pkg, target);
  const cs = satisfaction(S, p, club, n.kind, cp);
  n.counter = { package: cp, cost: packageCost(cp), satisfaction: cs.value, clientOk: cs.value >= BAL.neg.sat.ok, clientLean: cs.value >= BAL.neg.sat.lean && cs.value < BAL.neg.sat.ok };
  return { ok: true, outcome: 'countered', round: n.round, patience: n.patience, patienceMax: n.patienceMax, tell, counter: n.counter, insult, koz: kozRes, events };
}

/**
 * Accept the director's last counter-package (the client must still agree: 40..49 → "İkna et").
 * @param {object} S
 * @returns {Result}
 */
export function acceptCounter(S) {
  const n = S.negotiation;
  if (!n) return fail('Açık masa yok');
  if (!n.counter) return fail('Karşı teklif yok');
  const pkg = n.counter.package;
  const p = S.players[n.playerId], club = S.clubs[n.clubId];
  const sat = satisfaction(S, p, club, n.kind, pkg);
  if (sat.value < BAL.neg.sat.lean) return fail('Oyuncu bu karşı teklifi kabul etmiyor (memnuniyet ' + sat.value + ')');
  n.package = pkg;
  n.log.push({ round: n.round, cost: n.counter.cost, koz: null, outcome: 'counterAccepted' });
  const st = clientStep(S, n, pkg, sat);
  if (st.done) return { ...st.result, outcome: 'accepted', round: n.round };
  return { ok: true, outcome: 'hesitates', round: n.round, patience: n.patience, satisfaction: sat.value, canLean: true, events: [] };
}

/**
 * Walk away (no penalty). Closes S.negotiation.
 * @param {object} S
 * @returns {Result}
 */
export function walkAway(S) {
  const n = S.negotiation;
  if (!n) return fail('Açık masa yok');
  const ev = { type: 'walkAway', clubId: n.clubId, playerId: n.playerId };
  close(S);
  return { ok: true, events: [ev] };
}

/**
 * "İkna et": when the pending package leaves the client at 40..49, lean on him (loyalty −8) so he signs.
 * @param {object} S
 * @returns {Result}
 */
export function leanOnClient(S) {
  const n = S.negotiation;
  if (!n) return fail('Açık masa yok');
  if (!n.pending) return fail('İkna edilecek bir teklif yok');
  const p = S.players[n.playerId];
  const pkg = n.pending.package;
  p.loyalty = clamp(p.loyalty + BAL.neg.sat.leanLoyalty, 0, 100);
  const r = settle(S, n, pkg);
  if (!r.ok) return r;
  r.events.unshift({ type: 'leaned', playerId: p.id, loyalty: p.loyalty });
  return { ...r, outcome: 'accepted' };
}
