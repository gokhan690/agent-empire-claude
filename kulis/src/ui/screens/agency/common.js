// Shared helpers for the Agency screen and the SeasonEnd / Ending overlays.
import { html, useState, useEffect, Crest, store, openSheet, cx } from '../../ui-kit.js';

/** false on first render, true shortly after mount — drives CSS grow-in transitions. */
export function useGrow(delay = 40) {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOn(true), delay); return () => clearTimeout(t); }, []);
  return on;
}

export const clubOf = (id) => (store.S && store.S.clubs[id]) || null;
export const playerOf = (id) => (store.S && store.S.players[id]) || null;
export const openPlayer = (playerId) => { if (playerOf(playerId)) openSheet('PlayerSheet', { playerId }); };
export const openClub = (clubId) => { if (clubOf(clubId)) openSheet('ClubSheet', { clubId }); };

/** Crest + club name (optionally tappable). */
export function ClubTag({ id, size = 18, tap = false, class: cls }) {
  const c = clubOf(id);
  if (!c) return html`<span class=${cx('club-tag', cls)}>—</span>`;
  const inner = html`<${Crest} colors=${c.colors} pattern=${c.crest} size=${size} /><span>${c.name}</span>`;
  return tap ? html`<button type="button" class=${cx('club-tag club-tag--tap', cls)} onClick=${() => openClub(id)}>${inner}</button>`
    : html`<span class=${cx('club-tag', cls)}>${inner}</span>`;
}

export const monthLabel = (S, month) => ['Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran'][month] || '';

/** Fire confetti from the centre of an element. */
export function burstFrom(el, confetti, opts = {}) {
  try {
    const r = el.getBoundingClientRect();
    confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 90, power: 9, ...opts });
  } catch { /* ignore */ }
}

export const downloadText = (name, text) => {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch { return false; }
};
