// Double round-robin generator (circle method). 10 clubs → 18 matchdays.
import { shuffle } from './rng.js';

/**
 * @param {object} S
 * @param {string[]} clubIds even count
 * @returns {Array<Array<[string,string]>>} matchdays → pairs [homeId, awayId]
 */
export function generateFixtures(S, clubIds) {
  const arr = shuffle(S, clubIds.slice());
  const n = arr.length;
  const first = [];
  const rot = arr.slice();
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = rot[i], b = rot[n - 1 - i];
      pairs.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    first.push(pairs);
    rot.splice(1, 0, rot.pop());
  }
  const order = shuffle(S, first.map((_, i) => i));
  const h1 = order.map(i => first[i]);
  const h2 = order.map(i => first[i].map(([a, b]) => [b, a]));
  return h1.concat(h2);
}
