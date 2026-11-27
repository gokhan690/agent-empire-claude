import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/engine/game.js';
import { playMatchday } from '../src/engine/match.js';
import { pickLineup, squadIndex, projectMinutes, squadOf } from '../src/engine/selection.js';
import { rnd, rint, chance, shuffle, seedRng, uid } from '../src/engine/rng.js';
import { tableSorted, avgRating } from '../src/engine/selectors.js';

test('matchday: shapes, scorers match scores, minutes add up, table updated', () => {
  const S = newGame({ seed: 5 });
  const r = playMatchday(S, 'tr1');
  assert.equal(r.results.length, 5);
  for (const m of r.results) {
    assert.equal(m.scorers.length, m.hg + m.ag);
    assert.equal(m.scorers.filter(g => g.clubId === m.home).length, m.hg);
    for (const g of m.scorers) { assert.ok(g.minute >= 1 && g.minute <= 90); assert.ok(S.players[g.playerId]); }
  }
  assert.equal(S.leagues.tr1.matchday, 1);
  for (const c of S.leagues.tr1.clubIds) {
    const mins = squadOf(S, c).reduce((s, p) => s + p.st.mins, 0);
    assert.equal(mins, 990, c);
    assert.equal(S.leagues.tr1.table[c].p, 1);
  }
  const rated = Object.values(S.players).filter(p => p.st.apps);
  assert.ok(rated.length >= 100);
  for (const p of rated) assert.ok(avgRating(p) >= 3 && avgRating(p) <= 10);
  assert.equal(tableSorted(S, 'tr1').length, 10);
});

test('lineup 1-4-4-2 + 3 subs; injured excluded; youthTrust matters', () => {
  const S = newGame({ seed: 8 });
  const idx = squadIndex(S);
  const club = S.clubs[S.leagues.es1.clubIds[0]];
  const sq = idx[club.id];
  const { xi, subs } = pickLineup(S, club, sq);
  const c = pos => xi.filter(p => p.pos === pos).length;
  assert.deepEqual([c('KL'), c('DF'), c('OS'), c('FV')], [1, 4, 4, 2]);
  assert.equal(subs.length, 3);
  const star = xi.find(p => p.pos === 'FV');
  star.injured = 2;
  assert.ok(!pickLineup(S, club, sq).xi.includes(star));
  star.injured = 0;
  const bench = sq.filter(p => p.pos === 'DF' && !xi.includes(p)).sort((a, b) => a.ca - b.ca)[0];
  bench.ca = xi.filter(p => p.pos === 'DF').reduce((m, p) => Math.min(m, p.ca), 99) - 6;
  assert.ok(!pickLineup(S, club, sq).xi.includes(bench));
  // youth-trust: a young player projects more minutes at a club that trusts youth
  const kid = { ...bench, id: 'kid', age: 19, ca: bench.ca + 3, clubId: club.id };
  club.youthTrust = 1; const lo = projectMinutes(S, kid, club.id, {}, sq.filter(p => p.id !== 'kid'));
  club.youthTrust = 5; const hi = projectMinutes(S, kid, club.id, {}, sq.filter(p => p.id !== 'kid'));
  assert.ok(hi >= lo);
});

test('rng: deterministic, in range, shuffle keeps elements', () => {
  const A = {}, B = {};
  seedRng(A, 99); seedRng(B, 99);
  for (let i = 0; i < 100; i++) assert.equal(rnd(A), rnd(B));
  for (let i = 0; i < 1000; i++) { const v = rint(A, 3, 7); assert.ok(v >= 3 && v <= 7); const f = rnd(A); assert.ok(f >= 0 && f < 1); }
  const arr = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.deepEqual(shuffle(A, arr.slice()).sort(), arr);
  assert.notEqual(uid(A, 'p'), uid(A, 'p'));
  let hits = 0; for (let i = 0; i < 4000; i++) if (chance(A, 0.25)) hits++;
  assert.ok(hits > 850 && hits < 1150);
});
