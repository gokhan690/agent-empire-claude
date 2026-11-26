// Cross-module flows: tutorial → first deal, deadline day, pre-contract, season end, endings, save round-trips,
// upgrade/archetype effects, free agents, UI views, API hygiene. (Seed sweeps live in `npm run sim`.)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newGame, act, advance, serialize, deserialize, ACTION_IDS } from '../src/engine/game.js';
import * as sel from '../src/engine/selectors.js';
import { BAL } from '../src/engine/constants.js';
import { assertClean, play, keepAlive } from './helpers.mjs';
import { runCareer } from '../tools/bot.mjs';

const mine = S => sel.myClients(S);
function clearInbox(S) { S.inbox = S.inbox.filter(c => c.key && c.key.startsWith('tut_')); }

/** Sign whatever the fair package says (client must be happy: raise the wage a little for the player's sake). */
function dealAtFair(S) {
  const n = sel.negotiationView(S);
  const pkg = { ...n.fair, wage: Math.round(n.fair.wage * 1.1 / 100) * 100 };
  const c = pkg.wage * 12 * pkg.years + pkg.bonus + pkg.fee;
  S.negotiation.hidden.K = Math.max(S.negotiation.hidden.K, c * 1.2); // the real ceiling is tight (see BAL.neg.gen); this helper only needs "a deal"
  let r = act(S, 'negPropose', { package: pkg });
  for (let i = 0; i < 6 && r.ok && r.outcome === 'countered'; i++) r = act(S, 'negAcceptCounter');
  assert.ok(r.ok, r.error);
  if (r.outcome === 'hesitates') { const l = act(S, 'negLeanOnClient'); assert.ok(l.ok); return l; }
  assert.equal(r.outcome, 'accepted');
  return r;
}

test('tutorial: visit → scout → lunch → first suitor → first Masa in the first month', () => {
  const S = newGame({ seed: 11 });
  assert.ok(S.inbox.some(c => c.key === 'tut_welcome'));
  assert.equal(sel.hubSummary(S).tutorialStep, 'welcome');
  const welcome = S.inbox.find(c => c.key === 'tut_welcome');
  assert.ok(act(S, 'answerInbox', { inboxId: welcome.id, optionId: welcome.options[0].id }).ok);
  assert.equal(sel.hubSummary(S).tutorialStep, 'visit');
  const gem = mine(S).sort((a, b) => a.age - b.age)[0];
  assert.ok(act(S, 'visitClient', { playerId: gem.id }).ok);
  assert.equal(sel.hubSummary(S).tutorialStep, 'scout');
  assert.ok(act(S, 'scoutTrip', { leagueId: 'tr2', focus: 'u21' }).ok);
  assert.equal(sel.hubSummary(S).tutorialStep, 'market');
  const club = Object.values(S.clubs).find(c => c.leagueId === 'tr1');
  assert.ok(act(S, 'clubLunch', { clubId: club.id }).ok);
  assert.equal(sel.hubSummary(S).tutorialStep, 'interest');
  const il = sel.interestList(S).filter(i => i.negotiable && i.level >= BAL.neg.minLevel);
  assert.ok(il.length >= 1, 'a guaranteed suitor exists after the market step');
  assert.ok(S.inbox.some(c => c.key === 'tut_interest'));
  assert.equal(S.agency.energy, 1);
  const r = act(S, 'openNegotiation', { interestId: il[0].id });
  assert.ok(r.ok, r.error);
  assert.equal(S.clubs[il[0].clubId].director.persona, 'durust', 'the first director reads honestly');
  const before = S.agency.stats.deals;
  dealAtFair(S);
  assert.equal(S.agency.stats.deals, before + 1, 'first deal done in month 1');
  assert.equal(S.negotiation, null);
  assertClean(S);
  const rep = advance(S);
  assert.ok(rep.ok);
  assert.ok(S.inbox.length <= BAL.events.inboxCap);
});

test('tutorial can be skipped and never blocks Ayı Oynat', () => {
  const S = newGame({ seed: 12 });
  const w = S.inbox.find(c => c.key === 'tut_welcome');
  const skip = w.options.find(o => o.id === 'skip');
  if (skip) assert.ok(act(S, 'answerInbox', { inboxId: w.id, optionId: 'skip' }).ok);
  assert.equal(sel.advanceBlock(S), null);
  assert.ok(advance(S).ok);
});

function deadlineState(seed = 21) {
  const S = newGame({ seed });
  S.flags.tutorial.done = true; S.inbox = [];
  S.agency.cash = 2e6;
  S.time.month = 1; // Ağustos
  const p = mine(S).sort((a, b) => b.ca - a.ca)[0];
  const club = Object.values(S.clubs).find(c => c.id !== p.clubId && c.leagueId === S.clubs[p.clubId].leagueId);
  S.interests = [{ id: 'iDL', playerId: p.id, clubId: club.id, level: 80, kind: 'transfer', cooldown: 0, boost: 0 }];
  return { S, p, club };
}

test('Son Gün: advance → phase deadline → table → deadlineFinish → advance continues', () => {
  const { S, p, club } = deadlineState();
  const r = advance(S);
  assert.equal(r.phase, 'deadline');
  assert.equal(S.time.phase, 'deadline');
  assert.equal(advance(S).ok, false, 'cannot advance while Son Gün runs');
  const dv = sel.deadlineView(S);
  assert.ok(dv && dv.hour === 18 && dv.actionsLeft >= 1);
  assert.equal(act(S, 'scoutTrip', { leagueId: 'tr1', focus: 'any' }).ok, false, 'energy actions are closed on Son Gün');
  const o = act(S, 'openNegotiation', { interestId: 'iDL' });
  assert.ok(o.ok, o.error);
  assert.equal(S.agency.energy, S.agency.energyMax, 'Son Gün tables cost the hour, not energy');
  // mid-deadline save round trip with the table open
  const json = serialize(S);
  const S2 = deserialize(json);
  assert.deepEqual(S2, JSON.parse(JSON.stringify(S)));
  for (const X of [S, S2]) { dealAtFair(X); }
  assert.equal(serialize(S), serialize(S2), 'identical continuation after load');
  assert.equal(S.players[p.id].clubId, club.id);
  while (S.deadline && !S.deadline.ended) assert.ok(act(S, 'deadlineSkipHour').ok);
  assert.ok(act(S, 'deadlineFinish').ok);
  assert.equal(S.time.phase, 'plan');
  assert.equal(act(S, 'deadlineFinish').ok, false, 'cannot finish twice (would skip a later Son Gün)');
  const m = advance(S);
  assert.ok(m.ok && m.matchdays.length > 0);
  assert.equal(S.time.month, 2);
});

test('Son Gün is skipped when nothing is going on', () => {
  const S = newGame({ seed: 22 });
  S.flags.tutorial.done = true; S.inbox = []; S.time.month = 1; S.interests = [];
  for (const p of mine(S)) { p.agentId = null; p.rep = null; }
  const r = advance(S);
  assert.equal(r.phase, undefined);
  assert.equal(S.time.month, 2);
});

test('pre-contract (free) in January: commission now, move at season end', () => {
  const S = newGame({ seed: 31 });
  S.flags.tutorial.done = true; S.inbox = [];
  S.agency.cash = 1e6;
  const p = mine(S)[1];
  p.contractEnd = S.time.season;
  S.time.month = 6;
  const from = p.clubId;
  const club = Object.values(S.clubs).find(c => c.id !== from && c.leagueId === S.clubs[from].leagueId);
  S.interests = [{ id: 'iF', playerId: p.id, clubId: club.id, level: 75, kind: 'free', cooldown: 0, boost: 0 }];
  const row = sel.interestList(S)[0];
  assert.ok(row.negotiable, row.reason);
  assert.ok(act(S, 'openNegotiation', { interestId: 'iF' }).ok);
  const cash = S.agency.cash, trust = S.clubs[from].trust;
  dealAtFair(S);
  assert.ok(p.preContract && p.preContract.toClubId === club.id);
  assert.equal(p.clubId, from, 'still at the old club until June');
  assert.ok(S.agency.cash > cash, 'commission paid at signing');
  assert.ok(S.clubs[from].trust < trust, 'the old club is furious');
  assert.equal(sel.interestList(S).filter(i => i.kind !== 'renewal').length, 0);
  // play to June: he moves
  S.time.month = 11;
  keepAlive(S);
  const r = advance(S);
  assert.ok(r.ok);
  assert.equal(S.players[p.id].clubId, club.id);
  assert.ok(!S.players[p.id].preContract);
  assertClean(S);
});

test('free agent: released at expiry, clubless in July, signed by a club after the August deadline', () => {
  const S = newGame({ seed: 41 });
  S.flags.tutorial.done = true; S.inbox = [];
  const p = mine(S)[0];
  const market = S.clubs[p.clubId];
  BAL.market.freeAgent.chance = 1; BAL.market.freeAgent.minGap = -99;
  try {
    p.contractEnd = S.time.season; p.age = 28;
    S.time.month = 11;
    keepAlive(S);
    advance(S);
  } finally { BAL.market.freeAgent.chance = 0.4; BAL.market.freeAgent.minGap = 8; }
  const q = S.players[p.id];
  assert.equal(q.clubId, null, 'clubless free agent');
  assertClean(S);
  assert.equal(sel.clientList(S).find(c => c.id === p.id).clubName, 'Serbest');
  const cv = sel.clientView(S, p.id);
  assert.ok(cv.flags.freeAgent && cv.club === null);
  // July: a free-kind interest can be negotiated
  const club = Object.values(S.clubs).find(c => c.leagueId === market.leagueId);
  S.interests = [{ id: 'iFA', playerId: p.id, clubId: club.id, level: 75, kind: 'free', cooldown: 0, boost: 0 }];
  assert.ok(sel.interestList(S)[0].negotiable);
  S.interests = [];
  keepAlive(S);
  advance(S); // July
  assert.equal(S.players[p.id].clubId, null);
  const r = advance(S); // Ağustos
  if (r.phase === 'deadline') { act(S, 'deadlineFinish'); advance(S); }
  assert.ok(S.players[p.id].clubId, 'placed after the window');
  assertClean(S);
});

test('season end: report, history row, objectives, new season July', () => {
  const S = newGame({ seed: 51 });
  const rep = play(S, 12);
  assert.equal(rep.month, 11);
  assert.ok(rep.seasonEnd && Array.isArray(rep.seasonEnd.awards) && rep.seasonEnd.champions.tr1);
  assert.equal(S.time.season, 2);
  assert.equal(S.time.month, 0);
  assert.equal(S.history.length, 1);
  assert.ok(S.history[0].rank >= 1 && S.history[0].rank <= 5);
  assert.equal(S.agency.energy, S.agency.energyMax);
  assert.ok(S.objectives.offered.length >= 1 || S.objectives.active);
  assertClean(S);
});

test('ending: career over → ending card; endless mode continues; bankruptcy cannot continue', () => {
  const S = newGame({ seed: 61, careerSeasons: 2 });
  play(S, 24);
  assert.equal(S.time.phase, 'over');
  assert.ok(S.ending && ['efsane', 'buyuk', 'saygin', 'siradan', 'yalniz'].includes(S.ending.kind));
  assert.ok(S.ending.epilogues.length >= 1 && S.ending.stats.length >= 5 && S.ending.legacy >= 0);
  assert.equal(act(S, 'scoutTrip', { leagueId: 'tr1', focus: 'any' }).ok, false);
  assert.equal(advance(S).ok, false);
  const c = act(S, 'continueEndless');
  assert.ok(c.ok, c.error);
  assert.equal(S.time.phase, 'plan');
  const r = play(S, 14);
  assert.ok(r.ok);
  assert.equal(S.time.season, 3 + 1);
  assert.equal(act(S, 'continueEndless').ok, false, 'only once');

  const B = newGame({ seed: 62 });
  B.flags.tutorial.done = true; B.inbox = [];
  B.agency.cash = -5e6; B.agency.negMonths = 2; B.agency.loanOffered = true;
  const rb = advance(B);
  assert.ok(rb.ending && rb.ending.kind === 'iflas');
  assert.equal(B.time.phase, 'over');
  assert.equal(act(B, 'continueEndless').ok, false);
});

test('loan lifeline: first negative month offers it, takeLoan pays out', () => {
  const S = newGame({ seed: 63 });
  S.flags.tutorial.done = true; S.inbox = [];
  S.agency.cash = -1000;
  const r = advance(S);
  assert.ok(r.events.some(e => e.type === 'loanOffer'));
  const cash = S.agency.cash;
  assert.ok(act(S, 'takeLoan').ok);
  assert.ok(S.agency.cash > cash + 50000 && S.agency.loan);
  assert.ok(sel.hubSummary(S).loan);
});

test('save round trip mid-negotiation: deterministic continuation', () => {
  const { S } = deadlineState(71);
  S.time.month = 3; // plain month, window closed → use a renewal interest instead
  const p = mine(S)[0];
  p.contractEnd = S.time.season; S.time.month = 5;
  const club = S.clubs[p.clubId];
  S.interests = [{ id: 'iR', playerId: p.id, clubId: club.id, level: 80, kind: 'renewal', cooldown: 0, boost: 0 }];
  assert.ok(act(S, 'openNegotiation', { interestId: 'iR' }).ok);
  const n = sel.negotiationView(S);
  assert.ok(act(S, 'negPropose', { package: { ...n.fair, fee: n.fair.fee * 4, wage: n.fair.wage * 2 } }).ok);
  const S2 = deserialize(serialize(S));
  assert.deepEqual(S2.negotiation, S.negotiation, 'hidden state survives the save');
  for (const X of [S, S2]) { act(X, 'negPropose', { package: { ...n.fair } }); }
  assert.equal(serialize(S), serialize(S2));
});

test('negotiation view never exposes the ceiling; no other module reads negotiation.hidden', () => {
  const { S } = deadlineState(72);
  S.time.month = 0; S.time.phase = 'plan';
  act(S, 'openNegotiation', { interestId: 'iDL' });
  const v = sel.negotiationView(S);
  assert.equal(v.hidden, undefined);
  assert.ok(!JSON.stringify(v).includes(String(Math.round(S.negotiation.hidden.K))));
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src');
  const offenders = [];
  (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, f.name);
    if (f.isDirectory()) walk(full);
    else if (/\.js$/.test(f.name) && !/engine[\\/]negotiation\.js$/.test(full) && /\.hidden\b/.test(fs.readFileSync(full, 'utf8').replace(/\/\/.*$/gm, ''))) offenders.push(full);
  } })(dir);
  assert.deepEqual(offenders.filter(f => !/selectors\.js$/.test(f)), [], 'only negotiation.js (and the view-stripping selector) touch .hidden');
});

test('every office upgrade level has its effect', () => {
  const S = newGame({ seed: 81 });
  S.flags.tutorial.done = true; S.inbox = [];
  const fx = l => { S.agency.upgrades = { scout: l, table: l, network: l }; return sel.upgradeEffects(S); };
  assert.equal(fx(0).scoutCount, 3); assert.equal(fx(1).scoutCount, 4);
  assert.equal(fx(1).scoutKnowBonus, 0); assert.equal(fx(2).scoutKnowBonus, 15);
  assert.equal(fx(2).passiveDiscovery, false); assert.equal(fx(3).passiveDiscovery, true);
  assert.equal(fx(3).heatMult, 1); assert.ok(fx(4).heatMult < 1);
  assert.equal(fx(0).tablePatience, 0); assert.equal(fx(1).tablePatience, 1);
  assert.equal(fx(1).kurnazTrue, false); assert.equal(fx(2).kurnazTrue, true);
  assert.equal(fx(2).blofRiskDelta, 0); assert.ok(fx(3).blofRiskDelta < 0);
  assert.equal(fx(2).kozMax, 4); assert.equal(fx(3).kozMax, 5);
  assert.equal(fx(3).ceilingBand, 0); assert.ok(fx(4).ceilingBand > 0);
  assert.equal(sel.energyMaxFor(S), BAL.energy.base + 2);
  assert.equal(fx(1).lunchTrust, 10); assert.ok(fx(2).lunchTrust > 10);
  assert.equal(fx(3).deadlineActionsPerHour, 1); assert.equal(fx(4).deadlineActionsPerHour, 2);
  // the effects really reach the table
  const p = mine(S)[0];
  const club = Object.values(S.clubs).find(c => c.id !== p.clubId);
  const open = lvl => {
    S.agency.upgrades = { scout: 0, table: lvl, network: 0 };
    S.negotiation = null; S.agency.energy = 4; S.time.month = 0;
    S.interests = [{ id: 'iU', playerId: p.id, clubId: club.id, level: 80, kind: 'transfer', cooldown: 0, boost: 0 }];
    assert.ok(act(S, 'openNegotiation', { interestId: 'iU' }).ok);
    return sel.negotiationView(S);
  };
  const base = open(0).patience;
  assert.equal(open(1).patience, base + 1);
  assert.equal(open(3).ceilingBand, null);
  const b4 = open(4).ceilingBand;
  assert.ok(b4 && b4.lo < b4.hi);
  const bl = lvl => { const v = open(lvl); const h = v.hand.find(x => x.id === 'blof'); return h ? h.risk : null; };
  const r0 = bl(0), r3 = bl(3);
  if (r0 !== null && r3 !== null) assert.equal(r0 - r3, 10);
});

test('archetype bonuses reach the game', () => {
  const m = newGame({ seed: 91, archetype: 'mahalle' }), e = newGame({ seed: 91, archetype: 'eskifutbolcu' }), h = newGame({ seed: 91, archetype: 'hukukcu' });
  assert.equal(e.agency.rep, BAL.start.rep + BAL.archetype.eskifutbolcu.rep);
  const avgTrust = S => Object.values(S.clubs).reduce((a, c) => a + c.trust, 0) / 60;
  assert.ok(avgTrust(e) > avgTrust(h) + 10);
  assert.ok(mine(m).every(p => p.loyalty >= BAL.start.clientLoyalty + BAL.archetype.mahalle.loyaltyBonus));
  const open = S => {
    S.flags.tutorial.done = true; const p = mine(S)[0]; const c = Object.values(S.clubs).find(x => x.id !== p.clubId);
    S.interests = [{ id: 'iA', playerId: p.id, clubId: c.id, level: 80, kind: 'transfer', cooldown: 0, boost: 0 }];
    act(S, 'openNegotiation', { interestId: 'iA' }); return sel.negotiationView(S);
  };
  const nh = open(h);
  assert.equal(nh.feeThreshold, BAL.archetype.hukukcu.feeThreshold);
  assert.equal(open(m).feeThreshold, 0.12);
});

test('views: hubSummary / clientView / prospectList / clubView / financeSeries / rankingView / availableActions', () => {
  const S = newGame({ seed: 101 });
  const hub = sel.hubSummary(S);
  for (const k of ['season', 'monthName', 'energy', 'cash', 'rep', 'rank', 'clients', 'inbox', 'advanceBlock', 'alerts', 'objectivesOffered']) assert.ok(k in hub, k);
  const c = mine(S)[0];
  const cv = sel.clientView(S, c.id);
  assert.ok(cv.band.lo <= cv.band.hi && cv.traitLabel && cv.dream.text);
  assert.equal(sel.clientView(S, 'nope'), null);
  act(S, 'scoutTrip', { leagueId: 'tr1', focus: 'any' });
  const pl = sel.prospectList(S);
  assert.ok(pl.length >= 3);
  for (const p of pl) { assert.ok(!('pa' in p)); assert.ok(p.band.lo <= p.band.hi); if (p.know < BAL.scout.traitKnow) assert.equal(p.trait, null); }
  const any = Object.values(S.clubs)[0];
  const cvw = sel.clubView(S, any.id);
  assert.equal(cvw.needs, null, 'needs stay hidden before lunch');
  assert.equal(cvw.director.persona, null);
  S.agency.energy = 4; S.agency.cash = 1e5;
  assert.ok(act(S, 'clubLunch', { clubId: any.id }).ok);
  const cv2 = sel.clubView(S, any.id);
  assert.ok(Array.isArray(cv2.needs) && cv2.director.persona && cv2.budgetHint.lo <= cv2.budgetHint.hi);
  advance(S);
  const fs2 = sel.financeSeries(S);
  assert.equal(fs2.length, 1);
  assert.equal(fs2[fs2.length - 1].cash, S.agency.cash);
  const rk = sel.rankingView(S);
  assert.equal(rk.length, 5);
  assert.ok(rk.filter(r => r.isYou).length === 1);
  const acts = sel.availableActions(S, { playerId: c.id });
  assert.ok(acts.find(a => a.id === 'visitClient'));
  for (const a of acts) assert.ok(typeof a.ok === 'boolean' && (a.ok || typeof a.reason === 'string') && a.cost);
  S.agency.energy = 0;
  const v0 = sel.availableActions(S, { playerId: c.id }).find(a => a.id === 'visitClient');
  assert.equal(v0.ok, false); assert.equal(v0.reason, 'Enerjin yok');
  assert.ok(sel.availableActions(S, {}).some(a => a.id === 'scoutTrip'));
  assert.ok(sel.availableActions(S, { playerId: pl[0].id }).some(a => a.id === 'recruit'));
});

test('actions: every id works end-to-end or fails with a Turkish error, never throws', () => {
  const S = newGame({ seed: 111 });
  for (const id of ACTION_IDS) {
    for (const payload of [{}, { playerId: 'zz', clubId: 'zz', interestId: 'zz', branch: 'zz', callId: 'zz', inboxId: 'zz', optionId: 'zz', objectiveId: 'zz', leagueId: 'zz' }]) {
      const r = act(S, id, payload);
      assert.equal(typeof r.ok, 'boolean', id);
      if (!r.ok) assert.ok(/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(r.error), id);
      else assert.ok(r.preview !== undefined || Array.isArray(r.events), id + ' result shape');
    }
  }
  assert.equal(act(S, 'nope').ok, false);
  assertClean(S);
});

test('bots: sharp/passive/fuzz play a few seasons without exceptions; passive is not bankrupt in season 1', () => {
  for (const [bot, seed, seasons] of [['sharp', 3, 2], ['fuzz', 5, 3], ['casual', 4, 2], ['greedy', 2, 2]]) {
    const r = runCareer(bot, seed, { seasons });
    assert.deepEqual(r.exceptions, [], bot);
    assertClean(r.S);
  }
  const p = runCareer('passive', 7, { seasons: 3 });
  assert.deepEqual(p.exceptions, []);
  assert.ok(p.rows.length >= 1, 'passive survives season 1');
});
