// Deterministic RNG (mulberry32). Generator state lives in S.rng (uint32). Never use Math.random.
import { hashStr } from './util.js';

/** Seed the generator. `seed` may be a number or string. Sets S.seed and S.rng. */
export function seedRng(S, seed) {
  const n = typeof seed === 'string' ? hashStr(seed) : (Number(seed) >>> 0);
  S.seed = n || 0x9e3779b9;
  S.rng = S.seed;
  S.seq = 0;
}
/** Float in [0,1). */
export function rnd(S) {
  S.rng = (S.rng + 0x6D2B79F5) >>> 0;
  let t = S.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** Integer in [a,b] inclusive. */
export function rint(S, a, b) { return a + Math.floor(rnd(S) * (b - a + 1)); }
/** Random element of arr. */
export function pick(S, arr) { return arr[Math.floor(rnd(S) * arr.length)]; }
/** true with probability p. */
export function chance(S, p) { return rnd(S) < p; }
/** Normal(m, sd) via Box–Muller. */
export function gauss(S, m = 0, sd = 1) {
  const u = 1 - rnd(S), v = rnd(S);
  return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
/** In-place Fisher–Yates; returns arr. */
export function shuffle(S, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd(S) * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}
/** Unique id with prefix, e.g. uid(S,'p') → 'p1a'. Counter lives in S.seq. */
export function uid(S, prefix = 'x') {
  S.seq = (S.seq || 0) + 1;
  return prefix + S.seq.toString(36);
}
/** Pick a key from an object {key: weight}. */
export function pickWeighted(S, weights) {
  let tot = 0;
  for (const k in weights) tot += weights[k];
  let r = rnd(S) * tot;
  for (const k in weights) { r -= weights[k]; if (r < 0) return k; }
  return Object.keys(weights)[0];
}
/** Pick an item from arr using weightFn(item) → number. */
export function pickBy(S, arr, weightFn) {
  let tot = 0;
  const w = arr.map(x => { const v = Math.max(0, weightFn(x)); tot += v; return v; });
  if (tot <= 0) return arr[Math.floor(rnd(S) * arr.length)];
  let r = rnd(S) * tot;
  for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r < 0) return arr[i]; }
  return arr[arr.length - 1];
}
/** Poisson sample (Knuth) for small lambda. */
export function poisson(S, lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rnd(S); } while (p > L && k < 15);
  return k - 1;
}
