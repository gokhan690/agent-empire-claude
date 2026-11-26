// Phase 2b — Son Gün (deadline day): hours 18..23, one action per hour (two at network L4).
// State: S.deadline (null when inactive) = {hour, actionsLeft, actionsMax, calls:[{id, clubId, playerId, expiresHour,
// fromHour, level, taken}], log:[{hour, kind, text}], deals, ended}. turn.advanceMonth calls start(); the UI drives
// takeCall / open (negotiation) / pitch / skipHour and finally finish().
import { BAL, MONTHS } from './constants.js';
import { rint, uid, pickBy } from './rng.js';
import { clamp, hash01 } from './util.js';
import { clubStrength } from './selection.js';
import { myClients } from './selectors.js';
import * as market from './market.js';
import { openTable } from './negotiation.js';

/** @typedef {{ok:true,events:object[],[k:string]:any}|{ok:false,error:string}} Result */
const fail = error => ({ ok: false, error });

function newCalls(S) {
  const D = BAL.deadline;
  const cands = [];
  const season = S.time.season;
  for (const p of myClients(S)) {
    if (p.preContract) continue;
    for (const cid in S.clubs) {
      const club = S.clubs[cid];
      if (cid === p.clubId) continue;
      const nl = market.needLevel(club, p.pos);
      if (nl < D.minLevel) continue;
      const ex = S.interests.find(i => i.playerId === p.id && i.clubId === cid);
      if (ex && ex.cooldown > 0) continue;
      const kind = market.kindFor(S, p, club);
      if (kind === 'free' && p.clubId && p.contractEnd !== season) continue;
      const A = clubStrength(S, cid);
      const target = market.interestTarget(S, p, club, A, kind);
      const lvl = ex ? ex.level : 0;
      if (Math.max(target, lvl) < 40) continue;
      cands.push({ p, club, nl, score: nl * 20 + Math.max(target, lvl) + hash01(p.id + cid + season) * 5 });
    }
  }
  cands.sort((a, b) => b.score - a.score || (a.club.id < b.club.id ? -1 : 1));
  const perPlayer = {};
  const out = [];
  for (const c of cands) {
    if (out.length >= D.maxCalls) break;
    if ((perPlayer[c.p.id] || 0) >= 2) continue;
    perPlayer[c.p.id] = (perPlayer[c.p.id] || 0) + 1;
    out.push(c);
  }
  return out.map((c, i) => {
    const fromHour = i === 0 ? D.hours[0] : rint(S, D.hours[0], D.hours[1] - 1);
    const expiresHour = Math.min(D.hours[1], fromHour + rint(S, D.callLen[0], D.callLen[1]));
    return { id: uid(S, 'k'), clubId: c.club.id, playerId: c.p.id, fromHour, expiresHour, level: c.nl, taken: false };
  });
}

/**
 * Start Son Gün for the current month (Ağustos/Ocak). Builds panic calls from clubs with an unfilled need bidding
 * for your clients. Returns false (S.deadline stays null) when there is nothing to do.
 * turn.js sets S.time.phase='deadline' when this returns true.
 * @param {object} S
 * @returns {boolean} started
 */
export function start(S) {
  if (!MONTHS[S.time.month].deadline) return false;
  if (!myClients(S).length) return false;
  const calls = newCalls(S);
  const openable = S.interests.some(i => i.level >= BAL.neg.minLevel && i.cooldown <= 0 && S.players[i.playerId] && S.players[i.playerId].agentId === 'you' && i.kind === 'transfer');
  if (!calls.length && !openable) return false;
  const max = S.agency.upgrades.network >= 4 ? 2 : 1;
  S.deadline = { hour: BAL.deadline.hours[0], actionsLeft: max, actionsMax: max, calls, log: [{ hour: BAL.deadline.hours[0], kind: 'start', text: 'Son Gün başladı. Telefonlar susmuyor.' }], deals: 0, ended: false };
  return true;
}

/** Move the clock to the next hour (or midnight → `ended`). */
export function advanceHour(S) {
  const dl = S.deadline;
  if (!dl || dl.ended) return [];
  if (dl.hour >= BAL.deadline.hours[1]) {
    dl.ended = true; dl.actionsLeft = 0;
    dl.log.push({ hour: dl.hour, kind: 'midnight', text: 'Gece yarısı. Transfer dönemi kapandı.' });
    return [{ type: 'deadlineHour', hour: 24, midnight: true }];
  }
  dl.hour++;
  dl.actionsLeft = dl.actionsMax;
  const incoming = dl.calls.filter(c => !c.taken && c.fromHour === dl.hour).length;
  dl.log.push({ hour: dl.hour, kind: 'hour', text: incoming ? incoming + ' yeni arama var.' : 'Saat ' + dl.hour + ':00' });
  return [{ type: 'deadlineHour', hour: dl.hour, midnight: false, incoming }];
}

/** Spend one action of the current hour; the hour advances when none are left. Used by takeCall, pitch and negotiation.open. */
export function useAction(S) {
  const dl = S.deadline;
  if (!dl) return [];
  dl.actionsLeft = Math.max(0, dl.actionsLeft - 1);
  return dl.actionsLeft <= 0 ? advanceHour(S) : [];
}

function check(S) {
  const dl = S.deadline;
  if (!dl || S.time.phase !== 'deadline') return 'Son Gün aktif değil';
  if (dl.ended) return 'Gece yarısı geçti';
  return null;
}

/**
 * Take an incoming call: opens a quick table (patience −1, K +10/17/25% by the club's need, `songun` Koz in hand)
 * and spends the hour's action. The table stays open even if the hour rolls over.
 * @param {object} S
 * @param {{callId:string}} a
 * @returns {Result}
 */
export function takeCall(S, a) {
  const e = check(S);
  if (e) return fail(e);
  const dl = S.deadline;
  if (S.negotiation) return fail('Önce açık masayı kapat');
  if (dl.actionsLeft <= 0) return fail('Bu saatin hakkı bitti');
  const c = dl.calls.find(x => x.id === (a && a.callId));
  if (!c) return fail('Arama bulunamadı');
  if (c.taken) return fail('Bu aramayı zaten açtın');
  if (c.fromHour > dl.hour) return fail('Bu arama henüz gelmedi');
  if (c.expiresHour < dl.hour) return fail('Arama kaçtı');
  const p = S.players[c.playerId];
  if (!p || p.agentId !== 'you') return fail('Oyuncu artık müşterin değil');
  let it = S.interests.find(i => i.playerId === c.playerId && i.clubId === c.clubId);
  if (!it) {
    it = { id: uid(S, 'i'), playerId: c.playerId, clubId: c.clubId, level: BAL.neg.minLevel, kind: market.kindFor(S, p, S.clubs[c.clubId]), cooldown: 0, boost: 0 };
    S.interests.push(it);
  }
  if (it.cooldown > 0) return fail('Direktör küs');
  it.level = Math.max(it.level, BAL.neg.minLevel);
  it.kind = market.kindFor(S, p, S.clubs[c.clubId]);
  const D = BAL.deadline;
  const r = openTable(S, { interestId: it.id }, { free: true, kBoost: D.kBoost[c.level] || 0, patiencePenalty: D.patiencePenalty, deadline: { callId: c.id, level: c.level } });
  if (!r.ok) return r;
  c.taken = true;
  dl.log.push({ hour: dl.hour, kind: 'call', text: S.clubs[c.clubId].name + ' aradı: ' + p.name, callId: c.id });
  r.events.push(...useAction(S));
  return r;
}

/**
 * Skip the current hour (any remaining actions of the hour are forfeited).
 * @param {object} S
 * @returns {Result}
 */
export function skipHour(S) {
  const e = check(S);
  if (e) return fail(e);
  if (S.negotiation) return fail('Önce açık masayı kapat');
  const dl = S.deadline;
  dl.log.push({ hour: dl.hour, kind: 'skip', text: 'Saat boş geçti.' });
  return { ok: true, events: advanceHour(S) };
}

/**
 * Midnight: collapse open talks and unanswered calls, S.deadline=null, S.time.phase='plan',
 * S.flags.deadlineDone = `${season}:${month}` so advance() proceeds with the month simulation.
 * @param {object} S
 * @returns {Result}
 */
export function finish(S) {
  const events = [];
  const dl = S.deadline;
  let missed = 0;
  if (S.negotiation && S.negotiation.deadline) {
    S.negotiation = null;
    events.push({ type: 'negotiationCollapsed' });
  }
  if (dl) {
    for (const c of dl.calls) {
      if (c.taken) continue;
      missed++;
      const it = S.interests.find(i => i.playerId === c.playerId && i.clubId === c.clubId);
      if (it) it.level = clamp(it.level + BAL.deadline.missedInterest, 0, 100);
    }
  }
  const deals = dl ? dl.deals || 0 : 0;
  S.deadline = null;
  S.time.phase = 'plan';
  S.flags.deadlineDone = S.time.season + ':' + S.time.month;
  events.push({ type: 'deadlineEnd', deals, missed });
  return { ok: true, events };
}
