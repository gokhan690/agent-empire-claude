import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/engine/game.js';
import { BAL, LEAGUE_DEFS, POS_ORDER } from '../src/engine/constants.js';
import { squadIndex, clubStrength } from '../src/engine/selection.js';
import { myClients, potentialBand } from '../src/engine/selectors.js';
import { generateFixtures } from '../src/engine/fixtures.js';
import { CLUB_DATA } from '../src/engine/data/clubs.js';
import { assertClean, LEAGUES } from './helpers.mjs';

const S = newGame({ seed: 11, archetype: 'mahalle' });

test('60 fictional clubs, 10 per league, unique codes', () => {
  assert.equal(Object.keys(S.clubs).length, 60);
  const codes = new Set();
  for (const l of LEAGUES) {
    assert.equal(S.leagues[l].clubIds.length, 10);
    assert.equal(CLUB_DATA[l].length, 10);
    for (const d of CLUB_DATA[l]) { assert.ok(!codes.has(d[1])); codes.add(d[1]); assert.match(d[2], /^#[0-9A-F]{6}$/i); }
  }
  assert.equal(codes.size, 60);
  const real = /galatasaray|fenerbah|beşiktaş|trabzon|ajax|psv|feyenoord|juventus|milan|inter\b|roma\b|napoli|barcelona|real madrid|sevilla|liverpool|chelsea|arsenal|manchester|tottenham/i;
  for (const c of Object.values(S.clubs)) assert.ok(!real.test(c.name), c.name);
});

test('squads 18–22, every line covered, valid fields', () => {
  const idx = squadIndex(S);
  for (const cid in idx) {
    const sq = idx[cid];
    assert.ok(sq.length >= 18 && sq.length <= 22, cid + ' ' + sq.length);
    for (const pos of POS_ORDER) assert.ok(sq.filter(p => p.pos === pos).length >= BAL.squad.minByPos[pos], cid + pos);
    for (const p of sq) { assert.ok(p.pa >= p.ca && p.age >= 16 && p.age <= 36, p.name); assert.ok(p.contractEnd >= 1); }
  }
  assertClean(S);
});

test('strength follows prestige (≈52/62/68/76/82)', () => {
  const idx = squadIndex(S);
  for (const ld of LEAGUE_DEFS) {
    const vals = S.leagues[ld.id].clubIds.map(c => clubStrength(S, c, idx[c]));
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    assert.ok(Math.abs(avg - BAL.strengthByPrestige[ld.prestige]) < 3, ld.id + ' avg ' + avg);
    assert.ok(Math.max(...vals) - Math.min(...vals) > 5, 'spread inside ' + ld.id);
  }
});

test('start: 3 Turkish clients, gem aged 17 with wide band, rivals hold ~25%', () => {
  const cl = myClients(S);
  assert.equal(cl.length, 3);
  const gem = cl.find(p => p.age === 17);
  assert.ok(gem && gem.pa >= 82);
  const b = potentialBand(S, gem);
  assert.ok(b.lo <= gem.pa && gem.pa <= b.hi && b.hi - b.lo >= 15, JSON.stringify(b));
  for (const p of cl) { assert.equal(p.nat, 'TR'); assert.ok(['tr1', 'tr2'].includes(S.clubs[p.clubId].leagueId)); }
  const all = Object.values(S.players);
  const rival = all.filter(p => p.agentId && p.agentId !== 'you').length / all.length;
  assert.ok(rival > 0.2 && rival < 0.3, 'rival share ' + rival);
  assert.equal(S.rivals.length, 4);
  assert.equal(S.ranking.length, 5);
  assert.equal(S.agency.cash, 60000); assert.equal(S.agency.rep, 12);
});

test('potential band always contains pa and narrows with knowledge', () => {
  const ps = Object.values(S.players).slice(0, 300);
  for (const p of ps) {
    const save = p.know;
    let prev = 1e9;
    for (const k of [0, 30, 60, 90, 100]) {
      p.know = k;
      const b = potentialBand(S, p);
      assert.ok(b.lo <= p.pa && p.pa <= b.hi, p.id + ' k' + k + JSON.stringify(b) + p.pa);
      assert.ok(b.hi - b.lo <= prev); prev = b.hi - b.lo;
    }
    p.know = save;
  }
});

test('archetype bonuses', () => {
  const E = newGame({ seed: 11, archetype: 'eskifutbolcu' });
  assert.equal(E.agency.rep, BAL.start.rep + BAL.archetype.eskifutbolcu.rep);
  const base = newGame({ seed: 11, archetype: 'hukukcu' });
  const c = Object.keys(E.clubs)[0];
  assert.ok(E.clubs[c].trust >= base.clubs[c].trust + 10);
});

test('fixtures: double round robin, 18 matchdays', () => {
  const L = S.leagues.tr1;
  assert.equal(L.fixtures.length, 18);
  const seen = {}; const home = {};
  for (const round of L.fixtures) {
    const teams = new Set();
    for (const [h, a] of round) { teams.add(h); teams.add(a); seen[h + '>' + a] = (seen[h + '>' + a] || 0) + 1; home[h] = (home[h] || 0) + 1; }
    assert.equal(teams.size, 10);
  }
  assert.equal(Object.keys(seen).length, 90);
  assert.ok(Object.values(seen).every(n => n === 1));
  assert.ok(Object.values(home).every(n => n === 9));
  const f = generateFixtures(newGame({ seed: 1 }), L.clubIds);
  assert.equal(f.length, 18);
});
