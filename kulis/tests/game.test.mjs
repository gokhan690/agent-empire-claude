import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, advance, serialize, deserialize, ACTION_IDS } from '../src/engine/game.js';
import * as sel from '../src/engine/selectors.js';
import { BAL, MONTHS } from '../src/engine/constants.js';
import { assertClean, play } from './helpers.mjs';

const S0 = () => newGame({ seed: 7 });

test('simplified rules: 5 seasons, 4 energy, six upgrades, no promises/traits/dreams/koz/deadline/archetypes', () => {
  const S = S0();
  assert.equal(BAL.careerSeasons, 5);
  assert.equal(S.meta.careerSeasons, 5);
  assert.ok(S.agency.energyMax === 3 || S.agency.energyMax === 4);
  assert.ok(BAL.upgrades.length <= 6);
  for (const k of ['promises', 'objectives', 'deadline']) assert.ok(!(k in S), k + ' must be gone');
  for (const id of ['clubLunch', 'mediaPush', 'visitClient', 'scoutTrip', 'recruit', 'chooseObjective', 'deadlineTakeCall', 'negLeanOnClient']) assert.ok(!ACTION_IDS.includes(id), id);
  assert.ok(!MONTHS.some(m => 'deadline' in m || 'window' in m));
  assert.equal(S.time.phase, 'plan');
});

test('Oyuncu ara: 1 energy, 3 candidates (4 with Gözlemci ağı), no focus, stars', () => {
  const S = S0();
  const e0 = S.agency.energy;
  const r = act(S, 'searchPlayers', { leagueId: 'en1', focus: 'u21' });
  assert.ok(r.ok);
  assert.equal(S.agency.energy, e0 - 1);
  const list = sel.candidateList(S);
  assert.equal(list.length, 3);
  for (const c of list) {
    assert.ok(c.stars >= 1 && c.stars <= 5 && c.potential.lo >= 1 && c.potential.hi <= 5 && !c.potential.exact && c.potential.hi > c.potential.lo);
    assert.ok(c.pos && c.age && c.clubName);
    assert.equal(c.watched, false);
  }
  S.agency.upgrades.scouts = true;
  S.agency.energy = 4;
  assert.ok(act(S, 'searchPlayers').ok);
  assert.equal(S.found.length, Math.min(BAL.scout.foundMax, 3 + 4), 'the list keeps the newest candidates (max ' + BAL.scout.foundMax + ')');
  assert.equal(sel.candidateList(S).length, S.found.length);
  S.agency.energy = 0;
  const f = act(S, 'searchPlayers');
  assert.equal(f.ok, false); assert.equal(typeof f.error, 'string');
});

test('İzle: 1 energy, potential becomes exact and stays inside the old range', () => {
  const S = S0();
  act(S, 'searchPlayers');
  const c = sel.candidateList(S)[0];
  const e0 = S.agency.energy;
  assert.ok(act(S, 'watchPlayer', { playerId: c.id }).ok);
  assert.equal(S.agency.energy, e0 - 1);
  const w = sel.candidateList(S).find(x => x.id === c.id);
  assert.ok(w.watched && w.potential.exact && w.potential.lo === w.potential.hi);
  assert.ok(w.potential.lo >= c.potential.lo && w.potential.lo <= c.potential.hi);
  assert.equal(act(S, 'watchPlayer', { playerId: c.id }).ok, false);
});

test('signing: 1 energy, gated by reputation, candidate leaves the list', () => {
  const S = S0();
  S.agency.energy = 4;
  let signed = null;
  for (let i = 0; i < 4 && !signed; i++) { act(S, 'searchPlayers'); signed = sel.candidateList(S).find(c => c.canSign); S.agency.energy = Math.max(S.agency.energy, 3); }
  assert.ok(signed, 'a signable candidate exists at start rep');
  const e0 = S.agency.energy;
  assert.ok(act(S, 'signPlayer', { playerId: signed.id }).ok);
  assert.equal(S.agency.energy, e0 - 1);
  assert.equal(S.players[signed.id].agentId, 'you');
  assert.ok(!sel.candidateList(S).some(c => c.id === signed.id));
  // a star needs reputation
  const star = Object.values(S.players).find(p => !p.agentId && p.ca >= 80);
  S.found.push(star.id); star.seen = true;
  const r = act(S, 'signPlayer', { playerId: star.id });
  assert.equal(r.ok, false); assert.match(r.error, /İtibar/);
  S.agency.rep = 90;
  assert.ok(act(S, 'signPlayer', { playerId: star.id }).ok);
});

test('Kulübe öner: 1 energy; an interested club makes an offer at once, a cold one does not', () => {
  const S = S0();
  const p = sel.clientList(S)[0];
  const opts = sel.pitchOptions(S, p.id, 60);
  assert.ok(opts.some(o => o.fit === 'İlgilenir'), 'every start client has an interested club');
  const hot = opts.find(o => o.fit === 'İlgilenir'), cold = opts.find(o => o.fit === 'Zor');
  const e0 = S.agency.energy;
  const r = act(S, 'pitchPlayer', { playerId: p.id, clubId: hot.clubId });
  assert.ok(r.ok && r.offer);
  assert.equal(S.agency.energy, e0 - 1);
  assert.ok(sel.offerList(S, p.id).some(o => o.clubId === hot.clubId));
  const r2 = act(S, 'pitchPlayer', { playerId: p.id, clubId: cold.clubId });
  assert.ok(r2.ok && !r2.offer);
  assert.ok(!sel.offerList(S, p.id).some(o => o.clubId === cold.clubId));
  assert.equal(act(S, 'pitchPlayer', { playerId: p.id, clubId: p.id }).ok, false);
});

test('events: at most one card per month, ≤ 2 choices, ≤ 2 short sentences, free option, answerable', () => {
  const S = S0();
  let seen = 0;
  play(S, 40, (r) => {
    assert.ok(S.inbox.length <= 1);
    const c = S.inbox[0];
    if (!c) return;
    seen++;
    assert.ok(c.options.length >= 1 && c.options.length <= 2, c.key);
    assert.ok(c.options.some(o => !o.cost.cash && !o.cost.energy) || c.options.length === 1, 'free option ' + c.key);
    const sentences = c.body.split(/[.!?]/).filter(x => x.trim()).length;
    assert.ok(sentences <= 2 && c.body.length <= 110, c.key + ': ' + c.body);
    assert.ok(!/\{|\}/.test(c.body + c.title), 'unfilled placeholder in ' + c.key);
    S.agency.energy = 4;
    const free = c.options.find(o => !o.cost.cash && !o.cost.energy) || c.options[0];
    const a = act(S, 'answerInbox', { inboxId: c.id, optionId: free.id });
    assert.ok(a.ok, a.error);
    assert.ok(a.resultText && a.resultText.length < 90 && !/\{|\}/.test(a.resultText));
    assert.equal(S.inbox.length, 0);
  });
  assert.ok(seen >= 10, 'cards appear regularly: ' + seen);
});

test('goal: exactly one auto-assigned goal per season, no picking', () => {
  const S = S0();
  assert.ok(S.goal && S.goal.status === 'active');
  assert.equal(sel.hubSummary(S).goal.title, S.goal.title);
  const t0 = S.goal.title;
  play(S, 12);
  assert.equal(S.time.season, 2);
  assert.ok(S.goal.season === 2 && S.goal.status === 'active' && S.goal.title !== t0);
  assert.equal(act(S, 'chooseObjective', {}).ok, false);
});

test('guide: at most 3 cards, advances with the real actions, can be skipped', () => {
  const S = S0();
  const steps = [];
  const g = () => sel.hubSummary(S).guide;
  steps.push(g().step);
  act(S, 'searchPlayers');
  steps.push(g().step);
  const p = sel.clientList(S)[0];
  act(S, 'pitchPlayer', { playerId: p.id, clubId: sel.pitchOptions(S, p.id).find(o => o.fit === 'İlgilenir').clubId });
  steps.push(g().step);
  assert.deepEqual(steps, ['search', 'pitch', 'deal']);
  assert.equal(g().total, 3);
  assert.ok(g().text.length < 110);
  const o = sel.offerList(S)[0];
  act(S, 'openNegotiation', { interestId: o.id });
  act(S, 'negPropose', { package: { wage: S.negotiation.minWage, fee: S.negotiation.fair.fee } });
  assert.equal(g(), null);
  const T = S0(); assert.ok(act(T, 'skipGuide').ok); assert.equal(sel.hubSummary(T).guide, null);
});

test('upgrades: one flat list of ≤ 6 with price and one-line text; buying works once', () => {
  const S = S0();
  const list = sel.agencyView(S).upgrades;
  assert.ok(list.length >= 4 && list.length <= 6);
  for (const u of list) assert.ok(u.name && u.text.length < 60 && u.price > 0 && u.owned === false);
  S.agency.cash = 1e6;
  const e0 = S.agency.energyMax;
  assert.ok(act(S, 'buyUpgrade', { upgradeId: 'office' }).ok);
  assert.equal(S.agency.energyMax, e0 + 1);
  assert.equal(S.agency.energy, S.agency.energyMax);
  assert.equal(act(S, 'buyUpgrade', { upgradeId: 'office' }).ok, false);
  S.agency.cash = 10;
  assert.equal(act(S, 'buyUpgrade', { upgradeId: 'lawyer' }).ok, false);
  S.agency.cash = 1e6;
  const m0 = sel.monthlyCommission(S);
  act(S, 'buyUpgrade', { upgradeId: 'lawyer' });
  assert.ok(sel.monthlyCommission(S) > m0);
});

test('every action costs exactly 1 energy; failed actions cost nothing', () => {
  const S = S0();
  S.agency.energy = 4;
  const p = sel.clientList(S)[0];
  const club = sel.pitchOptions(S, p.id)[0].clubId;
  const e = () => S.agency.energy;
  let before = e(); act(S, 'searchPlayers'); assert.equal(before - e(), 1);
  before = e(); act(S, 'pitchPlayer', { playerId: p.id, clubId: club }); assert.equal(before - e(), 1);
  before = e(); act(S, 'watchPlayer', { playerId: 'nope' }); assert.equal(before - e(), 0);
  before = e(); act(S, 'signPlayer', { playerId: 'nope' }); assert.equal(before - e(), 0);
});

test('month report and save: a whole career plays, state stays clean, save round-trips', () => {
  const S = S0();
  let last;
  play(S, 12, (r) => { last = r; assertClean(S); assert.ok(r.finance && Array.isArray(r.clients) && Array.isArray(r.news)); });
  const J = serialize(S);
  assert.ok(J.length < 900000);
  const S2 = deserialize(J);
  assert.deepEqual(S2, S);
  assert.equal(S.time.season, 2);
  assert.ok(S.history.length === 1);
  assert.ok(last.seasonEnd && last.seasonEnd.champions);
  assert.throws(() => deserialize(JSON.stringify({ v: 1, players: {}, clubs: {} })));
});

test('career ends after season 5 with a ranking ending; endless continues', () => {
  const S = S0();
  const r = play(S, 60);
  assert.equal(S.time.phase, 'over');
  assert.ok(r.ending && ['efsane', 'buyuk', 'saygin', 'siradan'].includes(r.ending.kind), r.ending && r.ending.kind);
  assert.equal(S.history.length, 5);
  assert.ok(S.ending.epilogues.length <= BAL.ending.epilogueMax);
  assert.ok(S.ending.stats.every(x => !/söz|hayal/i.test(x.label)));
  assert.equal(act(S, 'searchPlayers').ok, false);
  assert.ok(act(S, 'continueEndless').ok);
  assert.equal(S.time.phase, 'plan');
  assert.ok(play(S, 12).ok);
});

test('bankruptcy after 3 negative month ends; loan offered once as a card', () => {
  const S = S0();
  S.agency.cash = -500000;
  const r1 = advance(S);
  assert.ok(r1.events.some(e => e.type === 'loanOffer'));
  assert.ok(S.inbox.some(c => c.key === 'loan'), 'the bank card appears');
  const loan = S.inbox.find(c => c.key === 'loan');
  S.agency.cash = -500000;
  assert.ok(act(S, 'answerInbox', { inboxId: loan.id, optionId: 'al' }).ok);
  assert.ok(S.agency.loan);
  const S2 = S0(); S2.agency.cash = -900000;
  let r; for (let i = 0; i < 3; i++) { r = advance(S2); S2.agency.cash = Math.min(S2.agency.cash, -900000); if (r.ending) break; }
  assert.equal(r.ending.kind, 'iflas');
  assert.equal(S2.time.phase, 'over');
  assert.equal(act(S2, 'continueEndless').ok, false);
});

test('no clients: warning, then the career ends', () => {
  const S = S0();
  for (const p of sel.myClients(S)) p.agentId = null;
  S.agency.cash = 5e6;
  let r, n = 0;
  do { r = advance(S); n++; } while (!r.ending && n < 6);
  assert.equal(r.ending.kind, 'yalniz');
  assert.equal(n, BAL.econ.noClientMonthsEnd);
});

test('rivals may snipe candidates you leave alone (no meters)', () => {
  const S = S0();
  let sniped = 0;
  for (let t = 0; t < 40; t++) {
    S.agency.cash = 5e6; S.agency.energy = 4;
    act(S, 'searchPlayers');
    const r = advance(S);
    sniped += r.rivalMoves.filter(m => m.sniped).length;
    if (S.time.phase === 'over') break;
  }
  assert.ok(sniped >= 1, 'rivals took at least one waiting candidate');
});

test('determinism: same seed and same actions give the same state', () => {
  const run = () => { const S = newGame({ seed: 21 }); for (let i = 0; i < 14; i++) { S.agency.cash = 5e6; act(S, 'searchPlayers'); const c = sel.candidateList(S).find(x => x.canSign); if (c) act(S, 'signPlayer', { playerId: c.id }); advance(S); } return serialize(S); };
  assert.equal(run(), run());
});
