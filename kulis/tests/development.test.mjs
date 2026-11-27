import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/engine/game.js';
import { developMonth } from '../src/engine/development.js';
import { playerValue, fairWage } from '../src/engine/valuation.js';
import { MONTHS } from '../src/engine/constants.js';
import { myClients } from '../src/engine/selectors.js';

function curve(share, seed, { pa = 90, ca0 = 50, age0 = 17, years = 8 } = {}) {
  const S = newGame({ seed });
  const p = myClients(S).find(q => q.age === 17);
  Object.assign(p, { ca: ca0, cf: ca0, pa, age: age0, trait: 'sadik', morale: 60 });
  S.clubs[p.clubId].facilities = 3;
  p.st.sh = share;
  const out = [];
  for (let m = 0; m < 12 * years; m++) {
    S.time.month = m % 12;
    p.st.m = share * MONTHS[S.time.month].matchdays * 90;
    p.morale = 60;
    developMonth(S);
    if (m % 12 === 11) { p.age++; out.push(p.ca); }
  }
  return out;
}
const avg = (share, idx, opt) => [1, 2, 3, 4, 5, 6].reduce((s, seed) => s + curve(share, seed, opt)[idx], 0) / 6;

test('regular starter pa90 ≈ 85 at 23; benched ≈ 74', () => {
  const starter = avg(0.9, 5), bench = avg(0.05, 5);
  assert.ok(starter > 82 && starter < 88, 'starter ' + starter);
  assert.ok(bench > 71 && bench < 78, 'bench ' + bench);
  assert.ok(starter - bench > 7);
});

test('minutes matter monotonically; never exceeds pa', () => {
  const a = avg(0.05, 4), b = avg(0.4, 4), c = avg(0.9, 4);
  assert.ok(a < b && b < c, [a, b, c].join());
  for (const v of curve(1, 3)) assert.ok(v <= 90);
});

test('decline from 30+', () => {
  const c = curve(0.9, 2, { pa: 70, ca0: 70, age0: 30, years: 6 });
  assert.ok(c[0] <= 70 && c[5] < c[0] - 6, c.join());
  const young = curve(0.9, 2, { pa: 70, ca0: 70, age0: 25, years: 3 });
  assert.ok(young[2] >= 68);
});

test('minutes drive growth: a regular starter outgrows a bench player', () => {
  const run = sh => { const S = newGame({ seed: 4 }); const p = myClients(S).find(q => q.age === 17); Object.assign(p, { ca: 50, cf: 50, pa: 90 }); p.st.sh = sh;
    for (let m = 0; m < 36; m++) { S.time.month = m % 12; p.st.m = sh * MONTHS[S.time.month].matchdays * 90; developMonth(S); } return p.cf; };
  assert.ok(run(0.9) > run(0.1) + 2);
});

test('valuation orders of magnitude', () => {
  const S = newGame({ seed: 1 });
  const mk = (ca, age, extra = {}) => ({ ca, pa: ca, age, hype: 0, contractEnd: S.time.season + 3, ...extra });
  const near = (v, lo, hi, msg) => assert.ok(v >= lo && v <= hi, msg + ' ' + v);
  near(playerValue(S, mk(50, 27)), 120e3, 180e3, 'ca50');
  near(playerValue(S, mk(60, 27)), 600e3, 900e3, 'ca60');
  near(playerValue(S, mk(70, 27)), 3.2e6, 4.2e6, 'ca70');
  near(playerValue(S, mk(80, 27)), 15e6, 21e6, 'ca80');
  near(playerValue(S, mk(90, 27)), 80e6, 105e6, 'ca90');
  // youth + potential + hype + contract
  assert.ok(playerValue(S, mk(55, 18, { pa: 85 })) > 1.8 * playerValue(S, mk(55, 27)));
  assert.ok(playerValue(S, mk(70, 27, { hype: 80 })) > playerValue(S, mk(70, 27)));
  assert.ok(playerValue(S, mk(70, 27, { contractEnd: S.time.season })) < playerValue(S, mk(70, 27)));
  assert.ok(playerValue(S, mk(70, 34)) < playerValue(S, mk(70, 27)) * 0.3);
});

test('fair wage scales with ca and league prestige', () => {
  const S = newGame({ seed: 1 });
  const p = { ca: 70 };
  assert.ok(fairWage(S, p, 'en1') > fairWage(S, p, 'nl1') && fairWage(S, p, 'nl1') > fairWage(S, p, 'tr2'));
  assert.ok(fairWage(S, { ca: 80 }, 'tr1') > 3 * fairWage(S, { ca: 70 }, 'tr1'));
  assert.ok(fairWage(S, { ca: 50 }, 'tr2') >= 600);
});
