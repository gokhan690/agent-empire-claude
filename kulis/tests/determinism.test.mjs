import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, serialize, deserialize } from '../src/engine/game.js';
import { play } from './helpers.mjs';

test('same seed → identical serialized state after 24 months', () => {
  const a = newGame({ seed: 42 }), b = newGame({ seed: 42 });
  assert.equal(serialize(a), serialize(b));
  play(a, 24); play(b, 24);
  assert.equal(serialize(a), serialize(b));
});

test('different seeds differ', () => {
  assert.notEqual(serialize(newGame({ seed: 1 })), serialize(newGame({ seed: 2 })));
});

test('JSON round trip is lossless and canonical', () => {
  const S = newGame({ seed: 7 });
  play(S, 15);
  const json = serialize(S);
  const R = deserialize(json);
  assert.deepEqual(R, S);
  assert.equal(serialize(R), json);
  // plain JSON.stringify of the full state also parses back to an equal object
  assert.deepEqual(JSON.parse(JSON.stringify(S)), S);
  // a restored game continues identically
  play(S, 6); play(R, 6);
  assert.equal(serialize(S), serialize(R));
});

test('deserialize rejects garbage', () => {
  assert.throws(() => deserialize('{"v":2}'));
});

test('serialized size stays under 600 KB', () => {
  const S = newGame({ seed: 3 });
  assert.ok(serialize(S).length < 600000);
  play(S, 48);
  const n = serialize(S).length;
  assert.ok(n < 600000, 'size ' + n);
});

test('advance() month is fast', () => {
  const S = newGame({ seed: 5 });
  play(S, 6);
  const t = performance.now();
  play(S, 12);
  const per = (performance.now() - t) / 12;
  assert.ok(per < 50, 'avg ms/month ' + per);
});
