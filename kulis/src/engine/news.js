// News feed. `push` is functional (used by engine); headline generation is phase 2c (data/news.js).
import { BAL } from './constants.js';
import { newsText } from './data/news.js';

/**
 * Add a news item (newest first, capped at BAL.limits.newsMax).
 * @param {object} S
 * @param {{kind?:string, text?:string, playerId?:string|null, clubId?:string|null, ctx?:object}} n if text is missing it is generated from kind+ctx
 * @returns {object} the item
 */
export function push(S, n) {
  const kind = n.kind || 'genel';
  const item = { season: S.time.season, month: S.time.month, kind, text: n.text || newsText(kind, n.ctx || {}), playerId: n.playerId || null, clubId: n.clubId || null };
  S.news.unshift(item);
  if (S.news.length > BAL.limits.newsMax) S.news.length = BAL.limits.newsMax;
  return item;
}
