// Small helpers shared by screens and sheets.
import { useState, useEffect, store, openSheet } from '../ui-kit.js';

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
export const openAgency = () => openSheet('AgencySheet');

export const downloadText = (name, text) => {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch { return false; }
};

/** Open the Masa for an offer (1 energy). Returns true when the table opened. */
export function sitAtTable(interestId) {
  const r = store.act('openNegotiation', { interestId });
  if (r.ok) store.ui.openOverlay('Negotiation', {});
  return r.ok;
}
