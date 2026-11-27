// Shared helpers for the Masa / Ceremony screens.
import { fmtMoney, store, useState, useEffect, reducedMotion } from '../../ui-kit.js';

/** Exact-ish euro text: €4.600 below a million, €1,25M above. */
export const eur = (v) => (Math.abs(v) >= 1e6 ? fmtMoney(v) : fmtMoney(v, { compact: false }));
export const FACE_MAP = { smile: 'smile', neutral: 'neutral', calm: 'neutral', frown: 'frown', angry: 'angry', furious: 'angry', stand: 'stand' };
export const faceOf = (f) => FACE_MAP[f] || 'neutral';

/** Where to go when a table / ceremony closes. */
export function afterTable() { store.ui.closeOverlay(); }

/** Typewriter reveal. Returns [shownText, restText, typing]. */
export function useTyped(text, speed = 16) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const full = String(text || '');
    if (reducedMotion()) { setN(full.length); return undefined; }
    setN(0);
    let i = 0;
    const t = setInterval(() => { i += 1; setN(i); if (i >= full.length) clearInterval(t); }, speed);
    return () => clearInterval(t);
  }, [text]);
  const full = String(text || '');
  return [full.slice(0, n), full.slice(n), n < full.length];
}

/** Count-up helper (own rAF, honours reduced motion). */
export function useCount(target, { delay = 0, duration = 900, on = true } = {}) {
  const [v, setV] = useState(reducedMotion() ? target : 0);
  useEffect(() => {
    if (!on) return undefined;
    if (reducedMotion()) { setV(target); return undefined; }
    let raf, to;
    to = setTimeout(() => {
      const t0 = performance.now();
      const step = (now) => { const k = Math.min(1, (now - t0) / duration); setV(target * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(to); cancelAnimationFrame(raf); };
  }, [target, on]);
  return v;
}
