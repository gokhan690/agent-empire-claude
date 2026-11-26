import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, serialize } from '../src/engine/game.js';
import { MONTHS, BAL } from '../src/engine/constants.js';
import { clubStrength } from '../src/engine/selection.js';
import { assertClean, play, LEAGUES } from './helpers.mjs';

function invariants(S, cumMd) {
  assertClean(S);
  const counts = {};
  for (const id in S.players) {
    const p = S.players[id];
    if (p.clubId === null) { assert.ok(p.agentId === 'you' && S.time.month <= 1 && S.time.phase !== 'x', 'clubless only a free-agent client before the Aug deadline ' + id); continue; }
    assert.ok(S.clubs[p.clubId], 'bad clubId ' + id);
    counts[p.clubId] = (counts[p.clubId] || 0) + 1;
    assert.ok(p.pa >= p.ca - 0 && p.age >= 16 && p.age <= 40, p.id + ' age/ca');
    assert.ok(Number.isInteger(p.ca) && Number.isInteger(p.injured) && p.injured >= 0);
    assert.ok(p.loyalty >= 0 && p.loyalty <= 100 && p.morale >= 0 && p.morale <= 100 && p.hype >= 0 && p.hype <= 100);
    assert.ok(p.value > 0 && p.wage > 0);
    assert.ok(p.form >= -10 && p.form <= 10);
  }
  assert.equal(Object.keys(S.clubs).length, 60);
  for (const cid in S.clubs) { const n = counts[cid] || 0; assert.ok(n >= 16 && n <= 24, cid + ' squad ' + n); }
  for (const lid of LEAGUES) {
    const L = S.leagues[lid];
    assert.equal(L.clubIds.length, 10, lid);
    let gf = 0, ga = 0;
    for (const cid of L.clubIds) {
      assert.equal(S.clubs[cid].leagueId, lid);
      const r = L.table[cid];
      assert.equal(r.p, r.w + r.d + r.l); assert.equal(r.pts, 3 * r.w + r.d);
      assert.equal(r.p, L.matchday, lid + ' ' + cid + ' played');
      gf += r.gf; ga += r.ga;
    }
    assert.equal(gf, ga);
    assert.equal(L.matchday, cumMd);
  }
  assert.equal(S.ranking.length, 5);
}

for (const seed of [1, 2, 3, 4]) {
  test('full 8-season career, seed ' + seed, () => {
    const S = newGame({ seed });
    let season = 1;
    let t = 0, n = 0, worst = 0;
    play(S, 96, (r) => {
      const cum = MONTHS.slice(0, r.month + 1).reduce((s, m) => s + m.matchdays, 0);
      // r is the report of the month that was just played; at month 11 the season has been reset
      const md = r.month === 11 ? 0 : cum;
      invariants(S, md);
      if (r.month === 10) assert.equal(cum, 18);
      assert.ok(r.finance && Number.isFinite(r.finance.net));
    });
    assert.equal(S.time.phase, 'over');
    assert.ok(['efsane', 'buyuk', 'saygin', 'siradan', 'yalniz'].includes(S.ending.kind), S.ending.kind);
    assert.equal(S.history.length, 8);
    assert.equal(S.leagues.tr1.champions.length, 8);
    assert.ok(S.ledger.length <= 24 && S.news.length <= 80);
    assert.ok(serialize(S).length < 600000);
    assert.ok(Object.keys(S.players).length > 1100 && Object.keys(S.players).length < 1400);
  });
}

test('promotion/relegation swaps clubs between tr1 and tr2', () => {
  const S = newGame({ seed: 9 });
  const before = new Set(S.leagues.tr1.clubIds);
  const rep = play(S, 12);
  const after = new Set(S.leagues.tr1.clubIds);
  assert.equal(rep.seasonEnd.promoted.length, 2);
  assert.equal(rep.seasonEnd.relegated.length, 2);
  for (const c of rep.seasonEnd.relegated) { assert.ok(before.has(c) && !after.has(c)); assert.equal(S.clubs[c].leagueId, 'tr2'); }
  for (const c of rep.seasonEnd.promoted) { assert.ok(!before.has(c) && after.has(c)); assert.equal(S.clubs[c].leagueId, 'tr1'); }
});

test('league tables look like football', () => {
  const S = newGame({ seed: 13 });
  play(S, 11);
  let goals = 0, games = 0, homeWins = 0, awayWins = 0;
  for (const lid of LEAGUES) {
    const L = S.leagues[lid];
    for (const c of L.clubIds) { goals += L.table[c].gf; games += L.table[c].p; homeWins += 0; }
  }
  const gpg = goals / (games / 2);
  assert.ok(gpg > 2.2 && gpg < 3.3, 'goals per game ' + gpg);
  const rows = Object.values(S.leagues.en1.table).map(r => r.pts).sort((a, b) => b - a);
  assert.ok(rows[0] > rows[9] + 10, 'points spread ' + rows);
});

test('stronger clubs collect more points (correlation > 0.5)', () => {
  const S = newGame({ seed: 21 });
  const str = {};
  for (const lid of LEAGUES) for (const c of S.leagues[lid].clubIds) str[c] = clubStrength(S, c);
  play(S, 11);
  const xs = [], ys = [];
  for (const lid of LEAGUES) for (const c of S.leagues[lid].clubIds) { xs.push(str[c]); ys.push(S.leagues[lid].table[c].pts); }
  // correlate within leagues (centre per league)
  const xc = [], yc = [];
  for (const lid of LEAGUES) {
    const ids = S.leagues[lid].clubIds;
    const mx = ids.reduce((a, c) => a + str[c], 0) / 10, my = ids.reduce((a, c) => a + S.leagues[lid].table[c].pts, 0) / 10;
    for (const c of ids) { xc.push(str[c] - mx); yc.push(S.leagues[lid].table[c].pts - my); }
  }
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const r = dot(xc, yc) / Math.sqrt(dot(xc, xc) * dot(yc, yc));
  assert.ok(r > 0.5, 'r=' + r);
});

test('league strength is stable over 8 seasons (within ±2 CA of the start, mean deviation < 0.7)', async () => {
  const { newGame, advance, act } = await import('../src/engine/game.js');
  const { clubStrength } = await import('../src/engine/selection.js');
  const { myClients } = await import('../src/engine/selectors.js');
  const S = newGame({ seed: 9, careerSeasons: 30 });
  const mean = lid => S.leagues[lid].clubIds.reduce((a, c) => a + clubStrength(S, c), 0) / S.leagues[lid].clubIds.length;
  const start = {}; for (const lid in S.leagues) start[lid] = mean(lid);
  const worst = {};
  for (let g = 0; g < 12 * 8 && S.time.season <= 8; g++) {
    S.agency.cash = 1e8; S.agency.negMonths = 0; S.inbox = [];
    if (!myClients(S).length) { const q = Object.values(S.players).find(p => p.age < 22 && !p.agentId); q.agentId = 'you'; q.rep = { commissionPct: 7, endSeason: 99 }; q.loyalty = 90; }
    let r = advance(S);
    if (r.phase === 'deadline') { act(S, 'deadlineFinish'); r = advance(S); }
    if (r.seasonEnd) for (const lid in S.leagues) worst[lid] = Math.max(worst[lid] || 0, Math.abs(mean(lid) - start[lid]));
  }
  for (const lid in worst) assert.ok(worst[lid] <= 2, lid + ' drifted ' + worst[lid].toFixed(2));
});
