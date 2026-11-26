import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, advance, act, serialize } from '../src/engine/game.js';
import { spend, earn, spendEnergy, takeLoan, monthlyEconomy } from '../src/engine/economy.js';
import { applyEffects } from '../src/engine/effects.js';
import { myClients, officeUpkeep, monthlyCommission, canAfford } from '../src/engine/selectors.js';
import { BAL } from '../src/engine/constants.js';

test('monthly commission from client wages and office upkeep', () => {
  const S = newGame({ seed: 2 });
  const cl = myClients(S);
  cl.forEach(p => { p.wage = 10000; p.rep.commissionPct = 8; });
  const cash = S.agency.cash;
  const r = monthlyEconomy(S);
  assert.equal(r.net, 3 * 800 - BAL.start.upkeep);
  assert.equal(S.agency.cash, cash + r.net);
  assert.equal(monthlyCommission(S), 2400);
  assert.equal(officeUpkeep(S), 4000);
  S.agency.upgrades.scout = 2;
  assert.equal(officeUpkeep(S), 4000 + BAL.econ.upkeepUpgrade[2]);
});

test('spend/earn go through the ledger and stats', () => {
  const S = newGame({ seed: 2 });
  spend(S, 1500, 'travel', 'Yol'); earn(S, 5000, 'commission', 'Transfer');
  assert.equal(S.ledger[0].items.length, 2);
  assert.equal(S.ledger[0].net, 3500);
  assert.equal(S.agency.stats.commission, 5000);
  assert.ok(spendEnergy(S, 2) && S.agency.energy === 2 && !spendEnergy(S, 3) && S.agency.energy === 2);
  assert.ok(canAfford(S, { energy: 2, cash: 1000 }) && !canAfford(S, { energy: 3 }));
});

test('a month closes the ledger and refills energy; ledger capped at 24', () => {
  const S = newGame({ seed: 2 });
  S.agency.cash = 1e7;
  S.agency.energy = 0;
  const rep = advance(S);
  assert.ok(rep.ok);
  assert.equal(S.agency.energy, S.agency.energyMax);
  assert.ok(rep.finance.items.some(i => i.k === 'upkeep'));
  for (let i = 0; i < 40; i++) { S.agency.cash = 1e7; if (advance(S).phase === 'deadline') { S.time.phase = 'plan'; S.flags.deadlineDone = S.time.season + ':' + S.time.month; } }
  assert.ok(S.ledger.length <= 24);
});

test('network upgrade raises energy max', () => {
  const S = newGame({ seed: 2 });
  S.agency.upgrades.network = 3; S.agency.cash = 1e7;
  advance(S);
  assert.equal(S.agency.energyMax, 6);
});

test('loan offered once on first negative cash, bankruptcy after 3 negative month-ends', () => {
  const S = newGame({ seed: 3 });
  S.agency.cash = -1;
  let r = advance(S);
  assert.ok(S.agency.loanOffered && r.events.some(e => e.type === 'loanOffer') && S.flags.loanOfferPending);
  assert.equal(S.agency.negMonths, 1);
  r = advance(S);
  assert.ok(!r.events.some(e => e.type === 'loanOffer'));
  assert.equal(S.time.phase, 'plan');
  r = advance(S);
  assert.equal(S.time.phase, 'over');
  assert.equal(S.ending.kind, 'iflas');
  assert.equal(act(S, 'visitClient', {}).ok, false);
  assert.equal(advance(S).ok, false);
});

test('taking the loan prevents bankruptcy and is repaid', () => {
  const S = newGame({ seed: 3 });
  assert.equal(takeLoan(S).ok, false);
  S.agency.cash = -1; advance(S);
  const res = act(S, 'takeLoan');
  assert.ok(res.ok);
  assert.ok(S.agency.cash > 70000 && S.agency.loan.monthsLeft === BAL.econ.loan.months);
  assert.equal(act(S, 'takeLoan').ok, false);
  for (let i = 0; i < 12; i++) { S.agency.cash += 5000; const r = advance(S); if (r.phase === 'deadline') { S.time.phase = 'plan'; S.flags.deadlineDone = S.time.season + ':' + S.time.month; } }
  assert.equal(S.agency.loan, null);
});

test('effects: primitives apply and clamp; unknown key throws', () => {
  const S = newGame({ seed: 4 });
  const p = myClients(S)[0]; const cid = p.clubId;
  const ev = applyEffects(S, [
    { cash: -2000, label: 'Test' }, { rep: 5 }, { loyalty: 99, morale: -999, playerId: p.id }, { trust: 10, clubId: cid },
    { hype: 10, form: 20, know: 10, injure: 2, playerId: p.id },
    { interest: { playerId: p.id, clubId: cid, level: 70 } }, { interest: { playerId: p.id, clubId: cid, level: 80 } },
    { promise: { type: 'stay', dueSeason: 2, dueMonth: 11, text: 'Kal' }, playerId: p.id },
    { news: { kind: 'genel', text: 'Haber', playerId: p.id } }, { flag: 'x' },
  ]);
  assert.ok(ev.length >= 10);
  assert.equal(p.loyalty, 100); assert.equal(p.morale, 0); assert.equal(p.form, 10); assert.equal(p.injured, 2);
  assert.equal(S.interests.length, 1); assert.equal(S.interests[0].level, 80);
  assert.equal(S.promises.length, 1); assert.equal(S.promises[0].status, 'open');
  assert.equal(S.news[0].text, 'Haber'); assert.ok(S.flags.seen.x);
  assert.equal(S.agency.cash, 58000);
  applyEffects(S, { releaseClient: p.id });
  assert.equal(p.agentId, null);
  assert.throws(() => applyEffects(S, { bogus: 1 }));
  JSON.stringify(S);
});

test('office upkeep grows with the roster and the reputation tier; action prices scale with the agency; event prices with wealth', async () => {
  const { agencyScale, wealthMult } = await import('../src/engine/selectors.js');
  const S = newGame({ seed: 2 });
  assert.equal(officeUpkeep(S), 4000); assert.equal(agencyScale(S), 1); assert.equal(wealthMult(S), 1);
  const base = officeUpkeep(S);
  S.agency.rep = 36;
  assert.equal(officeUpkeep(S), base + BAL.econ.repTier[1][1]);
  const ids = Object.keys(S.players).filter(id => !S.players[id].agentId).slice(0, 5);
  for (const id of ids) { S.players[id].agentId = 'you'; S.players[id].rep = { commissionPct: 7, endSeason: 3 }; S.players[id].value = 100000; }
  assert.equal(officeUpkeep(S), base + BAL.econ.repTier[1][1] + (8 - BAL.econ.staff.free) * BAL.econ.staff.perClient);
  assert.ok(agencyScale(S) > 1.3);
  const star = myClients(S)[0]; star.value = 65e6;
  assert.equal(officeUpkeep(S), base + BAL.econ.repTier[1][1] + (8 - BAL.econ.staff.free) * BAL.econ.staff.perClient + Math.round(60e6 * BAL.econ.staff.valueShare), 'stars cost staff');
  S.agency.cash = 800000; assert.equal(wealthMult(S), 2);
  S.agency.cash = 5e6;
  assert.equal(wealthMult(S), BAL.econ.wealth.max);
});

test('late upgrade levels are real goals (L4 costs €2–5M)', () => {
  for (const b of ['scout', 'table', 'network']) { const c = BAL.upgrade.cost[b]; assert.ok(c[3] >= 2e6 && c[3] <= 5e6, b); assert.ok(c[2] < c[3] && c[1] < c[2]); }
});
