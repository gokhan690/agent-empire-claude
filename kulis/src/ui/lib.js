/**
 * KULİS UI lib — shared helpers + Preact/htm re-exports.
 *
 * Vendored runtime: src/ui/vendor/preact-htm.js (Preact 10 + htm 3, "standalone" build).
 * It exports ONLY:
 *   h, html, render, Component, createContext,
 *   useState, useReducer, useEffect, useLayoutEffect, useRef,
 *   useImperativeHandle, useMemo, useCallback, useContext, useDebugValue, useErrorBoundary
 * (No Fragment/cloneElement/memo. Use `html` with multiple root nodes — htm returns an array — or a wrapper div.)
 * Always import these from './lib.js' (or '../lib.js'), never from the vendor file directly.
 */
export {
  h, html, render, Component, createContext,
  useState, useReducer, useEffect, useLayoutEffect, useRef,
  useImperativeHandle, useMemo, useCallback, useContext, useDebugValue, useErrorBoundary,
} from './vendor/preact-htm.js';

/** Join class names, skipping falsy values. */
export const cx = (...a) => a.flat(3).filter(Boolean).join(' ');
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** Turkish month names, index 0 = Temmuz (season starts in July). */
export const MONTH_NAMES = ['Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran'];

/** FNV-1a 32-bit hash of any string. */
export function hash32(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
/** Small deterministic PRNG (UI cosmetics only — never game logic). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const trimZeros = (s) => s.replace(/\.?0+$/, '').replace('.', ',');
/**
 * Format euros, Turkish style. 1_250_000 -> "€1,25M", 450_000 -> "€450K", 4_000 -> "€4K", 850 -> "€850".
 * opts: { sign: true => "+€…" for positives, compact: false => "€1.250.000" }
 */
export function fmtMoney(n, opts = {}) {
  const { sign = false, compact = true } = opts;
  n = Math.round(Number(n) || 0);
  const a = Math.abs(n);
  let s;
  if (!compact) s = a.toLocaleString('tr-TR');
  else if (a >= 1e6) { const v = a / 1e6; s = trimZeros(v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + 'M'; }
  else if (a >= 1e4) s = Math.round(a / 1e3) + 'K';
  else if (a >= 1e3) s = trimZeros((a / 1e3).toFixed(1)) + 'K';
  else s = String(a);
  return (n < 0 ? '−' : sign && n > 0 ? '+' : '') + '€' + s;
}
export const fmtInt = (n) => Math.round(Number(n) || 0).toLocaleString('tr-TR');
export const fmtSigned = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(Math.round(n));

/** prefers-reduced-motion check (safe outside browsers). */
export const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};
