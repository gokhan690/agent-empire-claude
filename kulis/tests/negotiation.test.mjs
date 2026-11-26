import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, advance } from '../src/engine/game.js';
import { BAL } from '../src/engine/constants.js';
import { myClients, negotiationView, deadlineCalls, interestList } from '../src/engine/selectors.js';
import { playerValue } from '../src/engine/valuation.js';
import * as neg from '../src/engine/negotiation.js';
import * as deadline from '../src/engine/deadline.js';
import * as market from '../src/engine/market.js';
import { assertClean, keepAlive } from './helpers.mjs';

/** A controlled table: strong TR client (starter at the target club), neutral trait, rich club. */
function table(o = {}) {
  const { seed = 3, persona = 'durust', info = 0, trust = 30, trait = 'profesyonel', kind = 'transfer', tableLvl = 0, archetype, month = 1, level = 80, hype = 20, open = true } = o;
  const S = newGame({ seed, archetype });
  const p = myClients(S)[1];
  p.trait = trait; p.dream = { type: 'big_wage', target: 1e9, done: false };
  p.ca = 70; p.cf = 70; p.pa = 70; p.form = 0; p.hype = hype; p.age = 25;
  const club = Object.values(S.clubs).find(c => c.leagueId === 'tr1' && c.id !== p.clubId);
  club.budget = 1e9; club.trust = trust; club.director = { name: 'Test Direktör', persona, info };
  club.needs = [{ pos: p.pos, level: 2 }];
  p.value = playerValue(S, p);
  S.agency.upgrades.table = tableLvl;
  S.time.month = month;
  S.agency.energy = 4;
  let clubId = club.id;
  if (kind === 'free') { p.contractEnd = S.time.season; S.time.month = 6; }
  if (kind === 'renewal') { p.contractEnd = S.time.season; S.time.month = 4; clubId = p.clubId; S.clubs[clubId].needs = []; }
  const it = { id: 'iT', playerId: p.id, clubId, level, kind, cooldown: 0, boost: 0 };
  S.interests.push(it);
  if (open) { const r = act(S, 'openNegotiation', { interestId: 'iT' }); assert.ok(r.ok, r.error); }
  return { S, p, club: S.clubs[clubId], it };
}
/** Run `fn` with the hidden-quantity noise switched off (exact arithmetic assertions); restores the numbers afterwards. */
function noiseless(fn) {
  const saved = { creep: BAL.neg.creep.noise, p: Object.fromEntries(Object.keys(BAL.persona).filter(k => BAL.persona[k].noise !== undefined).map(k => [k, BAL.persona[k].noise])) };
  BAL.neg.creep.noise = 0;
  for (const k in saved.p) BAL.persona[k].noise = 0;
  BAL.neg.gen.noise = 0;
  try { return fn(); } finally { BAL.neg.creep.noise = saved.creep; for (const k in saved.p) BAL.persona[k].noise = saved.p[k]; BAL.neg.gen.noise = 0.07; }
}
const K = S => S.negotiation.hidden.K;
function setK(S, k) { S.negotiation.hidden.K = k; S.negotiation.hidden.K0 = k; }
/** fair package with the fee adjusted so that cost == target (fee ≥ 0). */
function costing(S, target, extra = {}) {
  const f = { ...S.negotiation.fair, ...extra, clauses: { minutes: false, release: false, ...(extra.clauses || {}) } };
  const base = f.wage * 12 * f.years + f.bonus;
  f.fee = Math.max(0, Math.round(target - base));
  return f;
}
const cost = pkg => neg.packageCost(pkg);

test('open: costs 1 energy, builds a table, hides the ceiling from the public view', () => {
  const { S, p, club } = table();
  const n = S.negotiation;
  assert.equal(S.agency.energy, 3);
  assert.equal(n.kind, 'transfer'); assert.equal(n.playerId, p.id); assert.equal(n.clubId, club.id);
  assert.equal(n.patience, 4); assert.equal(n.patienceMax, 4);
  assert.ok(n.transferFee > 0 && n.fair.wage > 0 && n.demandWage > 0);
  assert.ok(typeof n.hidden.K === 'number' && n.hidden.K > 0);
  const v = negotiationView(S);
  assert.equal(v.hidden, undefined);
  assert.equal(neg.publicView(S).hidden, undefined);
  assert.ok(!JSON.stringify(v).includes(String(Math.round(K(S)))));
  assert.equal(act(S, 'openNegotiation', { interestId: 'iT' }).ok, false, 'one table at a time');
  assert.equal(advance(S).ok, false, 'advance is blocked while a table is open');
  assertClean(S);
});

test('open: refused with Turkish reasons (level, window, cooldown, energy, unknown)', () => {
  let { S, it } = table({ open: false, level: 50 });
  assert.match(act(S, 'openNegotiation', { interestId: 'iT' }).error, /İlgi yetersiz/);
  ({ S, it } = table({ open: false, month: 3 }));
  assert.match(act(S, 'openNegotiation', { interestId: 'iT' }).error, /Transfer dönemi kapalı/);
  ({ S, it } = table({ open: false }));
  it.cooldown = 2;
  assert.match(act(S, 'openNegotiation', { interestId: 'iT' }).error, /küs/);
  it.cooldown = 0; S.agency.energy = 0;
  assert.match(act(S, 'openNegotiation', { interestId: 'iT' }).error, /Enerji/);
  assert.equal(act(S, 'openNegotiation', { interestId: 'nope' }).ok, false);
});

test('accept iff C ≤ K (club side), executes the transfer and reports dealDone', () => {
  const { S, p, club } = table();
  const fair = S.negotiation.fair;
  const withClause = { ...fair, clauses: { minutes: true, release: false } };
  assert.ok(act(S, 'negPreview', { package: fair }).preview.clientOk);
  setK(S, cost(fair) - 1);
  const r1 = act(S, 'negPropose', { package: fair });
  assert.equal(r1.outcome, 'countered');
  assert.equal(S.negotiation.patience, 3);
  setK(S, cost(fair));
  const cash = S.agency.cash, from = p.clubId;
  const r2 = act(S, 'negPropose', { package: fair });
  assert.equal(r2.outcome, 'accepted');
  assert.equal(S.negotiation, null);
  assert.equal(p.clubId, club.id);
  assert.equal(S.agency.cash, cash + fair.fee);
  const ev = r2.events.find(e => e.type === 'dealDone');
  assert.deepEqual([ev.playerId, ev.fromClubId, ev.toClubId, ev.commission, ev.wage, ev.years, ev.kind], [p.id, from, club.id, fair.fee, fair.wage, fair.years, 'transfer']);
  assert.ok(ev.fee > 0, 'transfer fee settled between clubs');
  void withClause;
  assertClean(S);
});

test('tell levels by gap: ≤5/12/22/35/>35 %, durust tells the truth', () => {
  const gaps = [[0.04, 0], [0.10, 1], [0.20, 2], [0.30, 3], [0.40, 4]];
  assert.equal(neg.tellLevel(0.05), 0); assert.equal(neg.tellLevel(0.12), 1); assert.equal(neg.tellLevel(0.22), 2); assert.equal(neg.tellLevel(0.35), 3); assert.equal(neg.tellLevel(0.351), 4);
  for (const [gap, lvl] of gaps) {
    const { S } = table({ persona: 'durust', trust: 20 });
    const base = S.negotiation.fair;
    const k = cost({ ...base, fee: 0 }) + 20000;
    setK(S, k);
    const r = act(S, 'negPropose', { package: costing(S, k * (1 + gap)) });
    assert.equal(r.outcome, 'countered');
    assert.equal(S.negotiation.hidden.trueLevel, lvl);
    assert.equal(r.tell.level, lvl);
    assert.equal(typeof r.tell.line, 'string'); assert.ok(r.tell.line.length > 0);
    assert.ok(r.tell.face);
  }
});

test('kurnaz shows tells one level angrier unless trust ≥ 60 or table L2', () => {
  for (const [trust, tbl, shift] of [[30, 0, 1], [30, 1, 1], [60, 0, 0], [30, 2, 0]]) {
    const { S } = table({ persona: 'kurnaz', trust, tableLvl: tbl });
    const k = cost({ ...S.negotiation.fair, fee: 0 }) + 20000;
    setK(S, k);
    const r = act(S, 'negPropose', { package: costing(S, k * 1.10) });
    assert.equal(S.negotiation.hidden.trueLevel, 1);
    assert.equal(r.tell.level, 1 + shift, 'trust ' + trust + ' table ' + tbl);
  }
  // capped at level 4
  const { S } = table({ persona: 'kurnaz', trust: 20 });
  const k = cost({ ...S.negotiation.fair, fee: 0 }) + 20000; setK(S, k);
  const r = act(S, 'negPropose', { package: costing(S, k * 1.5) });
  assert.equal(r.tell.level, 4);
});

test('other personas tell the truth; persona changes K and patience (cimri K−8%/6, sabirsiz K+8%/3)', () => {
  noiseless(() => {
  const ks = {};
  for (const persona of ['durust', 'cimri', 'sabirsiz', 'kurnaz', 'gosterisci']) {
    const { S } = table({ persona, hype: 20 });
    ks[persona] = K(S);
    assert.equal(S.negotiation.patience, { durust: 4, kurnaz: 4, cimri: 6, sabirsiz: 3, gosterisci: 4 }[persona]);
  }
  assert.ok(Math.abs(ks.cimri / ks.durust - 0.92) < 1e-9);
  assert.ok(Math.abs(ks.sabirsiz / ks.durust - 1.08) < 1e-9);
  assert.ok(Math.abs(ks.gosterisci / ks.durust - 0.97) < 1e-9, 'showy: −3% for low-hype players');
  const hyped = table({ persona: 'gosterisci', hype: 70 });
  const base = table({ persona: 'durust', hype: 70 });
  assert.ok(Math.abs(K(hyped.S) / K(base.S) - 1.12) < 1e-9, 'showy: +12% for hype ≥ 60');
  for (const persona of ['cimri', 'sabirsiz', 'gosterisci']) {
    const { S } = table({ persona });
    const k = cost({ ...S.negotiation.fair, fee: 0 }) + 20000; setK(S, k);
    const r = act(S, 'negPropose', { package: costing(S, k * 1.15) });
    assert.equal(r.tell.level, 2, persona);
  }
  });
});

test('patience upgrades and archetype: table L1 +1, hukukcu +1', () => {
  assert.equal(table({ tableLvl: 1 }).S.negotiation.patience, 5);
  assert.equal(table({ archetype: 'hukukcu' }).S.negotiation.patience, 5);
  assert.equal(table({ archetype: 'hukukcu', tableLvl: 1, persona: 'cimri' }).S.negotiation.patience, 8);
});

test('counter creep: cost = K·(0.80 + 0.05·round), never above K; rounds drain patience; director leaves at 0', () => {
  noiseless(() => {
  const { S, club, it } = table({ persona: 'cimri' }); // patience 6
  const k = cost({ ...S.negotiation.fair, fee: 0 }) + 30000; setK(S, k);
  const trust = club.trust;
  let prev = 0;
  for (let round = 1; round <= 5; round++) {
    const r = act(S, 'negPropose', { package: costing(S, k * 1.3) });
    assert.equal(r.outcome, 'countered');
    assert.equal(r.round, round);
    const target = Math.min(k, k * (0.80 + 0.05 * round));
    assert.ok(r.counter.cost <= target + 1, 'cost ≤ target');
    assert.ok(r.counter.cost >= target * 0.97, 'cost close to target: ' + r.counter.cost / target);
    assert.ok(r.counter.cost >= prev, 'counters creep upwards');
    prev = r.counter.cost;
    assert.equal(r.patience, 6 - round);
  }
  const last = act(S, 'negPropose', { package: costing(S, k * 1.3) });
  assert.equal(last.outcome, 'left');
  assert.equal(S.negotiation, null);
  assert.equal(club.trust, trust + BAL.neg.leave.trust);
  assert.equal(it.cooldown, BAL.neg.leave.cooldown);
  assert.match(act(S, 'openNegotiation', { interestId: 'iT' }).error, /küs/);
  });
});

test('insult (> 1.35·K) costs 2 patience and flags hakaret with the harshest tell', () => {
  const { S } = table();
  const k = cost({ ...S.negotiation.fair, fee: 0 }) + 20000; setK(S, k);
  const r = act(S, 'negPropose', { package: costing(S, k * 1.36) });
  assert.equal(r.outcome, 'countered');
  assert.equal(r.insult, true);
  assert.equal(r.patience, 2);
  assert.equal(r.tell.level, 4);
  assert.equal(S.negotiation.insults, 1);
  const r2 = act(S, 'negPropose', { package: costing(S, k * 1.30) });
  assert.equal(r2.insult, false);
  assert.equal(r2.patience, 1);
});

test('counter-package is shaped by the director persona (kurnaz squeezes the fee, cimri the bonus)', () => {
  noiseless(() => {
  const out = {};
  for (const persona of ['kurnaz', 'cimri']) {
    const { S } = table({ persona, tableLvl: 2 });
    const f = S.negotiation.fair;
    const k = cost({ ...f, fee: 0 }) + 20000; setK(S, k);
    const pkg = costing(S, k * 1.3, { bonus: f.bonus * 2 });
    const r = act(S, 'negPropose', { package: pkg });
    out[persona] = { c: r.counter.package, pkg };
  }
  const feeCut = o => 1 - o.c.fee / o.pkg.fee, bonusCut = o => 1 - o.c.bonus / o.pkg.bonus;
  // the fee floor keeps both from zero, but kurnaz still squeezes the fee harder than cimri does (cimri squeezes the bonus first)
  assert.ok(feeCut(out.kurnaz) > feeCut(out.cimri));
  assert.ok(feeCut(out.kurnaz) > 0.5 && out.kurnaz.c.fee > 0);
  assert.ok(bonusCut(out.cimri) >= feeCut(out.cimri));
  });
});

test('acceptCounter: executes when the client agrees; error without a counter', () => {
  noiseless(() => {
  const { S, p, club } = table();
  assert.equal(act(S, 'negAcceptCounter').ok, false);
  const k = cost({ ...S.negotiation.fair, fee: 0 }) + 20000; setK(S, k);
  act(S, 'negPropose', { package: costing(S, k * 1.15) });
  const c = S.negotiation.counter;
  assert.ok(c.cost <= k);
  const r = act(S, 'negAcceptCounter');
  assert.ok(r.ok, r.error);
  assert.equal(r.outcome === 'accepted' || r.outcome === 'hesitates', true);
  if (r.outcome === 'accepted') { assert.equal(p.clubId, club.id); assert.equal(p.wage, c.package.wage); }
  });
});

test('walkAway: no penalty, closes the table', () => {
  const { S, club, p } = table();
  const trust = club.trust, loyalty = p.loyalty;
  const r = act(S, 'negWalkAway');
  assert.ok(r.ok);
  assert.equal(S.negotiation, null);
  assert.equal(club.trust, trust); assert.equal(p.loyalty, loyalty);
  assert.equal(act(S, 'negWalkAway').ok, false);
});

test('package validation: Turkish errors, no state change', () => {
  const { S } = table();
  const f = S.negotiation.fair;
  for (const bad of [{ ...f, wage: 10 }, { ...f, wage: 1e9 }, { ...f, years: 7 }, { ...f, years: 0 }, { ...f, bonus: -1 }, { ...f, fee: 1e9 }, { ...f, wage: NaN }, null]) {
    const r = act(S, 'negPropose', { package: bad });
    assert.equal(r.ok, false);
    assert.equal(typeof r.error, 'string');
    assert.equal(S.negotiation.round, 0);
    assert.equal(S.negotiation.patience, 4);
  }
  assert.match(act(S, 'negPropose', { package: { ...f, wage: 10 } }).error, /Maaş/);
  assert.match(act(S, 'negPropose', { package: { ...f, years: 9 } }).error, /Süre/);
  assert.ok(act(S, 'negPreview', { package: { ...f, wage: 10 } }).preview.error);
});

test('preview: live cost, satisfaction parts that add up, fee warning, no ceiling leak', () => {
  const { S } = table();
  const f = S.negotiation.fair;
  const pv = act(S, 'negPreview', { package: f }).preview;
  assert.equal(pv.cost, cost(f));
  assert.equal(pv.satisfactionParts.reduce((s, x) => s + x.value, 0), pv.satisfaction);
  assert.ok(pv.satisfactionParts.every(x => typeof x.label === 'string' && Number.isFinite(x.value)));
  assert.ok(pv.satisfaction >= 50 && pv.clientOk && !pv.feeWarning);
  assert.equal(pv.transferFee, S.negotiation.transferFee);
  assert.ok(pv.expectedMinutes > 0.5);
  assert.deepEqual(Object.keys(pv).filter(k => /ceil|hidden|^K$/i.test(k)), []);
  const greedy = act(S, 'negPreview', { package: { ...f, fee: f.fee * 4 } }).preview;
  assert.ok(greedy.feeWarning && greedy.feeSharePct > 12);
  const cl = act(S, 'negPreview', { package: { ...f, clauses: { minutes: true, release: true } } }).preview;
  assert.equal(cl.cost, Math.round((f.wage * 12 * f.years + f.bonus + f.fee) * 1.13));
});

test('fee threshold: 12% warns, hukukcu 15%; executed deal above it costs loyalty −5', () => {
  for (const [arch, mult, warn] of [['mahalle', 1.2, false], ['mahalle', 2.2, true], ['hukukcu', 1.8, false], ['hukukcu', 3.2, true]]) {
    const { S, p } = table({ archetype: arch });
    const f = S.negotiation.fair;
    const pkg = { ...f, fee: Math.round(f.fee * mult) };
    const pv = act(S, 'negPreview', { package: pkg }).preview;
    assert.equal(pv.feeWarning, warn, arch + ' ' + mult + ' share ' + pv.feeSharePct);
    setK(S, 1e9);
    const loy = p.loyalty;
    const r = act(S, 'negPropose', { package: pkg });
    assert.equal(r.outcome, 'accepted');
    const notice = r.events.some(e => e.type === 'feeNoticed');
    assert.equal(notice, warn);
    assert.equal(p.loyalty - loy < 0, warn, 'loyalty drops only when noticed (net of move bonuses)');
  }
});

test('three-way tension: a greedy fee forces a lower wage under the ceiling and drops satisfaction', () => {
  const { S } = table({ persona: 'durust' });
  const f = S.negotiation.fair;
  const k = Math.round(cost(f) * 1.04); setK(S, k);
  const maxWage = fee => Math.floor(((k - fee - f.bonus) / (12 * f.years)) / 100) * 100;
  const wFair = maxWage(f.fee), wGreedy = maxWage(f.fee * 3);
  assert.ok(wGreedy < wFair);
  const sFair = act(S, 'negPreview', { package: { ...f, wage: wFair } }).preview.satisfaction;
  const sGreedy = act(S, 'negPreview', { package: { ...f, wage: wGreedy, fee: f.fee * 3 } }).preview.satisfaction;
  assert.ok(sGreedy < sFair, sGreedy + ' < ' + sFair);
  const pkg = { ...f, wage: wGreedy, fee: f.fee * 3 };
  assert.ok(cost(pkg) <= k);
  // push the greed far enough and the client no longer signs, even though the club would
  const bad = { ...f, wage: Math.floor(maxWage(f.fee * 7) / 100) * 100, fee: f.fee * 7 };
  const pb = act(S, 'negPreview', { package: bad }).preview;
  assert.ok(pb.satisfaction < sFair - 8 && (!pb.clientOk || pb.feeWarning));
  assert.ok(pb.feeWarning, 'greedy fee is flagged');
});

test('client satisfaction: 40..49 hesitates → "İkna et" (loyalty −8) signs; < 40 refuses to take part', () => {
  const { S, p, club } = table({ trait: 'sadik' });
  const f = S.negotiation.fair;
  // search a wage that gives a satisfaction of 40..49
  let pkg = null;
  for (let w = f.wage; w >= f.wage * 0.3; w -= 100) {
    const pv = act(S, 'negPreview', { package: { ...f, wage: w, bonus: 0 } }).preview;
    if (pv.satisfaction >= 40 && pv.satisfaction <= 49) { pkg = { ...f, wage: w, bonus: 0 }; break; }
  }
  assert.ok(pkg, 'a lean-able package exists');
  setK(S, 1e9);
  const r = act(S, 'negPropose', { package: pkg });
  assert.equal(r.outcome, 'hesitates');
  assert.equal(r.canLean, true);
  assert.equal(S.negotiation.patience, 4, 'no patience lost');
  assert.ok(S.negotiation.pending);
  const loy = p.loyalty;
  const l = act(S, 'negLeanOnClient');
  assert.ok(l.ok, l.error);
  assert.equal(S.negotiation, null);
  assert.equal(p.clubId, club.id);
  assert.ok(l.events.some(e => e.type === 'dealDone'));
  assert.equal(l.events.find(e => e.type === 'leaned').loyalty, Math.max(0, loy - 8));
  // below 40: refused outright
  const t2 = table({ trait: 'paraci' });
  const f2 = t2.S.negotiation.fair;
  setK(t2.S, 1e9);
  const low = act(t2.S, 'negPropose', { package: { ...f2, wage: Math.round(f2.wage * 0.4 / 100) * 100, bonus: 0 } });
  assert.equal(low.ok, false);
  assert.match(low.error, /memnuniyet/);
  assert.equal(act(t2.S, 'negLeanOnClient').ok, false);
});

test('Koz hand is generated from real state', () => {
  const ids = S => S.negotiation.hand.map(h => h.id);
  let t = table();
  assert.deepEqual(ids(t.S), ['blof'], 'plain table: only the bluff');
  assert.equal(t.S.negotiation.hand[0].risk, 15);
  t = table({ hype: 70, trust: 70 });
  t.p.st.last = [7.5, 7.4, 7.6, 7.3];
  // rebuild with form
  let S = t.S; S.negotiation = null; S.agency.energy = 4;
  assert.ok(act(S, 'openNegotiation', { interestId: 'iT' }).ok);
  assert.deepEqual(ids(S).sort(), ['blof', 'dostluk', 'formda', 'taraftar'].sort());
  // rakip replaces blof
  t = table();
  const other = Object.values(t.S.clubs).find(c => c.id !== t.club.id && c.id !== t.p.clubId);
  t.S.negotiation = null; t.S.agency.energy = 4;
  t.S.interests.push({ id: 'iR', playerId: t.p.id, clubId: other.id, level: 55, kind: 'transfer', cooldown: 0, boost: 0 });
  act(t.S, 'openNegotiation', { interestId: 'iT' });
  assert.deepEqual(ids(t.S), ['rakip']);
  // sozlesme for expiring / free
  t = table({ kind: 'free' });
  assert.ok(ids(t.S).includes('sozlesme') && t.S.negotiation.kind === 'free');
  // songun only on deadline day with a real need
  t = table();
  t.S.negotiation = null; t.S.time.phase = 'deadline'; t.S.deadline = { hour: 18, actionsLeft: 1, actionsMax: 1, calls: [], log: [], deals: 0, ended: false };
  act(t.S, 'openNegotiation', { interestId: 'iT' });
  assert.ok(ids(t.S).includes('songun'));
  // table L3: five cards
  t = table({ tableLvl: 3, hype: 70, trust: 70 });
  t.p.st.last = [8, 8, 8, 8];
  t.S.negotiation = null; t.S.agency.energy = 4;
  t.S.interests.push({ id: 'iR', playerId: t.p.id, clubId: Object.values(t.S.clubs).find(c => c.id !== t.club.id && c.id !== t.p.clubId).id, level: 70, kind: 'transfer', cooldown: 0, boost: 0 });
  t.p.contractEnd = t.S.time.season;
  act(t.S, 'openNegotiation', { interestId: 'iT' });
  assert.equal(t.S.negotiation.hand.length, 5);
});

test('every Koz effect on K, patience and rules (one per round, once each)', () => {
  const check = (setup, id, kMult, dPat) => {
    const t = table({ hype: 70, trust: 70, ...setup.o });
    const S = t.S;
    setup.f && setup.f(t);
    if (setup.reopen) { S.negotiation = null; S.agency.energy = 4; act(S, 'openNegotiation', { interestId: 'iT' }); }
    const k0 = K(S);
    const k = cost({ ...S.negotiation.fair, fee: 0 }) + 20000; setK(S, k);
    const r = act(S, 'negPropose', { package: costing(S, k * 1.3), koz: id });
    assert.ok(r.ok, r.error);
    assert.ok(Math.abs(K(S) - k * kMult) < 1e-6, id + ' K ' + K(S) / k);
    assert.equal(S.negotiation.patience, 4 + dPat - 1, id + ' patience');
    assert.equal(S.negotiation.hand.find(h => h.id === id).used, true);
    const again = act(S, 'negPropose', { package: costing(S, k * 1.3), koz: id });
    assert.equal(again.ok, false, 'a Koz is single-use');
    void k0;
    return { S, r };
  };
  check({ f: t => { t.S.interests.push({ id: 'iR', playerId: t.p.id, clubId: Object.values(t.S.clubs).find(c => c.id !== t.club.id && c.id !== t.p.clubId).id, level: 60, kind: 'transfer', cooldown: 0, boost: 0 }); }, reopen: true }, 'rakip', 1.12, 0);
  check({ f: t => { t.p.st.last = [7.5, 7.4, 7.6, 7.3]; }, reopen: true }, 'formda', 1.08, 0);
  check({}, 'taraftar', 1.04, 1);
  check({ o: { kind: 'free' } }, 'sozlesme', 1.06, 0);
  const d = check({}, 'dostluk', 1, 1);
  const band = d.S.negotiation.ceilingBand;
  assert.ok(band && band.lo <= K(d.S) && band.hi >= K(d.S));
  assert.ok(Math.abs((band.hi - band.lo) / K(d.S) - 0.16) < 0.01, 'dostluk band is ±8%');
  const sg = table({ hype: 70, trust: 70 });
  sg.S.negotiation = null; sg.S.time.phase = 'deadline'; sg.S.deadline = { hour: 18, actionsLeft: 1, actionsMax: 1, calls: [], log: [], deals: 0, ended: false };
  act(sg.S, 'openNegotiation', { interestId: 'iT' });
  const k = cost({ ...sg.S.negotiation.fair, fee: 0 }) + 20000; setK(sg.S, k);
  const r = act(sg.S, 'negPropose', { package: costing(sg.S, k * 1.3), koz: 'songun' });
  assert.ok(r.ok); assert.ok(Math.abs(K(sg.S) - k * 1.10) < 1e-6);
  const ghost = table();
  assert.equal(act(ghost.S, 'negPropose', { package: ghost.S.negotiation.fair, koz: 'rakip' }).ok, false, 'a Koz you do not hold');
});

test('bluff: shown risk 15% + 8%·info − 10% (table L3+); success +10% K; caught = patience −2, trust −15, rep −2 (forced rng)', () => {
  assert.equal(table({ info: 2 }).S.negotiation.hand[0].risk, 31);
  assert.equal(table({ info: 3, tableLvl: 3 }).S.negotiation.hand[0].risk, 29);
  assert.equal(table({ info: 3, tableLvl: 2 }).S.negotiation.hand[0].risk, 39);
  assert.equal(table({ info: 0, tableLvl: 4 }).S.negotiation.hand[0].risk, 5);
  const t = table({ info: 3 }); // 39 %
  const base = JSON.stringify(t.S);
  const k = cost({ ...t.S.negotiation.fair, fee: 0 }) + 20000;
  setK(t.S, k);
  const frozen = JSON.stringify(t.S);
  let caught = null, ok = null;
  for (let rng = 1; rng < 400 && !(caught && ok); rng++) {
    const S = JSON.parse(frozen); S.rng = rng * 7919;
    const r = act(S, 'negPropose', { package: costing(S, k * 1.3), koz: 'blof' });
    assert.ok(r.ok);
    if (r.koz.caught) caught = { S, r }; else ok = { S, r };
  }
  assert.ok(caught && ok, 'both branches reachable');
  const c = JSON.parse(frozen);
  assert.equal(caught.S.agency.stats.bluffsCaught, 1);
  assert.equal(caught.S.agency.rep, c.agency.rep - 2);
  assert.equal(caught.S.clubs[c.negotiation.clubId].trust, c.clubs[c.negotiation.clubId].trust - 15);
  assert.equal(caught.S.negotiation.patience, 4 - 2 - 1);
  assert.equal(K(caught.S), k, 'K unchanged when caught');
  assert.equal(caught.r.events.some(e => e.type === 'bluffCaught'), true);
  assert.ok(Math.abs(K(ok.S) - k * 1.10) < 1e-6);
  assert.equal(ok.S.negotiation.patience, 3);
  void base;
  // determinism: same state + same rng = same outcome
  const a = JSON.parse(frozen), b = JSON.parse(frozen); a.rng = b.rng = 12345;
  const ra = act(a, 'negPropose', { package: costing(a, k * 1.3), koz: 'blof' }), rb = act(b, 'negPropose', { package: costing(b, k * 1.3), koz: 'blof' });
  assert.deepEqual(ra, rb); assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('bluff caught at 1 patience: the director leaves at once', () => {
  const t = table({ info: 3, persona: 'sabirsiz' }); // patience 3
  const k = cost({ ...t.S.negotiation.fair, fee: 0 }) + 20000; setK(t.S, k);
  t.S.negotiation.patience = 2;
  const frozen = JSON.stringify(t.S);
  for (let rng = 1; rng < 400; rng++) {
    const S = JSON.parse(frozen); S.rng = rng * 104729;
    const r = act(S, 'negPropose', { package: costing(S, k * 1.3), koz: 'blof' });
    if (r.koz && r.koz.caught) { assert.equal(r.outcome, 'left'); assert.equal(S.negotiation, null); return; }
  }
  assert.fail('never caught');
});

test('table upgrades: L2 true kurnaz tells, L3 bluff risk down, L4 ceiling band ±15% around K', () => {
  const t = table({ tableLvl: 4 });
  const b = t.S.negotiation.ceilingBand;
  assert.ok(b && b.lo <= K(t.S) && K(t.S) <= b.hi);
  assert.ok(Math.abs((b.hi - b.lo) / K(t.S) - 0.30) < 0.01);
  assert.equal(table({ tableLvl: 3 }).S.negotiation.ceilingBand, null);
  assert.equal(table({ tableLvl: 3 }).S.negotiation.hand[0].risk < table({ tableLvl: 0 }).S.negotiation.hand[0].risk, true);
});

test('free (pre-contract) table: bigger pie than a transfer, executes as pre-contract; renewal table extends', () => {
  const tr = table({ kind: 'transfer' }), fr = table({ kind: 'free' });
  const trCost = neg.packageCost(tr.S.negotiation.fair), frCost = neg.packageCost(fr.S.negotiation.fair);
  assert.ok(K(fr.S) / frCost > K(tr.S) / trCost, 'the saved fee is added to K');
  assert.equal(fr.S.negotiation.transferFee, 0);
  setK(fr.S, 1e9);
  const from = fr.p.clubId;
  const r = act(fr.S, 'negPropose', { package: fr.S.negotiation.fair });
  assert.equal(r.outcome, 'accepted');
  assert.equal(fr.p.clubId, from);
  assert.ok(fr.p.preContract);
  assert.equal(r.events[0].preContract, true);
  const rn = table({ kind: 'renewal' });
  assert.equal(rn.S.negotiation.kind, 'renewal');
  setK(rn.S, 1e9);
  const ce = rn.p.contractEnd, yrs = rn.S.negotiation.fair.years;
  const r2 = act(rn.S, 'negPropose', { package: rn.S.negotiation.fair });
  assert.equal(r2.outcome, 'accepted');
  assert.equal(rn.p.contractEnd, ce + yrs);
  assert.equal(rn.p.clubId, rn.club.id);
});

test('minutes guarantee clause: lifts satisfaction for a bench player and sets the guarantee flag', () => {
  const { S, p } = table();
  p.ca = 50; p.cf = 50; // now a bench player at the target club
  S.negotiation = null; S.agency.energy = 4; p.value = playerValue(S, p);
  assert.ok(act(S, 'openNegotiation', { interestId: 'iT' }).ok);
  const f = S.negotiation.fair;
  const a = act(S, 'negPreview', { package: f }).preview, b = act(S, 'negPreview', { package: { ...f, clauses: { minutes: true } } }).preview;
  assert.ok(b.satisfaction > a.satisfaction && b.expectedMinutes > a.expectedMinutes);
  setK(S, 1e9);
  const r = act(S, 'negPropose', { package: { ...f, clauses: { minutes: true } } });
  assert.ok(r.ok);
  if (r.outcome === 'hesitates') act(S, 'negLeanOnClient');
  assert.equal(p.guarantee, true);
});

test('career fit: a benched hırslı client loses morale/loyalty; a starter gains', () => {
  const mk = (ca, trait) => {
    const { S, p, club } = table({ trait });
    p.ca = ca; p.cf = ca; p.morale = 60; p.loyalty = 60;
    const m0 = p.morale, l0 = p.loyalty;
    const r = market.executeTransfer(S, { playerId: p.id, toClubId: club.id, kind: 'transfer', wage: 9000, years: 3, bonus: 0, fee: 1000, clauses: {} });
    return { dm: p.morale - m0, dl: p.loyalty - l0, ev: r.events[0] };
  };
  const star = mk(78, 'hirsli'), bench = mk(45, 'hirsli');
  assert.ok(star.dm > 0 && bench.dm < 0, star.dm + ' / ' + bench.dm);
  assert.ok(bench.dl < star.dl);
  assert.ok(star.ev.expectedMinutes > bench.ev.expectedMinutes);
});

// ----------------------------------------------------------------------------- Son Gün

function deadlineSetup(seed = 3) {
  const S = newGame({ seed });
  const p = myClients(S)[1];
  p.ca = 70; p.cf = 70; p.pa = 70; p.trait = 'profesyonel'; p.dream = { type: 'big_wage', target: 1e9, done: false };
  p.value = playerValue(S, p);
  const clubs = Object.values(S.clubs).filter(c => c.leagueId === 'tr1' && c.id !== p.clubId).slice(0, 3);
  for (const c of clubs) { c.needs = [{ pos: p.pos, level: 3 }]; c.budget = 1e9; }
  S.time.month = 1;
  return { S, p, clubs };
}

test('deadline.start: false when nothing to do; otherwise phase + calls', () => {
  const S = newGame({ seed: 3 });
  S.time.month = 2;
  assert.equal(deadline.start(S), false, 'not a deadline month');
  S.time.month = 1;
  for (const p of myClients(S)) p.agentId = null;
  assert.equal(deadline.start(S), false, 'no clients');
  const d = deadlineSetup();
  d.S.interests = [];
  for (const c of Object.values(d.S.clubs)) if (!d.clubs.includes(c)) c.needs = [];
  d.S.agency.energy = 4;
  const r = advance(d.S);
  assert.equal(r.phase, 'deadline');
  assert.equal(d.S.time.phase, 'deadline');
  const dl = d.S.deadline;
  assert.equal(dl.hour, 18); assert.equal(dl.actionsLeft, 1); assert.ok(dl.calls.length >= 1);
  for (const c of dl.calls) {
    assert.ok(c.fromHour >= 18 && c.expiresHour <= 23 && c.expiresHour >= c.fromHour);
    assert.equal(c.taken, false); assert.ok(c.level >= 2 && c.level <= 3);
    assert.equal(d.S.players[c.playerId].agentId, 'you');
  }
  assert.equal(deadlineCalls(d.S).filter(c => c.available).length >= 1, true);
  assertClean(d.S);
});

test('Son Gün end-to-end: take a call (quick table: patience −1, K up, songun), sign, hours roll, midnight collapses, month plays', () => {
  const { S, p } = deadlineSetup();
  assert.equal(advance(S).phase, 'deadline');
  const dl = S.deadline;
  const call = deadlineCalls(S).find(c => c.available);
  assert.ok(call);
  // table opened by hand to compare against takeCall's K boost
  const energy = S.agency.energy;
  const r = act(S, 'deadlineTakeCall', { callId: call.id });
  assert.ok(r.ok, r.error);
  assert.equal(S.agency.energy, energy, 'Son Gün tables are free');
  const n = S.negotiation;
  assert.ok(n && n.deadline && n.deadline.callId === call.id);
  assert.equal(n.patience, 3, 'patience −1 (durust 4 → 3 unless persona differs)'.length ? n.patience : 0);
  assert.ok(n.hand.some(h => h.id === 'songun'));
  const boost = BAL.deadline.kBoost[call.level];
  assert.ok(Math.abs(n.hidden.K / n.hidden.K0 - 1) < 1e-9);
  assert.ok(n.hidden.kBoost === boost);
  assert.equal(dl.hour, 19, 'the action was spent → next hour');
  assert.equal(act(S, 'deadlineTakeCall', { callId: call.id }).ok, false, 'a table is open / call taken');
  assert.equal(act(S, 'deadlineSkipHour').ok, false, 'close the table first');
  // sign the deal
  S.negotiation.hidden.K = 1e9;
  const club = S.clubs[n.clubId];
  const rr = act(S, 'negPropose', { package: n.fair });
  assert.ok(rr.ok);
  if (rr.outcome === 'hesitates') act(S, 'negLeanOnClient');
  assert.equal(p.clubId === club.id || S.players[call.playerId].clubId === club.id, true);
  assert.equal(S.deadline.deals, 1);
  // skip to midnight
  let guard = 0;
  while (!S.deadline.ended && guard++ < 10) assert.ok(act(S, 'deadlineSkipHour').ok);
  assert.equal(S.deadline.ended, true);
  assert.equal(act(S, 'deadlineSkipHour').ok, false);
  const fin = act(S, 'deadlineFinish');
  assert.ok(fin.ok);
  assert.equal(fin.events.find(e => e.type === 'deadlineEnd').deals, 1);
  assert.equal(S.deadline, null);
  assert.equal(S.time.phase, 'plan');
  assert.equal(S.flags.deadlineDone, S.time.season + ':' + S.time.month);
  const month = S.time.month;
  const rep = advance(S);
  assert.ok(rep.ok && rep.matchdays !== undefined);
  assert.equal(S.time.month, month + 1);
  assertClean(S);
});

test('Son Gün: negotiations opened from the interest list use the hour; two actions per hour at network L4; midnight collapses open talks', () => {
  const { S, p, clubs } = deadlineSetup();
  S.agency.upgrades.network = 4;
  S.interests.push({ id: 'iD', playerId: p.id, clubId: clubs[0].id, level: 80, kind: 'transfer', cooldown: 0, boost: 0 });
  assert.equal(advance(S).phase, 'deadline');
  assert.equal(S.deadline.actionsLeft, 2);
  assert.ok(act(S, 'openNegotiation', { interestId: 'iD' }).ok);
  assert.equal(S.deadline.actionsLeft, 1);
  assert.equal(S.deadline.hour, 18);
  assert.equal(S.negotiation.deadline !== null, true);
  // pitching needs a free hand
  assert.equal(act(S, 'pitchPlayer', { playerId: p.id, clubId: clubs[1].id }).ok, false, 'table open');
  act(S, 'negWalkAway');
  const e = S.agency.energy;
  const pr = act(S, 'pitchPlayer', { playerId: p.id, clubId: clubs[1].id });
  assert.ok(pr.ok, pr.error);
  assert.equal(S.agency.energy, e, 'pitching on Son Gün costs the hour, not energy');
  assert.equal(S.deadline.hour, 19);
  // open a table and let midnight come: the open talk collapses
  S.deadline.actionsLeft = 1;
  assert.ok(act(S, 'openNegotiation', { interestId: 'iD' }).ok);
  assert.ok(S.negotiation);
  let guard = 0;
  while (!S.deadline.ended && guard++ < 12) deadline.advanceHour(S);
  assert.ok(S.deadline.ended && S.negotiation, 'the table stays open past 23:00 until Son Gün is finished');
  assert.equal(act(S, 'negPropose', { package: S.negotiation.fair }).ok, true, 'a running table can still be played');
  const fin = act(S, 'deadlineFinish');
  if (S.negotiation === null && !fin.events.some(e2 => e2.type === 'negotiationCollapsed')) assert.ok(true);
  else assert.ok(fin.events.some(e2 => e2.type === 'negotiationCollapsed'));
  assert.equal(S.negotiation, null);
});

// ----------------------------------------------------------------------------- scripted agent

/** Reads tells and shaves the fee first; accepts a decent counter; uses the cheapest sensible Koz. */
function negotiate(S, stats) {
  const n0 = S.negotiation;
  const f = n0.fair;
  let pkg = { ...f, fee: Math.round(f.fee * 1.8) };
  const REDUCE = [0.03, 0.08, 0.16, 0.26, 0.38];
  for (let k = 0; k < 14 && S.negotiation; k++) {
    let pv = act(S, 'negPreview', { package: pkg }).preview;
    for (let t = 0; t < 12 && pv.satisfaction < 50 && pkg.wage < S.negotiation.limits.wage[1]; t++) {
      pkg = { ...pkg, wage: Math.round(pkg.wage * 1.04 / 100) * 100 };
      if (t > 4) pkg.clauses = { ...pkg.clauses, minutes: true };
      pv = act(S, 'negPreview', { package: pkg }).preview;
    }
    if (pv.satisfaction < 40) { act(S, 'negWalkAway'); stats.walked++; return; }
    const hand = S.negotiation.hand.filter(h => !h.used && h.id !== 'blof');
    const res = act(S, 'negPropose', { package: pkg, koz: hand.length ? hand[0].id : null });
    if (!res.ok) { pkg = { ...pkg, wage: Math.round(pkg.wage * 1.05 / 100) * 100 }; continue; }
    stats.rounds++;
    if (res.outcome === 'accepted') { stats.deals++; return; }
    if (res.outcome === 'hesitates') { act(S, 'negLeanOnClient'); stats.deals++; return; }
    if (res.outcome === 'left') { stats.left++; return; }
    if (res.counter.clientOk && S.negotiation.round >= 2) { const a = act(S, 'negAcceptCounter'); if (a.ok && a.outcome === 'accepted') { stats.deals++; return; } }
    const lvl = res.tell.level;
    pkg = { ...pkg, fee: Math.round(pkg.fee * (1 - REDUCE[lvl])), bonus: Math.round(pkg.bonus * (1 - REDUCE[lvl] / 3)) };
    if (pkg.fee < f.fee * 0.4) pkg.fee = Math.round(f.fee * 0.4);
  }
  if (S.negotiation) act(S, 'negWalkAway');
}

test('scripted agent: sensible negotiation over 8 seasons × 2 seeds (no NaN, no exceptions, deadline included)', () => {
  for (const seed of [21, 22]) {
    const S = newGame({ seed });
    const stats = { deals: 0, rounds: 0, left: 0, walked: 0, tables: 0 };
    let months = 0;
    while (S.time.phase !== 'over' && months < 96) {
      keepAlive(S);
      S.agency.energy = S.agency.energyMax;
      // build interest the way a player would: pitch clients to clubs that need their position
      for (const c of myClients(S).slice(0, 2)) {
        if (S.agency.energy < 2) break;
        const best = Object.values(S.clubs).filter(k => k.id !== c.clubId && k.needs.some(n => n.pos === c.pos && n.level >= 2))
          .map(k => ({ k, d: act(S, 'pitchPreview', { playerId: c.id, clubId: k.id }).preview.delta })).sort((a, b) => b.d - a.d)[0];
        if (best) act(S, 'pitchPlayer', { playerId: c.id, clubId: best.k.id });
      }
      const cand = interestList(S).filter(i => i.negotiable);
      for (const it of cand.slice(0, 2)) {
        if (!S.interests.includes(it)) continue;
        const r = act(S, 'openNegotiation', { interestId: it.id });
        if (r.ok) { stats.tables++; negotiate(S, stats); }
      }
      const r = advance(S);
      assert.ok(r.ok, r.error);
      if (r.phase === 'deadline') {
        let guard = 0;
        while (S.deadline && !S.deadline.ended && guard++ < 30) {
          const call = deadlineCalls(S).find(c => c.available);
          if (call && !S.negotiation && S.deadline.actionsLeft > 0) {
            const t = act(S, 'deadlineTakeCall', { callId: call.id });
            if (t.ok) { stats.tables++; negotiate(S, stats); continue; }
          }
          if (S.negotiation) act(S, 'negWalkAway');
          act(S, 'deadlineSkipHour');
        }
        assert.ok(act(S, 'deadlineFinish').ok);
        const r2 = advance(S);
        assert.ok(r2.ok, r2.error);
      }
      months++;
      assertClean(S);
      assert.ok(Number.isFinite(S.agency.cash) && Number.isFinite(S.agency.rep));
    }
    assert.ok(stats.tables >= Math.min(8, months / 6), 'tables played: ' + JSON.stringify(stats));
    assert.ok(stats.deals >= Math.min(3, months / 12), 'deals closed: ' + JSON.stringify(stats));
    assert.equal(S.negotiation, null);
    assert.equal(S.agency.stats.deals >= stats.deals, true);
  }
});

// ------------------------------------------------------------------ round 2: a tighter Masa
/** A table at a realistic club (budget of a Süper Lig side, interest 65) instead of the generous fixture above. */
function realistic(seed) {
  const { S, club } = table({ seed, open: false, level: 65 });
  club.budget = BAL.clubBudgetByPrestige[2];
  const r = act(S, 'openNegotiation', { interestId: 'iT' });
  assert.ok(r.ok, r.error);
  const p = S.players[S.negotiation.playerId];
  return { S, p, club };
}

test('the suggested package usually sits above the ceiling; the ceiling varies per persona (noise) and is inferable', () => {
  const ratios = [];
  for (let seed = 1; seed <= 40; seed++) {
    const { S } = realistic(seed);
    ratios.push(K(S) / neg.packageCost(S.negotiation.fair));
  }
  ratios.sort((a, b) => a - b);
  const med = ratios[20];
  assert.ok(med > 0.8 && med < 1.0, 'median K/F ' + med);
  assert.ok(ratios.filter(r => r < 1).length >= 26, 'fair is above K in most tables');
  assert.ok(ratios[35] - ratios[4] > 0.12, 'there is real spread');
  assert.ok(BAL.persona.sabirsiz.noise > BAL.persona.durust.noise && BAL.persona.kurnaz.noise > BAL.persona.durust.noise);
});

test('the client minimum is close to the ceiling: accepting the default is not a win, a Koz or a smaller fee is', () => {
  let tight = 0, n = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const { S, p, club } = realistic(seed);
    const f = S.negotiation.fair;
    // smallest wage (no fee) the client signs at
    let lo = BAL.wage.min, hi = S.negotiation.limits.wage[1];
    const sat = w => neg.satisfaction(S, p, club, 'transfer', { wage: w, years: f.years, bonus: f.bonus, fee: 0, clauses: { minutes: false, release: false } }).value;
    if (sat(hi) < 50) continue;
    for (let i = 0; i < 16; i++) { const mid = Math.round((lo + hi) / 2 / 100) * 100; if (sat(mid) >= 50) hi = mid; else lo = mid; }
    const M = cost({ wage: hi, years: f.years, bonus: f.bonus, fee: 0, clauses: { minutes: false, release: false } });
    n++;
    if (K(S) - M < 0.12 * cost(f)) tight++;
  }
  assert.ok(n >= 20 && tight / n >= 0.6, 'margin for the fee is narrow in most tables: ' + tight + '/' + n);
});

test('counters carry noise (not exactly K·(0.80+0.05·round)) but stay below K', () => {
  const { S } = table({ persona: 'cimri' });
  const k = cost({ ...S.negotiation.fair, fee: 0 }) + 30000; setK(S, k);
  const ratios = [];
  for (let round = 1; round <= 5; round++) {
    const r = act(S, 'negPropose', { package: costing(S, k * 1.3) });
    assert.equal(r.outcome, 'countered');
    assert.ok(r.counter.cost <= k);
    ratios.push(r.counter.cost / k - (0.80 + 0.05 * round));
  }
  assert.ok(ratios.some(x => Math.abs(x) > 0.004), 'noise present: ' + ratios);
});

test('counter-offers never zero the agent fee (floor = max(3% of the counter, €1.500) or the player\'s own lower ask)', () => {
  for (const persona of ['gosterisci', 'kurnaz', 'durust', 'cimri', 'sabirsiz']) {
    const { S } = table({ seed: 5, persona });
    const n = S.negotiation;
    const fee = n.fair.fee;
    // greedy package: far above the ceiling so the club has to cut hard; fee-heavy personas would take it all from the fee
    const pkg = { ...n.fair, wage: n.fair.wage * 2, bonus: n.fair.bonus * 3, fee };
    const r = act(S, 'negPropose', { package: pkg });
    assert.ok(r.ok, r.error);
    if (r.outcome !== 'countered') continue;
    const cp = r.counter.package;
    const floor = Math.min(fee, Math.ceil(BAL.neg.feeFloor.min / 100) * 100);
    assert.ok(cp.fee >= floor, persona + ': fee ' + cp.fee + ' >= floor ' + floor);
    assert.ok(cp.fee > 0, persona);
  }
  // the player asked for zero himself: the counter may keep it at zero
  const { S } = table({ seed: 5, persona: 'gosterisci' });
  const n = S.negotiation;
  const r = act(S, 'negPropose', { package: { ...n.fair, wage: n.fair.wage * 2, bonus: n.fair.bonus * 3, fee: 0 } });
  if (r.outcome === 'countered') assert.equal(r.counter.package.fee, 0);
});
