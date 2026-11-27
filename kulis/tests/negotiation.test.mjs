import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, serialize, deserialize, advance } from '../src/engine/game.js';
import * as sel from '../src/engine/selectors.js';
import { BAL } from '../src/engine/constants.js';
import { packageCost, acceptHint } from '../src/engine/negotiation.js';
import { myClients } from './../src/engine/selectors.js';

/** A game with an open table (one pitch → one offer → open). */
function tableGame(seed = 5, skipFirst = false) {
  const S = newGame({ seed });
  if (skipFirst) S.flags.firstTableDone = true;
  S.agency.energy = 9;
  for (const p of sel.clientList(S)) {
    const o = sel.pitchOptions(S, p.id, 40).find(x => x.fit === 'İlgilenir');
    if (!o) continue;
    assert.ok(act(S, 'pitchPlayer', { playerId: p.id, clubId: o.clubId }).ok);
    const offer = sel.offerList(S, p.id)[0];
    assert.ok(offer, 'pitch to an interested club makes an offer');
    const r = act(S, 'openNegotiation', { interestId: offer.id });
    assert.ok(r.ok, r.error);
    return S;
  }
  throw new Error('no client has an interested club');
}

test('table: fair package fills years and bonus; only wage and fee are required', () => {
  const S = tableGame(5);
  const n = S.negotiation;
  assert.equal(n.patienceMax, BAL.neg.rounds);
  assert.equal(n.patienceMax, 3);
  assert.ok(n.minWage > 0 && n.limits.wage[0] === n.minWage && n.limits.wage[1] > n.minWage);
  const r = act(S, 'negPreview', { package: { wage: n.fair.wage, fee: n.fair.fee } });
  assert.ok(r.ok && ['Yüksek', 'Orta', 'Düşük'].includes(r.preview.hint));
  assert.equal(r.preview.cost, n.fair.wage * 12 * n.years + n.bonus + n.fair.fee, 'years and bonus default to the club suggestion');
  const v = sel.negotiationView(S);
  assert.ok(!('hidden' in v) && !JSON.stringify(v).includes('"K"'));
  assert.ok(!('hand' in v) && !('clauses' in n.fair), 'no Koz, no clauses');
});

test('the player refuses a wage below his minimum, bad numbers are refused with Turkish text', () => {
  const S = tableGame(5);
  const n = S.negotiation;
  for (const pkg of [{ wage: n.minWage - 100, fee: 0 }, { wage: NaN, fee: 0 }, { wage: n.fair.wage, fee: -1 }, { wage: n.limits.wage[1] + 100, fee: 0 }, null]) {
    const r = act(S, 'negPropose', { package: pkg });
    assert.equal(r.ok, false); assert.equal(typeof r.error, 'string');
  }
  assert.equal(S.negotiation.round, 0, 'invalid offers cost nothing');
});

test('hint is honest: Yüksek is always accepted, Düşük always refused, and the ceiling is not on the wire', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const S = tableGame(seed);
    const n = S.negotiation, K = n.hidden.K;
    const hi = Math.max(0, Math.floor((K * 0.95 - n.minWage * 12 * n.years - n.bonus) / 100) * 100);
    const low = { wage: n.minWage, fee: hi };
    const pv = act(S, 'negPreview', { package: low }).preview;
    assert.equal(pv.hint, 'Yüksek', 'seed ' + seed);
    assert.ok(packageCost({ ...low, years: n.years, bonus: n.bonus }) <= K);
    const over = { wage: n.minWage, fee: Math.min(n.limits.fee[1], Math.ceil((K * 1.2 - n.minWage * 12 * n.years - n.bonus) / 100) * 100) };
    const pv2 = act(S, 'negPreview', { package: over }).preview;
    if (packageCost({ ...over, years: n.years, bonus: n.bonus }) > K * 1.1) assert.equal(pv2.hint, 'Düşük');
    const r = act(S, 'negPropose', { package: over });
    assert.ok(r.ok);
    if (pv2.hint === 'Düşük') assert.notEqual(r.outcome, 'accepted');
  }
  assert.equal(acceptHint(90, 100), 'Yüksek'); assert.equal(acceptHint(100, 100), 'Orta'); assert.equal(acceptHint(120, 100), 'Düşük');
});

test('every table can be closed: counters are affordable, never below the wage floor, and at most 3 rounds', () => {
  for (let seed = 1; seed <= 15; seed++) {
    const S = tableGame(seed, true);
    const n = S.negotiation;
    const K = n.hidden.K;
    let rounds = 0, last = null;
    while (S.negotiation && rounds < 6) {
      const r = act(S, 'negPropose', { package: { wage: n.limits.wage[1], fee: n.limits.fee[1] } });
      assert.ok(r.ok, r.error);
      rounds++; last = r;
      if (r.outcome === 'countered') {
        assert.ok(r.counter.cost <= K + 1, 'counter within the ceiling');
        assert.ok(r.counter.package.wage >= n.minWage);
        assert.ok(r.tell && ['smile', 'neutral', 'frown', 'angry', 'stand'].includes(r.tell.face) && r.tell.line.length < 80);
        assert.ok(r.line.length > 0);
      }
    }
    assert.ok(rounds <= 3, 'hard cap 3 rounds');
    assert.equal(last.outcome, 'left');
    assert.equal(S.negotiation, null);
    const it = S.interests.find(i => i.id === n.interestId);
    assert.equal(it.cooldown, BAL.neg.leave.cooldown);
  }
  // …and accepting the first counter always closes the deal
  for (let seed = 1; seed <= 15; seed++) {
    const S = tableGame(seed, true);
    const n = S.negotiation;
    const r = act(S, 'negPropose', { package: { wage: n.limits.wage[1], fee: n.limits.fee[1] } });
    assert.equal(r.outcome, 'countered');
    const a = act(S, 'negAcceptCounter');
    assert.ok(a.ok && a.outcome === 'accepted', a.error);
    assert.ok(a.events.some(e => e.type === 'dealDone'));
  }
});

test('a fair offer at the minimum wage closes at once; commission is paid and the client moves', () => {
  const S = tableGame(5);
  const n = S.negotiation;
  const pid = n.playerId, cash0 = S.agency.cash;
  const r = act(S, 'negPropose', { package: { wage: n.minWage, fee: n.fair.fee } });
  assert.equal(r.outcome, 'accepted', 'the first table is meant to be won');
  const d = r.events.find(e => e.type === 'dealDone');
  assert.equal(d.commission, n.fair.fee);
  assert.equal(S.agency.cash, cash0 + n.fair.fee);
  assert.equal(S.players[pid].clubId, n.clubId);
  assert.equal(S.players[pid].wage, n.minWage);
  assert.equal(S.negotiation, null);
  assert.equal(S.agency.stats.deals, 1);
  assert.ok(!('promises' in S));
});

test('opening a table costs exactly 1 energy and fails without it', () => {
  const S = tableGame(5);
  assert.equal(S.agency.energy, 7, "9 - pitch - table");
  act(S, 'negWalkAway');
  S.agency.energy = 0;
  const it = S.interests.find(i => i.level >= 60);
  const r = act(S, 'openNegotiation', { interestId: it.id });
  assert.equal(r.ok, false);
  assert.equal(S.agency.energy, 0);
});

test('save/restore mid-table is lossless and advance is blocked while a table is open', () => {
  const S = tableGame(5);
  const S2 = deserialize(serialize(S));
  assert.deepEqual(S2.negotiation, S.negotiation);
  assert.equal(advance(S).ok, false);
  const n = S2.negotiation;
  const a = act(S, 'negPropose', { package: { wage: n.minWage, fee: n.fair.fee } });
  const b = act(S2, 'negPropose', { package: { wage: n.minWage, fee: n.fair.fee } });
  assert.equal(a.outcome, b.outcome);
});

test('greedy commission annoys the client; a generous wage cheers him up', () => {
  const S = tableGame(5, true);
  const n = S.negotiation;
  const pid = n.playerId;
  const mood0 = S.players[pid].mood;
  // find a fee that is accepted yet above the greedy share
  const K = n.hidden.K;
  const base = n.minWage * 12 * n.years + n.bonus;
  const fee = Math.floor((K - base) / 100) * 100;
  const share = fee / (base + fee);
  const r = act(S, 'negPropose', { package: { wage: n.minWage, fee } });
  assert.equal(r.outcome, 'accepted');
  if (share > BAL.neg.greedyShare) assert.ok(r.events.some(e => e.type === 'feeNoticed'));
  assert.ok(S.players[pid].mood !== mood0);
});

test('the first table of a career is always winnable at the minimum wage with the fair commission', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const S = tableGame(seed);
    const n = S.negotiation;
    assert.equal(n.first, true);
    const r = act(S, 'negPropose', { package: { wage: n.minWage, fee: n.fair.fee } });
    assert.equal(r.outcome, 'accepted', 'seed ' + seed);
  }
});
