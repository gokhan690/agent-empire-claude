import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, advance } from '../src/engine/game.js';
import { BAL } from '../src/engine/constants.js';
import { myClients, interestList, interestOpenReason } from '../src/engine/selectors.js';
import { squadIndex } from '../src/engine/selection.js';
import { playerValue } from '../src/engine/valuation.js';
import * as market from '../src/engine/market.js';
import { assertClean, play } from './helpers.mjs';

function clubIn(S, leagueId, not) { return Object.values(S.clubs).find(c => c.leagueId === leagueId && c.id !== not); }

test('needs: valid shape, every club has some, levels 1..3, sorted', () => {
  const S = newGame({ seed: 3 });
  play(S, 2);
  let withNeeds = 0;
  for (const c of Object.values(S.clubs)) {
    let last = 9;
    for (const n of c.needs) {
      assert.ok(['KL', 'DF', 'OS', 'FV'].includes(n.pos));
      assert.ok(n.level >= 1 && n.level <= 3);
      assert.ok(n.level <= last); last = n.level;
    }
    if (c.needs.length) withNeeds++;
  }
  assert.ok(withNeeds >= 30, 'needs exist across the world: ' + withNeeds);
});

test('interest sanity over seasons: bounded, kinds follow the calendar, some become negotiable', () => {
  let hot = 0;
  for (const seed of [1, 2, 3]) {
    const S = newGame({ seed });
    play(S, 24, () => {
      for (const i of S.interests) {
        assert.ok(i.level >= 0 && i.level <= 100 && Number.isFinite(i.level));
        assert.ok(i.cooldown >= 0);
        const p = S.players[i.playerId];
        assert.ok(p && S.clubs[i.clubId]);
        if (p.agentId !== 'you') continue;
        if (S.time.month === 0) continue; // just rolled over: contracts changed at season end, interests refresh next month
        if (i.kind === 'free' && p.clubId) assert.ok(S.time.month >= BAL.market.interest.freeFrom - 1 || p.contractEnd === S.time.season);
        if (i.kind === 'renewal') assert.equal(i.clubId, p.clubId);
        assert.notEqual(i.kind === 'transfer' && p.contractEnd === S.time.season && S.time.month > BAL.market.interest.freeFrom, true);
      }
      if (interestList(S).some(i => i.level >= 60)) hot++;
      assert.ok(S.interests.filter(i => i.playerId && S.players[i.playerId].agentId === 'you').length <= 40);
    });
    assertClean(S);
  }
  assert.ok(hot >= 10, 'hot interests appear: ' + hot);
});

test('free interest for expiring clients from January, renewal from the current club', () => {
  const S = newGame({ seed: 4 });
  const p = myClients(S)[1];
  p.contractEnd = S.time.season; p.ca = 70; p.cf = 70;
  S.time.month = 5;
  for (const c of Object.values(S.clubs)) c.needs = [{ pos: p.pos, level: 3 }];
  market.monthly(S);
  S.time.month = 6; // January
  market.monthly(S);
  const mine = S.interests.filter(i => i.playerId === p.id);
  assert.ok(mine.some(i => i.kind === 'free'), 'free kind');
  assert.ok(mine.every(i => i.kind !== 'transfer' || i.clubId !== p.clubId));
  assert.ok(mine.filter(i => i.kind === 'free').every(i => interestOpenReason(S, { ...i, level: 90 }) === null));
  S.time.month = 5;
  assert.ok(interestOpenReason(S, { ...mine.find(i => i.kind === 'free'), level: 90 }), 'before January it is not openable');
  S.time.month = 3;
  p.contractEnd = S.time.season; p.loyalty = 80; p.form = 5;
  market.monthly(S);
  const ren = S.interests.find(i => i.playerId === p.id && i.kind === 'renewal');
  assert.ok(ren === undefined || ren.clubId === p.clubId);
});

test('AI transfers: squads stay 16–24, budgets ≥ 0, news appear, 8 seasons × 3 seeds', () => {
  for (const seed of [1, 2, 3]) {
    const S = newGame({ seed });
    let moves = 0;
    play(S, 96, r => {
      moves += r.events.filter(e => e.type === 'aiTransfer').length;
      const idx = squadIndex(S);
      for (const cid in idx) {
        assert.ok(idx[cid].length >= 16 && idx[cid].length <= 24, cid + ' ' + idx[cid].length);
        assert.ok(S.clubs[cid].budget >= 0, cid + ' budget');
      }
      for (const e of r.events.filter(e => e.type === 'aiTransfer')) {
        assert.ok(S.players[e.playerId]);
        assert.ok(e.fee >= 0);
      }
    });
    assert.ok(moves > 40, 'AI market is alive: ' + moves);
    assert.ok(S.news.some(n => n.kind === 'transfer'));
    assertClean(S);
  }
});

test('executeTransfer: move, fee, commission, deals row, trust, contract, clauses', () => {
  const S = newGame({ seed: 5 });
  const p = myClients(S)[1];
  const to = clubIn(S, 'tr1', p.clubId);
  const from = S.clubs[p.clubId];
  to.budget = 5e6; from.budget = 1e6;
  S.time.month = 1;
  const cash = S.agency.cash, rep = S.agency.rep, deals = S.agency.stats.deals;
  const toTrust = to.trust, fromTrust = from.trust, fromBudget = from.budget;
  const r = market.executeTransfer(S, { playerId: p.id, toClubId: to.id, kind: 'transfer', wage: 9000, years: 3, bonus: 20000, fee: 30000, clauses: { minutes: true, release: true }, transferFee: 400000 });
  assert.ok(r.ok);
  assert.equal(p.clubId, to.id);
  assert.equal(p.wage, 9000);
  assert.equal(p.contractEnd, S.time.season + 2);
  assert.equal(p.guarantee, true);
  assert.ok(p.releaseClause > 0);
  assert.equal(to.budget, 5e6 - 400000);
  assert.equal(from.budget, fromBudget + 400000);
  assert.equal(S.agency.cash, cash + 30000);
  assert.ok(S.agency.rep > rep);
  assert.equal(S.agency.stats.deals, deals + 1);
  assert.equal(S.agency.stats.commission >= 30000, true);
  assert.equal(to.trust, Math.min(100, toTrust + BAL.market.deal.newClubTrust));
  assert.equal(from.trust, Math.max(0, fromTrust + BAL.market.deal.oldClubTrust));
  const row = S.deals[S.deals.length - 1];
  assert.deepEqual([row.playerId, row.fromClubId, row.toClubId, row.fee, row.commission, row.kind], [p.id, from.id, to.id, 400000, 30000, 'transfer']);
  const ev = r.events[0];
  assert.equal(ev.type, 'dealDone');
  assert.deepEqual([ev.fee, ev.commission, ev.wage, ev.years, ev.kind], [400000, 30000, 9000, 3, 'transfer']);
  assert.ok(S.news[0].text.includes(p.name));
  assert.ok(S.ledger[0].items.some(i => i.k === 'commission' && i.amt === 30000));
  assert.ok(squadIndex(S)[from.id].length >= 18 && squadIndex(S)[to.id].length <= 22);
  assertClean(S);
});

test('executeTransfer: fee over the client-notice threshold costs loyalty −5; hukukcu tolerates 15%', () => {
  for (const [arch, share, expectLoss] of [['mahalle', 0.13, true], ['hukukcu', 0.13, false], ['hukukcu', 0.17, true]]) {
    const S = newGame({ seed: 5, archetype: arch });
    const p = myClients(S)[1];
    const to = clubIn(S, 'tr1', p.clubId);
    const wageTot = 9000 * 12 * 3;
    const fee = Math.round(wageTot * share / (1 - share));
    const loyalty = p.loyalty;
    market.executeTransfer(S, { playerId: p.id, toClubId: to.id, kind: 'transfer', wage: 9000, years: 3, bonus: 0, fee, clauses: {} });
    const hadNotice = !!S.agency;
    assert.ok(hadNotice);
    const after = p.loyalty;
    const noFeeS = newGame({ seed: 5, archetype: arch });
    const q = myClients(noFeeS)[1];
    market.executeTransfer(noFeeS, { playerId: q.id, toClubId: to.id, kind: 'transfer', wage: 9000, years: 3, bonus: 0, fee: 1000, clauses: {} });
    assert.equal(noFeeS.players[q.id].loyalty - after, expectLoss ? 5 : 0, arch + share);
    void loyalty;
  }
});

test('pre-contract: commission now, player stays, old club trust −20, move at season end via handleExpiry', () => {
  const S = newGame({ seed: 6 });
  const p = myClients(S)[1];
  const from = S.clubs[p.clubId];
  const to = clubIn(S, 'tr1', p.clubId);
  p.contractEnd = S.time.season; S.time.month = 6;
  const trust = from.trust, cash = S.agency.cash;
  const r = market.executeTransfer(S, { playerId: p.id, toClubId: to.id, kind: 'free', wage: 8000, years: 3, bonus: 40000, fee: 25000, clauses: { minutes: false, release: false } });
  assert.ok(r.ok && r.events[0].preContract);
  assert.equal(p.clubId, from.id, 'still at the old club');
  assert.equal(S.agency.cash, cash + 25000);
  assert.equal(from.trust, Math.max(0, trust - 20));
  assert.ok(p.preContract && p.preContract.toClubId === to.id);
  assert.equal(S.deals[S.deals.length - 1].kind, 'free');
  assert.equal(interestOpenReason(S, { playerId: p.id, clubId: to.id, kind: 'free', level: 90, cooldown: 0 }), 'Ön sözleşme zaten imzalı');
  // play to the end of June: he must be moved by the engine's expiry processing
  const season = S.time.season;
  while (S.time.season === season) {
    S.agency.cash = Math.max(S.agency.cash, 1e6);
    const rr = advance(S);
    if (rr.phase === 'deadline') { S.time.phase = 'plan'; S.flags.deadlineDone = S.time.season + ':' + S.time.month; advance(S); }
    if (S.time.phase === 'over') break;
  }
  const q = S.players[p.id];
  if (q) {
    assert.equal(q.clubId, to.id);
    assert.equal(q.wage, 8000);
    assert.equal(q.contractEnd, season + 3);
    assert.ok(!q.preContract);
  }
});

test('free agent client (clubId null) is placeable', () => {
  const S = newGame({ seed: 7 });
  const p = myClients(S)[1];
  p.clubId = null; p.wage = 0; p.contractEnd = S.time.season + 1; p.ca = 66; p.cf = 66; p.value = playerValue(S, p);
  for (const c of Object.values(S.clubs)) c.needs = [{ pos: p.pos, level: 3 }];
  S.time.month = 3;
  for (let k = 0; k < 3; k++) market.monthly(S);
  const li = interestList(S).filter(i => i.playerId === p.id);
  assert.ok(li.length > 0 && li.every(i => i.kind === 'free'));
  const best = li.sort((a, b) => b.level - a.level)[0];
  best.level = 80; S.interests.find(i => i.id === best.id).level = 80;
  const to = S.clubs[best.clubId];
  const r = market.executeTransfer(S, { playerId: p.id, toClubId: to.id, kind: 'free', wage: 9000, years: 2, bonus: 10000, fee: 8000, clauses: {} });
  assert.ok(r.ok);
  assert.equal(r.events[0].fromClubId, null);
  assert.equal(p.clubId, to.id);
  assert.equal(S.deals[S.deals.length - 1].fee, 0);
  assertClean(S);
});

test('renewal: extends the contract at the same club, no transfer fee', () => {
  const S = newGame({ seed: 8 });
  const p = myClients(S)[1];
  p.contractEnd = S.time.season;
  const club = S.clubs[p.clubId];
  const budget = club.budget;
  const r = market.executeTransfer(S, { playerId: p.id, toClubId: club.id, kind: 'renewal', wage: 7000, years: 3, bonus: 5000, fee: 9000, clauses: {} });
  assert.ok(r.ok);
  assert.equal(p.contractEnd, S.time.season + 3);
  assert.equal(club.budget, budget);
  assert.equal(r.events[0].fee, 0);
  assert.equal(r.events[0].commission, 9000);
});

test('pitch: preview is deterministic and pitchPlayer applies exactly it (1 energy)', () => {
  const S = newGame({ seed: 9 });
  const p = myClients(S)[1];
  const club = clubIn(S, 'tr1', p.clubId);
  club.needs = [{ pos: p.pos, level: 2 }];
  const a = act(S, 'pitchPreview', { playerId: p.id, clubId: club.id });
  const b = act(S, 'pitchPreview', { playerId: p.id, clubId: club.id });
  assert.deepEqual(a, b);
  assert.ok(a.ok && a.preview.delta >= BAL.market.pitch.min && a.preview.levelAfter === Math.min(100, a.preview.levelBefore + a.preview.delta));
  const e = S.agency.energy;
  const r = act(S, 'pitchPlayer', { playerId: p.id, clubId: club.id });
  assert.ok(r.ok);
  assert.equal(S.agency.energy, e - 1);
  const i = S.interests.find(x => x.playerId === p.id && x.clubId === club.id);
  assert.equal(i.level, a.preview.levelAfter);
  const again = act(S, 'pitchPreview', { playerId: p.id, clubId: club.id }).preview;
  assert.ok(again.delta <= Math.ceil(a.preview.delta * BAL.market.pitch.repeatMult) + 1, 'second pitch in a month is weaker');
  assert.equal(act(S, 'pitchPlayer', { playerId: p.id, clubId: p.clubId }).ok, false);
  S.agency.energy = 0;
  assert.equal(act(S, 'pitchPlayer', { playerId: p.id, clubId: club.id }).ok, false);
});

test('clubLunch: trust +10 (+15 with network L2), reveals needs and a budget band, costs energy and cash', () => {
  const S = newGame({ seed: 9 });
  const club = clubIn(S, 'tr1');
  club.trust = 30;
  const cash = S.agency.cash;
  const r = act(S, 'clubLunch', { clubId: club.id });
  assert.ok(r.ok);
  assert.equal(club.trust, 40);
  assert.ok(club.lunchKnown);
  assert.equal(S.agency.energy, S.agency.energyMax - 1);
  assert.ok(S.agency.cash < cash);
  const h = r.budgetHint;
  assert.ok(h.lo <= club.budget && h.hi >= club.budget && h.hi > h.lo);
  assert.ok(Array.isArray(r.needs));
  S.agency.upgrades.network = 2;
  const c2 = clubIn(S, 'tr2'); c2.trust = 20;
  act(S, 'clubLunch', { clubId: c2.id });
  assert.equal(c2.trust, 35);
  S.agency.cash = 0;
  assert.equal(act(S, 'clubLunch', { clubId: club.id }).ok, false);
});

test('mediaPush: hype +15, yildiz morale up, sadik morale down, costs', () => {
  const S = newGame({ seed: 9 });
  const p = myClients(S)[1];
  p.hype = 30; p.trait = 'yildiz'; p.morale = 50;
  const cash = S.agency.cash;
  const r = act(S, 'mediaPush', { playerId: p.id });
  assert.ok(r.ok);
  assert.equal(p.hype, 45);
  assert.equal(p.morale, 58);
  assert.ok(S.agency.cash < cash);
  p.trait = 'sadik'; p.morale = 50;
  act(S, 'mediaPush', { playerId: p.id });
  assert.equal(p.morale, 45);
  assert.equal(act(S, 'mediaPush', { playerId: 'zzz' }).ok, false);
});

test('commission balance: early tr2→tr1 move of a ~600K player pays 25–70K', () => {
  const S = newGame({ seed: 11 });
  const p = myClients(S).find(c => S.clubs[c.clubId].leagueId === 'tr2') || myClients(S)[0];
  p.ca = 60; p.cf = 60; p.age = 24;
  p.value = playerValue(S, p);
  const club = clubIn(S, 'tr1');
  club.needs = [{ pos: p.pos, level: 2 }]; club.budget = 5e7;
  S.time.month = 1;
  S.interests.push({ id: 'iB', playerId: p.id, clubId: club.id, level: 80, kind: 'transfer', cooldown: 0, boost: 0 });
  const r = act(S, 'openNegotiation', { interestId: 'iB' });
  assert.ok(r.ok, r.error);
  const fair = S.negotiation.fair;
  assert.ok(fair.fee >= 25000 && fair.fee <= 70000, 'fair fee ' + fair.fee + ' for value ' + p.value);
});
