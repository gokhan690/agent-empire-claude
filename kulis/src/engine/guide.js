// The guide: at most 3 short cards on the hub. S.flags.guide = {search, pitch, deal, skipped}; the card shown is the first open step.
const STEPS = [
  { id: 'search', title: 'Oyuncu bul', text: 'Oyuncular sekmesinde "Oyuncu ara"ya bas, beğendiğini imzala.' },
  { id: 'pitch', title: 'Kulüp bul', text: 'Müşterini bir kulübe öner. İlgilenirse Piyasa\'da teklif belirir.' },
  { id: 'deal', title: 'Masaya otur', text: 'Maaş ve komisyonu ayarla. Kabul şansı yüksekse teklif et.' },
];

/** Start the guide (new game). */
export function start(S) { S.flags.guide = { search: false, pitch: false, deal: false, skipped: false }; }

/** Update progress after a successful action. */
export function onAction(S, actionId, res) {
  const g = S.flags.guide;
  if (!g) return;
  if (actionId === 'searchPlayers') g.search = true;
  else if (actionId === 'pitchPlayer') g.pitch = true;
  else if ((actionId === 'negPropose' || actionId === 'negAcceptCounter') && res.outcome === 'accepted') g.deal = true;
}

/** The open guide card `{step, title, text, index, total}` or null. */
export function current(S) {
  const g = S.flags.guide;
  if (!g || g.skipped) return null;
  const i = STEPS.findIndex(s => !g[s.id]);
  if (i < 0) return null;
  return { step: STEPS[i].id, title: STEPS[i].title, text: STEPS[i].text, index: i + 1, total: STEPS.length };
}

/** Skip the rest of the guide. */
export function skip(S) { if (S.flags.guide) S.flags.guide.skipped = true; return { ok: true, events: [] }; }
