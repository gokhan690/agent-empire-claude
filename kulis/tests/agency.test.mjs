import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, advance } from '../src/engine/game.js';
import { BAL } from '../src/engine/constants.js';
import * as sel from '../src/engine/selectors.js';
import * as promises from '../src/engine/promises.js';
import * as rivals from '../src/engine/rivals.js';
import * as scouting from '../src/engine/scouting.js';
import * as clients from '../src/engine/clients.js';
import * as objectives from '../src/engine/objectives.js';
import { assertClean } from './helpers.mjs';

function fresh(seed = 5) { const S = newGame({ seed }); S.agency.cash = 1e6; return S; }
/** First unseen unrepresented player of a league. */
function prospect(S, leagueId = 'tr1') {
  return Object.values(S.players).find(p => !p.agentId && !p.seen && S.clubs[p.clubId].leagueId === leagueId);
}
function signed(S, p) { p.agentId = 'you'; p.rep = { commissionPct: 7, endSeason: S.time.season + 2 }; p.seen = true; return p; }

// ------------------------------------------------------------------ scouting
test('scout trip: costs, reveals 3 (4 at L1), know, never reveals twice, band contains pa', () => {
  const S = fresh();
  const pv = act(S, 'tripPreview', { leagueId: 'tr1', focus: 'any' }).preview;
  assert.equal(pv.energy, 1); assert.equal(pv.cash, BAL.scout.travel[2]); assert.equal(pv.count, 3);
  const cash = S.agency.cash, e = S.agency.energy;
  const r = act(S, 'scoutTrip', { leagueId: 'tr1', focus: 'any' });
  assert.ok(r.ok); assert.equal(r.prospects.length, 3);
  assert.equal(S.agency.energy, e - 1); assert.equal(S.agency.cash, cash - pv.cash);
  for (const id of r.prospects) {
    const p = S.players[id];
    assert.ok(p.seen && p.know === BAL.scout.startKnow && p.agentId === null || (p.rep && p.rep.endSeason <= S.time.season));
    assert.equal(S.clubs[p.clubId].leagueId, 'tr1');
  }
  const r2 = act(S, 'scoutTrip', { leagueId: 'tr1', focus: 'u21' });
  assert.ok(r2.ok);
  for (const id of r2.prospects) assert.ok(!r.prospects.includes(id));
  S.agency.upgrades.scout = 1;
  assert.equal(act(S, 'tripPreview', { leagueId: 'tr2', focus: 'any' }).preview.count, 4);
  S.agency.energy = 0;
  assert.equal(act(S, 'scoutTrip', { leagueId: 'tr1', focus: 'any' }).ok, false);
});

test('scout focus filters and early prospects are signable-ish, gems rare', () => {
  const S = fresh(11);
  S.agency.energy = 6;
  const u = act(S, 'scoutTrip', { leagueId: 'tr2', focus: 'u21' });
  for (const id of u.prospects) assert.ok(S.players[id].age <= 21);
  const x = act(S, 'scoutTrip', { leagueId: 'tr2', focus: 'expiring' });
  const exp = x.prospects.filter(id => S.players[id].contractEnd <= S.time.season).length;
  assert.ok(exp >= 2, 'expiring focus ' + exp);
  // quality: median gap between threshold and score for tr2/tr1 trips is small enough for 1-2 promises
  let gaps = [], gems = 0, n = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const T = fresh(seed); T.agency.energy = 6;
    for (const lg of ['tr2', 'tr1', 'tr2']) {
      const t = act(T, 'scoutTrip', { leagueId: lg, focus: 'any' });
      for (const id of t.prospects) {
        const pv = clients.recruitPreview(T, { playerId: id });
        gaps.push(pv.threshold - pv.score); n++;
        const p = T.players[id]; if (p.pa - p.ca >= 14 && p.age <= 21) gems++;
      }
    }
  }
  gaps.sort((a, b) => a - b);
  assert.ok(gaps[Math.floor(gaps.length / 2)] <= 30, 'median gap ' + gaps[Math.floor(gaps.length / 2)]);
  assert.ok(gaps[0] <= 8, 'someone is nearly signable');
  assert.ok(gems / n < 0.4, 'gems rare ' + gems / n);
});

test('potential band always contains pa for every know level; watchPlayer +30 and trait reveal; shortlist', () => {
  const S = fresh();
  for (const id in S.players) {
    const p = S.players[id];
    for (const k of [0, 10, 25, 40, 60, 85, 100]) { p.know = k; const b = sel.potentialBand(S, p); assert.ok(b.lo <= p.pa && b.hi >= p.pa, `${id} k${k} ${b.lo}-${b.hi} pa${p.pa}`); }
  }
  const p = prospect(S); p.seen = true; p.know = 40;
  assert.equal(act(S, 'watchPlayer', { playerId: p.id }).events[0].traitRevealed, true);
  assert.equal(p.know, 70);
  assert.equal(act(S, 'watchPlayer', { playerId: 'nope' }).ok, false);
  assert.ok(act(S, 'toggleShortlist', { playerId: p.id }).ok); assert.equal(p.shortlisted, true);
  act(S, 'toggleShortlist', { playerId: p.id }); assert.equal(p.shortlisted, false);
});

test('scout L3 passive discovery every month', () => {
  const S = fresh();
  S.agency.upgrades.scout = 3;
  const before = Object.values(S.players).filter(p => p.seen).length;
  const ev = scouting.monthly(S);
  assert.equal(ev.length, 1);
  assert.equal(Object.values(S.players).filter(p => p.seen).length, before + 1);
  assert.ok(S.players[ev[0].playerIds[0]].know >= BAL.upgrade.scoutPassiveKnow + 15);
});

// ------------------------------------------------------------------ recruiting
test('recruitPreview is deterministic, pure, and shows promise options', () => {
  const S = fresh();
  const p = prospect(S); p.seen = true; p.know = 30;
  const rng = S.rng, seq = S.seq;
  const a = act(S, 'recruitPreview', { playerId: p.id }).preview;
  const b = act(S, 'recruitPreview', { playerId: p.id }).preview;
  assert.deepEqual(a, b); assert.equal(S.rng, rng); assert.equal(S.seq, seq);
  assert.equal(a.promiseOptions.length, 5);
  for (const o of a.promiseOptions) { assert.ok(o.add > 0 && o.text.length > 10 && o.due.dueSeason >= 1 && o.label); }
  assert.ok(a.parts.length >= 3 && a.cost.energy === 1);
  const withP = act(S, 'recruitPreview', { playerId: p.id, promises: [{ type: 'minutes' }, { type: 'visit' }] }).preview;
  assert.equal(withP.score, a.score + withP.promiseBonus.reduce((s, x) => s + x.value, 0));
  assert.equal(withP.promiseBonus.length, 2);
});

test('recruit: below threshold fails without cost; at threshold signs, creates promises, news', () => {
  const S = fresh();
  const p = prospect(S, 'tr2'); p.seen = true; p.know = 10;
  S.agency.rep = 5;
  const pv = clients.recruitPreview(S, { playerId: p.id });
  const e = S.agency.energy;
  if (pv.score >= pv.threshold) p.hype = 100;
  const bad = act(S, 'recruit', { playerId: p.id });
  assert.equal(bad.ok, false); assert.equal(S.agency.energy, e); assert.equal(p.agentId, null);
  S.agency.rep = 60; p.know = 80;
  const good = clients.recruitPreview(S, { playerId: p.id, promises: [{ type: 'minutes' }, { type: 'stay' }] });
  assert.ok(good.canSign, good.score + '/' + good.threshold);
  const r = act(S, 'recruit', { playerId: p.id, promises: [{ type: 'minutes' }, { type: 'stay' }] });
  assert.ok(r.ok);
  assert.equal(p.agentId, 'you');
  assert.ok(p.rep.commissionPct >= 5 && p.rep.commissionPct <= 10 && p.rep.endSeason === S.time.season + 2);
  assert.equal(p.heat, 0);
  assert.equal(promises.forPlayer(S, p.id).length, 2);
  assert.equal(S.agency.energy, e - 1);
  assert.ok(S.news[0].text.includes(p.name));
  assert.equal(act(S, 'recruit', { playerId: p.id }).ok, false); // already a client
});

test('threshold monotonic in level; rival-held only in last rep season, with higher threshold', () => {
  const S = fresh();
  const p = prospect(S); p.seen = true;
  const t0 = clients.recruitThreshold(S, p);
  p.ca += 10; p.pa += 10;
  assert.ok(clients.recruitThreshold(S, p) > t0);
  const r = S.rivals[0];
  p.agentId = r.id; p.rep = { commissionPct: 7, endSeason: S.time.season + 1 };
  assert.ok(clients.recruitPreview(S, { playerId: p.id }).error);
  S.agency.rep = 100; S.agency.energy = 4;
  assert.equal(act(S, 'recruit', { playerId: p.id }).ok, false);
  p.rep.endSeason = S.time.season;
  const pv = clients.recruitPreview(S, { playerId: p.id });
  assert.ok(!pv.error && pv.rival);
  const base = clients.recruitThreshold(S, { ...p, agentId: null });
  assert.equal(pv.threshold, base + BAL.recruit.thrRival);
});

// ------------------------------------------------------------------ visits, drift, dreams, contracts
test('visitClient: effects, once a month, Turkish line', () => {
  const S = fresh();
  const p = sel.myClients(S)[0];
  p.morale = 50; p.loyalty = 50;
  const e = S.agency.energy;
  const r = act(S, 'visitClient', { playerId: p.id });
  assert.ok(r.ok && typeof r.line === 'string' && r.line.length > 10);
  assert.equal(p.morale, 60); assert.equal(p.loyalty, 58); assert.ok(p.dreamKnown);
  assert.deepEqual(p.lastVisit, { season: 1, month: 0 }); assert.equal(S.agency.energy, e - 1);
  assert.equal(act(S, 'visitClient', { playerId: p.id }).ok, false);
  assert.equal(act(S, 'visitClient', { playerId: 'zzz' }).ok, false);
});

test('release drops client and promises', () => {
  const S = fresh();
  const p = sel.myClients(S)[0];
  promises.add(S, promises.make(S, p, 'stay'));
  assert.ok(act(S, 'releaseClient', { playerId: p.id }).ok);
  assert.equal(p.agentId, null); assert.equal(promises.forPlayer(S, p.id).length, 0);
});

test('monthly drift: benched hirsli unhappy, starter content; neglect erodes loyalty; low loyalty leaves', () => {
  const S = fresh();
  const [a, b] = sel.myClients(S);
  a.trait = 'hirsli'; a.st.sh = 0.05; a.loyalty = 60; a.morale = 60; a.lastVisit = { season: 1, month: 0 };
  b.trait = 'profesyonel'; b.st.sh = 0.95; b.loyalty = 60; b.morale = 60; b.lastVisit = { season: 1, month: 0 };
  clients.monthly(S);
  assert.ok(a.loyalty < 58 && a.morale < 60, `a ${a.loyalty}/${a.morale}`);
  assert.ok(b.morale >= 60 && b.loyalty >= 59, `b ${b.loyalty}/${b.morale}`);
  S.time.month = 9; b.lastVisit = { season: 1, month: 1 };
  const l = b.loyalty; clients.monthly(S);
  assert.ok(b.loyalty < l + 1);
  a.loyalty = 9;
  const ev = clients.monthly(S);
  assert.ok(ev.some(e => e.type === 'clientLeft' && e.playerId === a.id));
  assert.equal(a.agentId, null);
  assert.ok(S.news[0].text.includes(a.name));
});

test('dream fulfilment: loyalty +30, rep +4, stats.dreams, news', () => {
  const S = fresh();
  const p = sel.myClients(S)[0];
  p.dream = { type: 'star', target: 85, done: false }; p.ca = 86; p.loyalty = 40; p.trait = 'profesyonel'; p.st.sh = 0.8; p.lastVisit = { season: 1, month: 0 };
  const rep = S.agency.rep;
  const ev = clients.monthly(S);
  assert.ok(ev.some(e => e.type === 'dream'));
  assert.ok(p.dream.done && S.agency.stats.dreams === 1 && Math.abs(S.agency.rep - (rep + 4 * Math.max(BAL.rep.floor, 1 - rep / BAL.rep.decay))) < 1e-9);
  assert.ok(p.loyalty >= 65);
  p.dream = { type: 'big_wage', target: 5000, done: false }; p.wage = 6000;
  clients.monthly(S); assert.equal(S.agency.stats.dreams, 2);
  p.dream = { type: 'top_league', target: 5, done: false };
  const top = Object.values(S.clubs).find(c => S.leagues[c.leagueId].prestige === 5);
  p.clubId = top.id; clients.monthly(S); assert.equal(S.agency.stats.dreams, 3);
});

test('rep contract at season end: auto renew when loyal, inbox card otherwise, lapse when ignored', () => {
  const S = fresh();
  const [a, b] = sel.myClients(S);
  S.time.month = 11; a.rep.endSeason = 1; b.rep.endSeason = 1; a.loyalty = 90; b.loyalty = 40; a.lastVisit = b.lastVisit = { season: 1, month: 11 };
  const ev = clients.monthly(S);
  assert.equal(a.rep.endSeason, 3);
  assert.ok(ev.some(e => e.type === 'repRenewed' && e.auto));
  const card = S.inbox.find(c => c.key === 'repend:' + b.id);
  assert.ok(card && card.options.length === 3 && card.options.every(o => Array.isArray(o.effects)));
  // answering "bonus": effects include a renew flag handled next month
  const opt = card.options[0];
  S.flags.seen['renew:' + b.id] = true;
  S.time.season = 2; S.time.month = 0; S.inbox = [];
  clients.monthly(S);
  assert.equal(b.rep.endSeason, 4); assert.equal(b.agentId, 'you');
  // ignored → lapses
  b.rep.endSeason = 1;
  clients.monthly(S);
  assert.equal(b.agentId, null);
  assert.ok(opt.cost.cash > 0);
});

// ------------------------------------------------------------------ promises
function setupPromise(S, type, patch = {}) {
  const p = signed(S, Object.values(S.players).find(q => !q.agentId && q.clubId && S.leagues[S.clubs[q.clubId].leagueId].prestige === 2));
  p.loyalty = 60; p.morale = 60; p.trait = 'profesyonel';
  const spec = promises.make(S, p, type);
  const pr = promises.add(S, { ...spec, ...patch });
  return { p, pr };
}
function dueNow(S, pr) { S.time.season = pr.dueSeason; S.time.month = pr.dueMonth; }
function topClub(S, prestige) { return Object.values(S.clubs).find(c => S.leagues[c.leagueId].prestige === prestige); }

for (const type of ['minutes', 'transfer_up', 'wage', 'stay', 'visit']) {
  test(`promise ${type}: kept`, () => {
    const S = fresh();
    const { p, pr } = setupPromise(S, type);
    assert.ok(pr.text.length > 10);
    const rep = S.agency.rep;
    let loy = p.loyalty;
    if (type === 'minutes') { dueNow(S, pr); S.leagues[S.clubs[p.clubId].leagueId].matchday = 18; p.st.mins = 18 * 90 * 0.8; }
    if (type === 'transfer_up') p.clubId = topClub(S, 3).id;
    if (type === 'wage') p.wage = pr.target + 100;
    if (type === 'stay') dueNow(S, pr);
    if (type === 'visit') { act(S, 'visitClient', { playerId: p.id }); S.time.month = 7; p.lastVisit = null; act(S, 'visitClient', { playerId: p.id }); dueNow(S, pr); loy = p.loyalty; }
    const out = promises.check(S);
    assert.equal(out.length, 1, JSON.stringify(out));
    assert.equal(out[0].status, 'kept'); assert.equal(pr.status, 'kept');
    assert.equal(p.loyalty, loy + 15); assert.ok(Math.abs(S.agency.rep - (rep + 2 * Math.max(BAL.rep.floor, 1 - rep / BAL.rep.decay))) < 1e-9); assert.equal(S.agency.stats.promisesKept, 1);
    assert.equal(promises.forPlayer(S, p.id).length, 0);
  });
  test(`promise ${type}: broken`, () => {
    const S = fresh();
    const { p, pr } = setupPromise(S, type);
    const rep = S.agency.rep, loy = p.loyalty;
    if (type === 'minutes') { dueNow(S, pr); S.leagues[S.clubs[p.clubId].leagueId].matchday = 18; p.st.mins = 18 * 90 * 0.2; }
    if (type === 'transfer_up') dueNow(S, pr);
    if (type === 'wage') dueNow(S, pr);
    if (type === 'stay') p.clubId = topClub(S, 3).id;
    if (type === 'visit') dueNow(S, pr);
    const out = promises.check(S);
    assert.equal(out[0].status, 'broken');
    assert.equal(p.loyalty, loy - 25); assert.equal(S.agency.rep, rep - 3); assert.equal(S.agency.stats.promisesBroken, 1);
    assert.equal(p.agentId, 'you'); // profesyonel does not walk out
  });
}

test('broken promise: hirsli / yildiz client walks out when loyalty collapses; others stay', () => {
  for (const [trait, leaves] of [['hirsli', true], ['yildiz', true], ['sadik', false]]) {
    const S = fresh();
    const { p, pr } = setupPromise(S, 'stay');
    p.trait = trait; p.loyalty = 40; p.clubId = topClub(S, 3).id;
    const out = promises.check(S);
    assert.equal(out.some(e => e.type === 'walkout'), leaves, trait);
    assert.equal(p.agentId === null, leaves);
  }
});

test('promise on a lost client is voided; minutes progress exposed', () => {
  const S = fresh();
  const { p, pr } = setupPromise(S, 'minutes');
  const prog = promises.progressOf(S, pr);
  assert.ok(prog.text.length > 3 && prog.target === 50);
  p.agentId = null;
  assert.deepEqual(promises.check(S), []);
  assert.equal(S.promises.includes(pr), false);
});

// ------------------------------------------------------------------ upgrades
test('upgrade preview/buy: costs, upkeep, energy', () => {
  const S = fresh(); S.agency.cash = 2e7;
  const pv = act(S, 'upgradePreview', { branch: 'network' }).preview;
  assert.equal(pv.level, 0); assert.equal(pv.nextLevel, 1); assert.equal(pv.cost, BAL.upgrade.cost.network[0]);
  assert.equal(pv.upkeepDelta, BAL.econ.upkeepUpgrade[1]); assert.ok(pv.text.length > 3);
  const up0 = sel.officeUpkeep(S), cash = S.agency.cash;
  assert.ok(act(S, 'buyUpgrade', { branch: 'network' }).ok);
  assert.equal(S.agency.cash, cash - pv.cost);
  assert.equal(S.agency.energyMax, 5); assert.equal(S.agency.energy, 5);
  assert.equal(sel.officeUpkeep(S), up0 + BAL.econ.upkeepUpgrade[1]);
  assert.equal(sel.upg(S, 'network'), 1);
  act(S, 'buyUpgrade', { branch: 'network' });
  act(S, 'buyUpgrade', { branch: 'network' });
  assert.equal(S.agency.energyMax, 6);
  act(S, 'buyUpgrade', { branch: 'network' });
  assert.equal(sel.upg(S, 'network'), 4);
  assert.equal(act(S, 'buyUpgrade', { branch: 'network' }).ok, false);
  S.agency.cash = 0;
  assert.equal(act(S, 'buyUpgrade', { branch: 'scout' }).ok, false);
  assert.equal(act(S, 'buyUpgrade', { branch: 'xx' }).ok, false);
  const fx = sel.upgradeEffects(S);
  assert.equal(fx.deadlineActionsPerHour, 2); assert.equal(fx.lunchTrust, 15); assert.ok(fx.loyaltyDecayMult < 1);
});

test('upgrades are read: scout L2 know, L4 heat slower on shortlist, network L2 slower loyalty decay', () => {
  const S = fresh();
  S.agency.energy = 6;
  S.agency.upgrades.scout = 2;
  const t = act(S, 'scoutTrip', { leagueId: 'tr2', focus: 'any' });
  for (const id of t.prospects) assert.equal(S.players[id].know, BAL.scout.startKnow + 15);
  const [a, b] = t.prospects.map(id => S.players[id]);
  a.agentId = b.agentId = null; a.heat = b.heat = 0; b.shortlisted = true;
  const base = rivals.heatPerMonth(S, b);
  S.agency.upgrades.scout = 4;
  assert.ok(rivals.heatPerMonth(S, b) < base * 0.8);
  b.shortlisted = false;
  assert.equal(rivals.heatPerMonth(S, b), base); // not shortlisted: unchanged
  // network L2
  const c = sel.myClients(S)[0]; c.lastVisit = { season: 1, month: 0 }; c.st.sh = c.st.sh;
  const mk = lvl => { const T = fresh(); T.agency.upgrades.network = lvl; const x = sel.myClients(T)[0]; x.lastVisit = null; x.loyalty = 60; x.morale = 60; x.st.sh = 0.5; x.trait = 'profesyonel'; x.wage = 1e9; clients.monthly(T); return x.loyalty; };
  assert.ok(mk(2) > mk(0));
});

// ------------------------------------------------------------------ rivals
test('heat rises monthly; obvious talent & akademisyen U21 faster; at 100 a rival signs him (news + move)', () => {
  const S = fresh();
  const cands = Object.values(S.players).filter(p => !p.agentId && p.clubId);
  const y = cands.find(p => p.age <= 20); y.seen = true; y.heat = 0;
  const lo = cands.find(p => p.age >= 28 && p.ca < 45); lo.seen = true; lo.heat = 0;
  assert.ok(rivals.heatPerMonth(S, y) > rivals.heatPerMonth(S, lo));
  rivals.monthly(S);
  assert.ok(y.heat > 0 && lo.heat > 0 && y.heat > lo.heat);
  y.heat = 99.9;
  const moves = rivals.monthly(S);
  assert.ok(y.agentId && y.agentId.startsWith('r'), 'signed by ' + y.agentId);
  assert.equal(y.heat, 0);
  assert.ok(y.rep && y.rep.endSeason > S.time.season);
  const mv = moves.find(m => m.playerId === y.id);
  assert.ok(mv && mv.rivalId === y.agentId && mv.text.length > 5);
  assert.ok(S.news.some(n => n.playerId === y.id));
  assert.equal(S.ranking.length, 5);
});

test('rivals: portfolios evolve, rep and cash stay sane, ranking sorted', () => {
  const S = fresh();
  const size = id => Object.values(S.players).filter(p => p.agentId === id).length;
  const before = S.rivals.map(r => size(r.id));
  for (let i = 0; i < 12; i++) rivals.monthly(S);
  const after = S.rivals.map(r => size(r.id));
  assert.notDeepEqual(before, after);
  for (const r of S.rivals) { assert.ok(r.rep >= 5 && r.rep <= 95 && Number.isFinite(r.cash) && r.cash >= BAL.rivalAI.cashFloor); }
  for (let i = 1; i < 5; i++) assert.ok(S.ranking[i - 1].score >= S.ranking[i].score);
});

test('poaching: low-loyalty client gets an approach card with 3 options; letting go moves him to the rival', () => {
  const S = fresh();
  const p = sel.myClients(S)[0];
  p.loyalty = 20;
  let card = null;
  for (let i = 0; i < 20 && !card; i++) { rivals.monthly(S); card = S.inbox.find(c => c.key === 'poach:' + p.id); }
  assert.ok(card, 'approach card');
  assert.equal(card.options.length, 3);
  assert.ok(card.options.every(o => o.id && o.label && o.cost && Array.isArray(o.effects)));
  assert.ok(card.options.find(o => o.id === 'bonus').cost.cash > 0);
  const rid = S.flags.poach[p.id].rid;
  // let go: apply the option's effect by hand (answerInbox lives in events.js)
  p.agentId = null; p.rep = null; S.inbox = S.inbox.filter(c => c !== card);
  rivals.monthly(S);
  assert.equal(p.agentId, rid);
});

test('poaching: answered with loyalty bonus -> client stays; ignored -> he leaves', () => {
  const S = fresh();
  const [p, q] = sel.myClients(S);
  p.loyalty = 20; q.loyalty = 90;
  for (let i = 0; i < 20 && !(S.flags.poach && S.flags.poach[p.id]); i++) rivals.monthly(S);
  assert.ok(S.flags.poach[p.id]);
  const card = S.inbox.find(c => c.key === 'poach:' + p.id);
  p.loyalty += 25; S.inbox = S.inbox.filter(c => c !== card);
  rivals.monthly(S);
  assert.equal(p.agentId, 'you'); assert.ok(!S.flags.poach[p.id]);
  S.flags.poachCool = {}; p.loyalty = 5;
  for (let i = 0; i < 20 && !S.flags.poach[p.id]; i++) rivals.monthly(S);
  S.inbox = S.inbox.filter(c => c.key !== 'poach:' + p.id);
  rivals.monthly(S);
  assert.equal(p.agentId === 'you', false);
});

// ------------------------------------------------------------------ objectives
test('objectives: 3 offers (safe/balanced/bold), >= 9 templates, choose, complete -> reward, fail at season end', () => {
  assert.ok(objectives.OBJECTIVE_KINDS.length >= 9);
  const S = fresh();
  const o = S.objectives.offered;
  assert.deepEqual(o.map(x => x.tier), ['safe', 'balanced', 'bold']);
  assert.equal(new Set(o.map(x => x.kind)).size, 3);
  for (const x of o) assert.ok(x.title && x.text && x.target > 0 && x.reward.cash > 0 && x.reward.rep > 0);
  assert.equal(act(S, 'chooseObjective', { objectiveId: 'zzz' }).ok, false);
  const pick = o.find(x => x.kind === 'rep') || o[0];
  assert.ok(act(S, 'chooseObjective', { objectiveId: pick.id }).ok);
  assert.equal(S.objectives.offered.length, 0);
  assert.equal(act(S, 'chooseObjective', { objectiveId: o[1].id }).ok, false);
  const st = objectives.status(S);
  assert.ok(st && st.target === pick.target && st.progress >= 0 && st.pct >= 0 && st.pct <= 1);
  // force completion by kind
  const A = S.agency;
  const force = { rep: () => { A.rep = pick.target; }, commission: () => { A.stats.commission += pick.target; }, clients: () => { while (sel.myClients(S).length < pick.target) signed(S, prospect(S)); },
    signYouth: () => { for (let i = 0; i < pick.target; i++) { const p = signed(S, Object.values(S.players).find(q => !q.agentId && q.age <= 21)); p.signed = { season: 1, month: 0, idx: sel.monthIndex(S) }; } },
    cash: () => { A.cash = pick.target + 1; }, bestCa: () => { sel.myClients(S)[0].ca = pick.target; }, portfolio: () => { sel.myClients(S)[0].value = pick.target; },
    discover: () => { let n = 0; for (const p of Object.values(S.players)) { if (n++ >= pick.target) break; p.seenAt = sel.monthIndex(S); } } }[pick.kind];
  if (force) {
    force();
    const cash = A.cash, rep = A.rep;
    const ev = objectives.check(S);
    assert.equal(ev[0].status, 'done');
    assert.ok(A.cash >= cash + pick.reward.cash - 1 && A.rep >= Math.min(100, rep + pick.reward.rep) - 1e-9 || pick.kind === 'rep');
    assert.equal(S.objectives.active, null);
    assert.equal(S.objectives.history[0].result, 'done');
  }
  // failure at season end
  const S2 = fresh();
  const hard = S2.objectives.offered[2];
  act(S2, 'chooseObjective', { objectiveId: hard.id });
  S2.time.month = 5; assert.deepEqual(objectives.check(S2), []);
  S2.time.month = 11;
  const ev2 = objectives.check(S2);
  assert.equal(ev2[0].status, 'failed');
  assert.equal(S2.objectives.history[0].result, 'failed'); assert.equal(S2.objectives.active, null);
});

test('objectives: cleanSlate fails on a broken promise; every template makes sense for several seeds', () => {
  const S = fresh();
  const T = objectives.TEMPLATES;
  for (const seed of [1, 2, 3]) {
    const X = fresh(seed);
    for (const k of objectives.OBJECTIVE_KINDS) for (const tier of T[k].tiers) {
      const m = T[k].make(X, tier);
      if (!m) continue;
      assert.ok(Number.isFinite(m.target) && m.target > 0 && m.title.length > 5, k);
      assert.ok(Number.isFinite(T[k].progress(X, { base: { commission: 0, kept: 0, broken: 0, dreams: 0, idx: 0 }, target: m.target })), k);
    }
  }
  S.objectives.offered = [{ id: 'oX', tier: 'safe', kind: 'cleanSlate', title: 't', text: 't', target: 1, reward: { cash: 1000, rep: 1 } }];
  act(S, 'chooseObjective', { objectiveId: 'oX' });
  S.agency.stats.promisesBroken++;
  assert.equal(objectives.check(S)[0].status, 'failed');
});

test('newSeason offer: advance through season end re-offers objectives', () => {
  const S = fresh();
  for (let i = 0; i < 12; i++) {
    S.agency.cash = 1e6;
    let r = advance(S);
    if (r.phase === 'deadline') { S.time.phase = 'plan'; S.flags.deadlineDone = S.time.season + ':' + S.time.month; r = advance(S); }
    assert.ok(r.ok, r.error);
    for (const c of S.inbox) c.must = false;
  }
  assert.equal(S.time.season, 2);
  assert.equal(S.objectives.offered.length, 3);
});

// ------------------------------------------------------------------ scripted agent, 3 seeds x 8 seasons
for (const seed of [1, 2, 3]) {
  test('scripted agent plays 8 seasons (scout/recruit/visit every month), seed ' + seed, () => {
    const S = newGame({ seed });
    let maxClients = 0, recruited = 0, answered = 0;
    for (let m = 0; m < 96 && S.time.phase !== 'over'; m++) {
      S.agency.cash = Math.max(S.agency.cash, 2e6);
      if (S.time.phase === 'deadline') { S.time.phase = 'plan'; S.flags.deadlineDone = S.time.season + ':' + S.time.month; }
      // answer cards (events.js may or may not be implemented; fall back to dropping non-must cards)
      for (const c of S.inbox.slice()) {
        const r = act(S, 'answerInbox', { inboxId: c.id, optionId: c.options[0] && c.options[0].id });
        if (r.ok) answered++; else if (!c.must) S.inbox = S.inbox.filter(x => x !== c);
      }
      for (const o of S.objectives.offered.slice(0, 1)) act(S, 'chooseObjective', { objectiveId: o.id });
      // visit the least loyal clients
      const mine = sel.myClients(S).sort((a, b) => a.loyalty - b.loyalty);
      for (const p of mine.slice(0, 2)) if (S.agency.energy > 2) act(S, 'visitClient', { playerId: p.id });
      // scout and recruit
      const lg = ['tr2', 'tr1', 'tr2', 'nl1'][m % 4];
      if (S.agency.energy > 0) act(S, 'scoutTrip', { leagueId: lg, focus: ['any', 'u21', 'expiring', 'form'][m % 4] });
      const seen = Object.values(S.players).filter(p => p.seen && sel.isRecruitable(S, p));
      let best = null;
      for (const p of seen) {
        const prom = [{ type: 'minutes' }, { type: 'visit' }];
        const pv = clients.recruitPreview(S, { playerId: p.id, promises: prom });
        if (pv.canSign && (!best || pv.score - pv.threshold < best.gap)) best = { p, gap: pv.score - pv.threshold, prom };
      }
      if (best && S.agency.energy > 0 && sel.myClients(S).length < 25) { if (act(S, 'recruit', { playerId: best.p.id, promises: best.prom }).ok) recruited++; }
      if (S.agency.energy > 0 && seen.length) act(S, 'watchPlayer', { playerId: seen[m % seen.length].id });
      if (m % 7 === 3) act(S, 'buyUpgrade', { branch: ['scout', 'table', 'network'][(m / 7 | 0) % 3] });
      const r = advance(S);
      assert.ok(r.ok, r.error);
      assertClean(S);
      const n = sel.myClients(S).length;
      maxClients = Math.max(maxClients, n);
      assert.ok(n <= 60, 'clients ' + n);
      for (const p of Object.values(S.players)) { assert.ok(p.heat >= 0 && p.heat <= 100); assert.ok(!p.agentId || p.rep, 'agent without contract ' + p.id); }
      assert.equal(S.ranking.length, 5);
    }
    assert.ok(recruited >= 4, 'recruited ' + recruited);
    assert.ok(maxClients >= 5, 'max clients ' + maxClients);
    for (const pr of S.promises) assert.ok(pr.status !== 'open' || (S.players[pr.playerId] && S.players[pr.playerId].agentId === 'you'));
  });
}

// ------------------------------------------------------------------ round 2: promises are about what you can keep
test('promise assess: stay only for players who want to stay, transfer_up not at the top, minutes only for starters', () => {
  const S = fresh();
  const { p } = setupPromise(S, 'visit');
  p.st.sh = 0.8; p.trait = 'profesyonel';
  assert.equal(promises.assess(S, p, 'stay').keepable, true);
  p.st.sh = 0.1;
  const st = promises.assess(S, p, 'stay');
  assert.equal(st.blocked, true); assert.match(st.note, /kalmak istemiyor/);
  p.clubId = topClub(S, 5).id;
  const up = promises.assess(S, p, 'transfer_up');
  assert.equal(up.blocked, true); assert.match(up.note, /en üst/);
  // preview exposes it (new optional fields) and refuses a blocked choice with the same text
  const q = Object.values(S.players).find(x => !x.agentId && x.clubId && !x.seen && S.clubs[x.clubId].leagueId === 'tr1');
  q.seen = true; q.know = 80; q.st.sh = 0.05; q.trait = 'profesyonel';
  const pv = clients.recruitPreview(S, { playerId: q.id, promises: [{ type: 'stay' }] });
  const o = pv.promiseOptions.find(x => x.type === 'stay');
  assert.equal(o.blocked, true); assert.equal(o.keepable, false); assert.equal(o.fit, false); assert.ok(o.warning.length > 5);
  assert.equal(pv.canSign, false); assert.equal(pv.error, o.warning);
  assert.equal(clients.recruit(S, { playerId: q.id, promises: [{ type: 'stay' }] }).ok, false);
});

test('promise minutes: the window restarts after a transfer you arranged to a club with more minutes', () => {
  const S = fresh();
  const { p, pr } = setupPromise(S, 'minutes');
  S.time.month = 8;
  p.st.mins = 400; S.leagues[S.clubs[p.clubId].leagueId].matchday = 10;
  const before = pr.from;
  promises.onMove(S, p, 0.22, 0.88, true);
  assert.notEqual(pr.from, before); assert.ok(pr.restarted && pr.restarted.month === 8);
  assert.equal(pr.from.mins, 400); assert.equal(pr.from.md, S.leagues[S.clubs[p.clubId].leagueId].matchday);
  const keep = pr.from;
  promises.onMove(S, p, 0.88, 0.22, true); // a move to fewer minutes does not restart anything
  assert.equal(pr.from, keep);
});

test('promise stay: a transfer you arrange breaks it, a forced move voids it, and an open stay promise blocks transfer tables', () => {
  const S = fresh();
  const { p, pr } = setupPromise(S, 'stay');
  const club = Object.values(S.clubs).find(c => c.id !== p.clubId && c.leagueId === S.clubs[p.clubId].leagueId);
  S.time.month = 1; p.contractEnd = S.time.season + 2;
  const it = { id: 'iStay', playerId: p.id, clubId: club.id, level: 80, kind: 'transfer', cooldown: 0, boost: 0 };
  S.interests.push(it);
  const row = sel.interestList(S, p.id).find(i => i.id === 'iStay');
  assert.equal(row.negotiable, false); assert.match(row.reason, /kalma sözün/);
  assert.equal(act(S, 'openNegotiation', { interestId: 'iStay' }).ok, false);
  promises.onMove(S, p, 0.5, 0.5, false);
  assert.equal(S.promises.includes(pr), false, 'forced move: void, not broken');
  const S2 = fresh();
  const b = setupPromise(S2, 'stay');
  promises.onMove(S2, b.p, 0.5, 0.5, true);
  assert.equal(b.pr.moved, true);
  const out = promises.check(S2);
  assert.equal(out[0].status, 'broken');
});

test('promise cards only offer a keepable type; negPreview lists promise checks', () => {
  const S = fresh();
  const { p } = setupPromise(S, 'visit');
  p.trait = 'paraci'; p.contractEnd = S.time.season + 3; p.st.sh = 0.9;
  assert.notEqual(promises.suggest(S, p), 'wage');
  p.contractEnd = S.time.season;
  assert.equal(promises.suggest(S, p), 'wage');
  const wp = promises.add(S, promises.make(S, p, 'wage'));
  const chk = promises.checksFor(S, p, { wage: 100, years: 3, bonus: 0, fee: 0 });
  assert.equal(chk.length, 1); assert.equal(chk[0].ok, false);
  assert.equal(promises.checksFor(S, p, { wage: wp.target, years: 3, bonus: 0, fee: 0 })[0].ok, true);
});

// ------------------------------------------------------------------ round 2: scouting, rivals, league stability
test('potential band is wide when you barely know him and narrows with watching; the truth stays inside', () => {
  const S = fresh();
  let widths = [];
  for (const know of [10, 40, 70, 100]) {
    const gaps = [];
    for (const p of Object.values(S.players).slice(0, 200)) {
      p.know = know;
      const b = sel.potentialBand(S, p);
      assert.ok(b.lo <= p.pa && p.pa <= b.hi, 'band contains pa');
      gaps.push(b.hi - b.lo);
    }
    widths.push(gaps.reduce((a, x) => a + x, 0) / gaps.length);
  }
  assert.ok(widths[0] > 30 && widths[0] > widths[1] && widths[1] > widths[2] && widths[2] > widths[3], JSON.stringify(widths));
  assert.ok(widths[3] <= 3);
});

test('rivals hold a capped number of stars; the cap keeps the best players recruitable', () => {
  const S = newGame({ seed: 17 });
  const elite = rivals.isElite;
  for (let i = 0; i < 40; i++) { S.time.month = (S.time.month + 1) % 12; rivals.monthly(S); }
  for (const r of S.rivals) {
    const n = Object.values(S.players).filter(p => p.agentId === r.id && elite(p)).length;
    assert.ok(n <= BAL.rivals.find(x => x.id === r.id).eliteCap + 8, r.id + ' holds ' + n);
  }
});
