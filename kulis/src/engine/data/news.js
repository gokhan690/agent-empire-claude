// News headline templates (phase 2c extends). `newsText(kind, ctx)` returns a Turkish headline.
// Foundation uses kinds: champion, promoted, relegated, retire, topscorer, genel.
const T = {
  champion: c => `${c.club} ${c.league} şampiyonu oldu!`,
  promoted: c => `${c.club} ${c.league} için yükseldi.`,
  relegated: c => `${c.club} ${c.league} ligine düştü.`,
  retire: c => `${c.name} futbola veda etti.`,
  topscorer: c => `${c.name} ${c.league} gol kralı oldu (${c.goals} gol).`,
  genel: c => c.text || 'Futbol dünyasından haberler.',
};
/** @param {string} kind @param {object} ctx @returns {string} */
export function newsText(kind, ctx) { return (T[kind] || T.genel)(ctx || {}); }
export const NEWS_TEMPLATES = T;
