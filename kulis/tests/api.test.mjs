import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newGame, act, advance, ACTION_IDS } from '../src/engine/game.js';
import { BAL } from '../src/engine/constants.js';
import * as sel from '../src/engine/selectors.js';
import { myClients } from '../src/engine/selectors.js';

const DESIGN_ACTIONS = ['scoutTrip', 'watchPlayer', 'recruit', 'visitClient', 'clubLunch', 'pitchPlayer', 'mediaPush', 'openNegotiation', 'buyUpgrade', 'answerInbox'];

test('act() routes every action id of the DESIGN table', () => {
  for (const id of DESIGN_ACTIONS) assert.ok(ACTION_IDS.includes(id), id);
  const S = newGame({ seed: 1 });
  for (const id of ACTION_IDS) {
    const r = act(S, id, {});
    assert.equal(typeof r.ok, 'boolean', id);
    if (!r.ok) assert.equal(typeof r.error, 'string');
  }
  assert.deepEqual(act(S, 'scoutTrip', { leagueId: 'tr1', focus: 'any' }), { ok: false, error: 'Henüz hazır değil' });
  assert.equal(act(S, 'nope').ok, false);
});

test('advance guards: open negotiation, must-answer inbox card, deadline phase, over', () => {
  const S = newGame({ seed: 1 });
  S.negotiation = { x: 1 };
  assert.equal(advance(S).ok, false);
  S.negotiation = null;
  S.inbox.push({ id: 'c1', must: true, options: [] });
  assert.equal(advance(S).ok, false);
  assert.ok(sel.mustAnswer(S));
  S.inbox = [];
  S.time.phase = 'deadline';
  assert.equal(advance(S).ok, false);
  assert.ok(act(S, 'deadlineFinish').ok);
  assert.equal(S.time.phase, 'plan');
  S.time.phase = 'over';
  assert.equal(advance(S).ok, false);
});

test('MonthReport shape', () => {
  const S = newGame({ seed: 1 });
  S.agency.cash = 1e6;
  advance(S); // July: no matches
  const r = advance(S);
  assert.ok(r.ok && r.month === 1);
  assert.equal(r.matchdays.length, 12); // 2 matchdays × 6 leagues
  assert.equal(r.clients.length, 3);
  for (const c of r.clients) for (const k of ['playerId', 'apps', 'mins', 'goals', 'assists', 'rating', 'caDelta', 'valueDelta']) assert.ok(k in c);
  assert.ok(r.finance && Array.isArray(r.finance.items) && 'cash' in r.finance);
  for (const k of ['news', 'promises', 'rivalMoves', 'events']) assert.ok(Array.isArray(r[k]));
  assert.equal(S.time.month, 2);
  assert.equal(S.time.season, 1);
});

test('selectors', () => {
  const S = newGame({ seed: 1 });
  assert.equal(sel.monthName(S), 'Temmuz');
  assert.ok(sel.isWindowOpen(S));
  const p = myClients(S)[0];
  assert.equal(sel.clubOf(S, p).id, p.clubId);
  assert.equal(sel.leagueOf(S, sel.clubOf(S, p)).id, sel.clubOf(S, p).leagueId);
  assert.ok(sel.minutesShare(S, p) >= 0 && sel.minutesShare(S, p) <= 1);
  assert.equal(sel.avgRating(p), 0);
  assert.equal(sel.tableSorted(S, 'tr1')[0].gd, 0);
});

test('every BAL.* reference in the engine exists', () => {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/engine');
  const files = [];
  (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) f.isDirectory() ? walk(path.join(d, f.name)) : f.name.endsWith('.js') && files.push(path.join(d, f.name)); })(dir);
  const bad = [];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bBAL\.([A-Za-z_]+)(?:\.([A-Za-z_]+))?/g)) {
      if (!(m[1] in BAL)) bad.push(f + ': BAL.' + m[1]);
      else if (m[2] && BAL[m[1]] && typeof BAL[m[1]] === 'object' && !Array.isArray(BAL[m[1]]) && !(m[2] in BAL[m[1]]) && !/^(byPrestige)$/.test(m[2])) bad.push(f + ': BAL.' + m[1] + '.' + m[2]);
    }
  }
  assert.deepEqual(bad, []);
});

test('engine is pure: no Math.random / Date / DOM', () => {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/engine');
  (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, f.name);
    if (f.isDirectory()) { walk(full); continue; }
    const src = fs.readFileSync(full, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/Math\.random|Date\.now|new Date|document\.|window\.|localStorage/.test(src), f.name);
  } })(dir);
});

test('season-end report has sane client rows and seasonEnd', async () => {
  const { play } = await import('./helpers.mjs');
  const S = newGame({ seed: 17 });
  const r = play(S, 12);
  assert.equal(r.month, 11);
  assert.ok(r.seasonEnd && r.seasonEnd.season === 1);
  for (const c of r.clients) assert.ok(c.apps >= 0 && c.mins >= 0);
  assert.ok(r.news.length >= 6, 'champion news');
  assert.equal(S.time.season, 2); assert.equal(S.time.month, 0);
  assert.equal(S.history.length, 1);
});
