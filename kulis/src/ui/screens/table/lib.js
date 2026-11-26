// Shared helpers for the Masa / Ceremony / Deadline screens (private to agent U-C).
import { fmtMoney, store, useState, useEffect, reducedMotion } from '../../ui-kit.js';

/** Exact-ish euro text: €4.600 below a million, €1,25M above. */
export const eur = (v) => (Math.abs(v) >= 1e6 ? fmtMoney(v) : fmtMoney(v, { compact: false }));
export const KIND_LABEL = { transfer: 'Transfer', free: 'Bedelsiz', renewal: 'Uzatma' };
export const FACE_MAP = { smile: 'smile', neutral: 'neutral', calm: 'neutral', frown: 'frown', angry: 'angry', furious: 'angry', stand: 'stand' };
export const faceOf = (f) => FACE_MAP[f] || 'neutral';
export const TELL_WORDS = ['Çok yakın', 'Yakın', 'Mesafe var', 'Uzak', 'Çok uzak'];
export const KOZ_ICON = { rakip: 'users', formda: 'trendUp', taraftar: 'flame', sozlesme: 'pen', dostluk: 'handshake', songun: 'clock', blof: 'dice' };
export const LOCATIVE = { Temmuz: "Temmuz'da", Ağustos: "Ağustos'ta", Ocak: "Ocak'ta" };
/** Turkish dative suffix for "HH:00'a/e kadar" (hours 18..23). */
export const HOUR_DAT = { 18: 'e', 19: 'a', 20: 'ye', 21: 'e', 22: 'ye', 23: 'e' };
export const hourUntil = (h) => (h >= 24 ? 'Gece yarısına kadar' : `${h}:00'${HOUR_DAT[h] || 'e'} kadar`);

/** Where to go when a table / ceremony closes: back to Son Gün if it is still running, otherwise just close. */
export function afterTable() {
  const S = store.S;
  if (S && S.time.phase === 'deadline' && S.deadline) store.ui.openOverlay('Deadline', {});
  else store.ui.closeOverlay();
}

// ---- first-time coach tips (localStorage, always try/catch) ----
const TIPS_KEY = 'kulis-table-tips-v1';
export const tipsSeen = () => { try { return JSON.parse(localStorage.getItem(TIPS_KEY) || '[]'); } catch { return []; } };
export const tipSeen = (id) => { try { const a = tipsSeen(); if (!a.includes(id)) localStorage.setItem(TIPS_KEY, JSON.stringify([...a, id])); } catch {} };

/** Typewriter reveal. Returns [shownText, restText]. */
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
