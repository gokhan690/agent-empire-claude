// Clients: signing, release, monthly mood drift, leaving. Representation: p.agentId = 'you'; you earn BAL.start.commissionPct of his wage monthly.
import { BAL } from './constants.js';
import { clamp, r1 } from './util.js';
import { spendEnergy } from './economy.js';
import { fairWage } from './valuation.js';
import { myClients, monthIndex, repNeeded } from './selectors.js';
import * as news from './news.js';

/** @typedef {{ok:true,events:object[],[k:string]:any}|{ok:false,error:string}} Result */

/** Why you cannot sign this player right now (Turkish) or null. */
export function signBlock(S, p) {
  if (!p) return 'Oyuncu bulunamadı';
  if (p.agentId === 'you') return 'Zaten müşterin';
  if (p.agentId) return 'Başka bir menajerle çalışıyor';
  if (!p.seen) return 'Önce bu oyuncuyu bulmalısın';
  const need = repNeeded(p);
  if (S.agency.rep < need) return 'İtibarın yetmiyor (gereken: ' + need + ')';
  return null;
}

/**
 * "İmzala": 1 energy; works when your reputation is high enough (no dice).
 * @param {object} S
 * @param {{playerId:string}} a
 * @returns {Result}
 */
export function sign(S, a) {
  const p = a && S.players[a.playerId];
  const err = signBlock(S, p);
  if (err) return { ok: false, error: err };
  if (S.agency.energy < 1) return { ok: false, error: 'Enerjin yok' };
  spendEnergy(S, 1);
  p.agentId = 'you';
  p.mood = Math.max(p.mood, BAL.start.clientMood - 5);
  p.know = Math.max(p.know, 60);
  p.signed = { idx: monthIndex(S) };
  S.found = S.found.filter(x => x !== p.id);
  news.push(S, { kind: 'signing', playerId: p.id, text: `${p.name}, ${S.meta.agencyName} ile anlaştı.` });
  return { ok: true, events: [{ type: 'signed', playerId: p.id }] };
}

/** Let a client go. */
export function release(S, a) {
  const p = a && S.players[a.playerId];
  if (!p || p.agentId !== 'you') return { ok: false, error: 'Bu oyuncu müşterin değil' };
  p.agentId = null;
  S.interests = S.interests.filter(i => i.playerId !== p.id);
  news.push(S, { kind: 'release', playerId: p.id, text: `${S.meta.agencyName}, ${p.name} ile yollarını ayırdı.` });
  return { ok: true, events: [{ type: 'released', playerId: p.id }] };
}

/** Word for a mood value. */
export function moodWord(v) { return v >= 60 ? 'İyi' : v >= 35 ? 'Orta' : 'Kötü'; }

function driftOne(S, p) {
  const D = BAL.mood;
  const fair = fairWage(S, p, p.clubId ? S.clubs[p.clubId].leagueId : 'tr2');
  const ratio = p.wage / fair;
  let dm = (D.target - p.mood) * D.regress + p.form * D.form;
  if (!p.injured && p.clubId) dm += clamp((p.st.sh - D.minutesRef) * D.minK, D.minMin, D.minMax);
  else if (p.injured) dm += D.injured;
  if (ratio < D.wageLow) dm -= 1; else if (ratio > D.wageHigh) dm += 1;
  p.mood = r1(clamp(p.mood + dm, 0, 100));
}

/**
 * Monthly: mood drifts with minutes, form and wage; a client with a very low mood leaves you.
 * @returns {object[]} UI events
 */
export function monthly(S) {
  const out = [];
  for (const p of myClients(S)) driftOne(S, p);
  for (const p of myClients(S)) {
    if (p.mood <= BAL.mood.leave) {
      p.agentId = null;
      S.interests = S.interests.filter(i => i.playerId !== p.id);
      news.push(S, { kind: 'clientLeft', playerId: p.id, text: `${p.name}, mutsuz olup ${S.meta.agencyName} ile yollarını ayırdı.` });
      out.push({ type: 'clientLeft', playerId: p.id, name: p.name });
    }
  }
  return out;
}
