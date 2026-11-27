// One auto-assigned goal per season (no picking). S.goal = {kind, target, title, status:'active'|'done'|'failed', reward:{rep,cash}, base:{commission,deals}}.
import { BAL } from './constants.js';
import { tidy } from './util.js';
import { earn, addRep } from './economy.js';
import { myClients, monthlyCommission } from './selectors.js';
import * as news from './news.js';

const fmt = n => Math.round(n).toLocaleString('tr-TR');
const rankOf = S => { const i = S.ranking.findIndex(r => r.id === 'you'); return i < 0 ? S.ranking.length : i + 1; };

/** The goal of a season (1-based), deterministic from the state. */
function make(S) {
  const season = S.time.season;
  const kinds = ['deals', 'clients', 'deals', 'commission', 'rank'];
  const kind = kinds[(season - 1) % kinds.length];
  if (kind === 'deals') { const n = season <= 1 ? 1 : 2; return { kind, target: n, title: n === 1 ? 'Bu sezon bir oyuncu sat' : 'Bu sezon ' + n + ' oyuncu sat' }; }
  if (kind === 'clients') { const n = Math.max(5, myClients(S).length + 1); return { kind, target: n, title: n + ' müşteriye ulaş' }; }
  if (kind === 'commission') { const t = tidy(Math.max(100000, 12 * monthlyCommission(S) + 60000)); return { kind, target: t, title: '€' + fmt(t) + ' komisyon kazan' }; }
  return { kind: 'rank', target: 2, title: 'Sezonu ilk 2 ajansın arasında bitir' };
}

/** Assign the season's goal (call at the start of a season). */
export function assign(S) {
  const g = make(S);
  S.goal = { ...g, status: 'active', reward: { ...BAL.goal.reward }, base: { commission: S.agency.stats.commission, deals: S.agency.stats.deals }, season: S.time.season };
}

function progress(S, g) {
  switch (g.kind) {
    case 'deals': return S.agency.stats.deals - g.base.deals;
    case 'clients': return myClients(S).length;
    case 'commission': return S.agency.stats.commission - g.base.commission;
    default: return rankOf(S) <= g.target ? 1 : 0;
  }
}

/** Current goal for the hub: {title, progress, target, status, reward} or null. */
export function status(S) {
  const g = S.goal;
  if (!g) return null;
  return { title: g.title, kind: g.kind, progress: Math.min(g.target, Math.round(progress(S, g))), target: g.target, status: g.status, reward: { ...g.reward } };
}

/** Monthly check: completing the goal pays the reward at once; at the season's last month an open goal is marked failed (no penalty). */
export function check(S) {
  const g = S.goal;
  if (!g || g.status !== 'active') return [];
  const done = g.kind === 'rank' ? S.time.month === 11 && progress(S, g) >= 1 : progress(S, g) >= g.target;
  if (done) {
    g.status = 'done';
    earn(S, g.reward.cash, 'goal', 'Sezon hedefi');
    addRep(S, g.reward.rep);
    news.push(S, { kind: 'goal', text: 'Hedef tamam: ' + g.title });
    return [{ type: 'goal', status: 'done', title: g.title, reward: { ...g.reward } }];
  }
  if (S.time.month === 11) { g.status = 'failed'; return [{ type: 'goal', status: 'failed', title: g.title }]; }
  return [];
}
