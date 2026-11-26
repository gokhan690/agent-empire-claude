// Small pure helpers shared by engine modules. No state, no randomness.

/** Clamp v into [a,b]. */
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
/** Round to 1 decimal. */
export function r1(v) { return Math.round(v * 10) / 10; }
/** Round to 2 decimals. */
export function r2(v) { return Math.round(v * 100) / 100; }
/** Sum of numbers. */
export function sum(arr) { let s = 0; for (let i = 0; i < arr.length; i++) s += arr[i]; return s; }
/** Mean of numbers (0 for empty). */
export function mean(arr) { return arr.length ? sum(arr) / arr.length : 0; }
/** FNV-1a hash of a string → uint32 (deterministic, no RNG state touched). */
export function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** Deterministic float in [0,1) from a string (used for stable per-player offsets). */
export function hash01(s) { return hashStr(s) / 4294967296; }
/** Round a euro amount to a tidy value (nearest 1K above 20K, else 100). */
export function tidy(v) { return v >= 20000 ? Math.round(v / 1000) * 1000 : Math.round(v / 100) * 100; }

/** Standard "not implemented yet" Result returned by stubbed actions. */
export function notReady() { return { ok: false, error: 'Henüz hazır değil' }; }
