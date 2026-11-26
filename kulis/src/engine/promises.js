// Promises (Söz). Shape: {id, playerId, type:'minutes'|'transfer_up'|'wage'|'stay'|'visit', text, dueSeason, dueMonth,
//   status:'open'|'kept'|'broken', target?, from:{season,month,mins,md,prestige,clubId,wage}, half?:{a,b,needA,needB}}
import { BAL, MONTHS } from './constants.js';
import { uid } from './rng.js';
import { addRep } from './economy.js';
import { clamp, tidy } from './util.js';
import { fairWage } from './valuation.js';
import * as news from './news.js';
import { projectMinutes } from './selection.js';

export const PROMISE_TYPES = ['minutes', 'transfer_up', 'wage', 'stay', 'visit'];
export const PROMISE_LABELS = { minutes: 'Süre sözü', transfer_up: 'Üst lige transfer', wage: 'Maaş artışı', stay: 'Kulüpte kalma', visit: 'Düzenli ziyaret' };

function monthIdx(season, month) { return season * 12 + month; }
function dateText(season, month) { return MONTHS[month].name + ', ' + season + '. sezon'; }
function prestigeOf(S, p) { const c = S.clubs[p.clubId]; return c ? S.leagues[c.leagueId].prestige : 0; }
function mdOf(S, p) { const c = S.clubs[p.clubId]; return c ? S.leagues[c.leagueId].matchday : 0; }
const fmt = n => n.toLocaleString('tr-TR');

/** Does this player (as far as you can tell) want to stay where he is? Rooted traits count only once you know them. */
export function wantsStay(S, p) {
  if (!p.clubId) return false;
  const known = p.agentId === 'you' || p.know >= BAL.scout.traitKnow;
  if (known && (p.trait === 'sadik' || p.trait === 'ailebabasi')) return true;
  return p.st.sh >= BAL.promise.stayMinutes && !(known && (p.trait === 'hirsli' || p.trait === 'yildiz') && p.hype >= 60);
}

/**
 * Is a promise of `type` realistically keepable for `p` right now? `{keepable, blocked, note}`:
 * `blocked` = it cannot be kept at all (or must not be made), `note` = a short Turkish reason when not keepable.
 */
export function assess(S, p, type) {
  const P = BAL.promise;
  const pr = prestigeOf(S, p);
  switch (type) {
    case 'minutes': {
      if (!p.clubId) return { keepable: false, blocked: false, note: 'Kulübü yok; önce bir kulüp bulunmalı.' };
      const m = projectMinutes(S, p, p.clubId);
      return m >= BAL.sel.proj.starter ? { keepable: true, blocked: false, note: null } : { keepable: false, blocked: false, note: 'Şu an ilk 11\'de değil; süre sözünü tutmak için daha çok oynayacağı bir kulübe taşımalısın.' };
    }
    case 'transfer_up': {
      if (pr >= 5) return { keepable: false, blocked: true, note: 'Zaten en üst seviye ligde; üst lige transfer sözü verilemez.' };
      const next = BAL.strengthByPrestige[Math.min(5, pr + 1)];
      const suitor = S.interests.some(i => i.playerId === p.id && i.level >= 50 && S.clubs[i.clubId] && S.leagues[S.clubs[i.clubId].leagueId].prestige > pr);
      if (p.ca < next - P.transferUpReach && !suitor) return { keepable: false, blocked: false, note: 'Seviyesi bir üst lig için henüz yetersiz.' };
      if (p.ca < next - P.transferUpSure && !suitor) return { keepable: false, blocked: false, note: 'Üst ligden henüz ilgi yok; tutmak zor olabilir.' };
      return { keepable: true, blocked: false, note: null };
    }
    case 'wage': {
      if (!p.clubId) return { keepable: false, blocked: false, note: 'Kulübü yok.' };
      const due = dueFor(S, 'wage').dueSeason;
      // a raise needs a table: a renewal / pre-contract in the last contract year, or a transfer offer
      const table = p.contractEnd <= due;
      return table ? { keepable: true, blocked: false, note: null } : { keepable: false, blocked: false, note: 'Sözleşmesi daha uzun sürüyor; süre dolmadan masaya oturacağı bir yenileme görünmüyor.' };
    }
    case 'stay':
      return wantsStay(S, p) ? { keepable: true, blocked: false, note: null } : { keepable: false, blocked: true, note: 'Bu kulüpte kalmak istemiyor; kalma sözü verilemez.' };
    default: return { keepable: true, blocked: false, note: null };
  }
}

/**
 * Create an open promise.
 * @param {object} S
 * @param {{playerId:string,type:string,text?:string,dueSeason:number,dueMonth:number,target?:number}} spec
 * @returns {object} the promise
 */
export function add(S, spec) {
  const pr = { id: uid(S, 's'), status: 'open', text: '', dueMonth: 11, ...spec };
  if (!pr.from && S.players[pr.playerId]) pr.from = snapshot(S, S.players[pr.playerId]);
  if (pr.type === 'visit') visitSetup(S, pr);
  S.promises.push(pr);
  return pr;
}

function snapshot(S, p) {
  return { season: S.time.season, month: S.time.month, mins: p.st.mins, md: mdOf(S, p), prestige: prestigeOf(S, p), clubId: p.clubId, wage: p.wage };
}

/** Default due date for a promise type made now → {dueSeason, dueMonth}. */
export function dueFor(S, type) {
  const { season, month } = S.time;
  if (type === 'transfer_up' || type === 'wage') return { dueSeason: month <= 5 ? season : season + 1, dueMonth: 11 };
  return { dueSeason: month <= 8 ? season : season + 1, dueMonth: 11 };
}

/**
 * Build a promise spec (not yet stored) of `type` for player `p`, with a Turkish text and a default due date.
 * @param {object} S @param {object} p player @param {string} type @param {{target?:number}} [o]
 * @returns {{playerId:string,type:string,text:string,dueSeason:number,dueMonth:number,target?:number}}
 */
export function make(S, p, type, o = {}) {
  const due = dueFor(S, type);
  const d = dateText(due.dueSeason, due.dueMonth);
  const spec = { playerId: p.id, type, ...due, text: '' };
  switch (type) {
    case 'minutes': spec.target = BAL.promise.minutesShare; spec.text = `${d} sonuna kadar dakikalarının en az %${Math.round(spec.target * 100)}'ini oynayacak.`; break;
    case 'transfer_up': {
      const pr = prestigeOf(S, p);
      spec.target = pr + 1; spec.text = `${d} sonuna kadar daha üst seviye bir lige transfer edilecek.`; break;
    }
    case 'wage': {
      const c = S.clubs[p.clubId];
      const fair = fairWage(S, p, c ? c.leagueId : 'tr2');
      spec.target = o.target || tidy(Math.max(p.wage * BAL.promise.wageMult, fair * BAL.promise.wageFairMult));
      spec.text = `${d} sonuna kadar aylık maaşı en az €${fmt(spec.target)} olacak.`; break;
    }
    case 'stay': spec.text = `${d} sonuna kadar şu anki kulübünden transfer edilmeyecek.`; break;
    case 'visit': spec.text = 'Her yarı sezonda en az bir kez ziyaretine gidilecek.'; break;
    default: throw new Error('unknown promise type ' + type);
  }
  return spec;
}

/** A visit happened: counts for open `visit` promises (half-season tracking). */
export function noteVisit(S, playerId) {
  const half = S.time.month <= 5 ? 'a' : 'b';
  for (const pr of S.promises) if (pr.status === 'open' && pr.playerId === playerId && pr.type === 'visit' && pr.half) pr.half[half] = true;
}

function visitSetup(S, pr) {
  // halves still ahead of (or including) the creation month need a visit
  const m = pr.from ? pr.from.month : 0;
  pr.half = { a: false, b: false, needA: m <= 5, needB: true };
}

function resolve(S, pr, p, status, out) {
  const P = BAL.promise, A = S.agency;
  pr.status = status; pr.resolved = monthIdx(S.time.season, S.time.month);
  const e = { type: 'promise', id: pr.id, playerId: p.id, status, promiseType: pr.type, text: pr.text };
  if (status === 'kept') {
    p.loyalty = clamp(p.loyalty + P.kept.loyalty, 0, 100); p.morale = clamp(p.morale + P.kept.morale, 0, 100);
    addRep(S, P.kept.rep); A.stats.promisesKept++;
  } else {
    p.loyalty = clamp(p.loyalty + P.broken.loyalty, 0, 100); p.morale = clamp(p.morale + P.broken.morale, 0, 100);
    A.rep = clamp(A.rep + P.broken.rep, 0, 100); A.stats.promisesBroken++;
  }
  out.push(e);
  if (status === 'broken' && (p.trait === 'hirsli' || p.trait === 'yildiz') && p.loyalty < P.walkoutLoyalty) {
    p.agentId = null; p.rep = null; p.loyalty = 30;
    S.promises = S.promises.filter(q => q.playerId !== p.id || q.status !== 'open');
    news.push(S, { kind: 'walkout', playerId: p.id, text: `${p.name}, verilen sözlerin tutulmaması üzerine menajerinden ayrıldı.` });
    out.push({ type: 'walkout', playerId: p.id, name: p.name });
  }
}

/**
 * Monthly check (turn step 6): evaluate open promises. Kept: loyalty +15, rep +2, stats.promisesKept++;
 * broken: loyalty −25, rep −3, stats.promisesBroken++, a hirsli/yildiz client whose loyalty falls under 25 walks out.
 * @param {object} S
 * @returns {object[]} `[{type:'promise', id, playerId, status, promiseType, text}, {type:'walkout', playerId, name}]`
 */
export function check(S) {
  const out = [];
  const { season, month } = S.time;
  const now = monthIdx(season, month);
  for (const pr of S.promises.slice()) {
    if (pr.status !== 'open') continue;
    const p = S.players[pr.playerId];
    if (!p || p.agentId !== 'you') { S.promises.splice(S.promises.indexOf(pr), 1); continue; }
    const due = now >= monthIdx(pr.dueSeason, pr.dueMonth);
    switch (pr.type) {
      case 'transfer_up':
        if (prestigeOf(S, p) >= pr.target) resolve(S, pr, p, 'kept', out);
        else if (due) resolve(S, pr, p, 'broken', out);
        break;
      case 'wage':
        if (p.wage >= pr.target) resolve(S, pr, p, 'kept', out);
        else if (due) resolve(S, pr, p, 'broken', out);
        break;
      case 'stay':
        if (pr.moved || (p.clubId && p.clubId !== pr.from.clubId)) resolve(S, pr, p, 'broken', out);
        else if (due) resolve(S, pr, p, 'kept', out);
        break;
      case 'minutes':
        if (due) resolve(S, pr, p, minutesKept(S, pr, p) ? 'kept' : 'broken', out);
        break;
      case 'visit': {
        if (!pr.half) visitSetup(S, pr);
        const h = pr.half;
        if (month === 5 && season === pr.from.season && h.needA && !h.a && now < monthIdx(pr.dueSeason, pr.dueMonth)) { resolve(S, pr, p, 'broken', out); break; }
        if (due) resolve(S, pr, p, ((!h.needA || h.a) && (!h.needB || h.b)) ? 'kept' : 'broken', out);
        break;
      }
      default: break;
    }
  }
  // prune old resolved promises
  S.promises = S.promises.filter(pr => pr.status === 'open' || now - (pr.resolved || now) <= BAL.promise.keepMonths);
  return out;
}

/**
 * A client changed club. `arranged` = you made the move (a transfer / pre-contract); otherwise the club or the market did.
 * - `stay`: an arranged move breaks it; a forced move voids it (it was not your doing).
 * - `minutes`: when the new club offers more expected minutes (`newM` > `oldM`) the evaluation window restarts from now.
 */
export function onMove(S, p, oldM, newM, arranged) {
  for (const pr of S.promises.slice()) {
    if (pr.playerId !== p.id || pr.status !== 'open') continue;
    if (pr.type === 'stay') {
      if (arranged) pr.moved = true;
      else S.promises.splice(S.promises.indexOf(pr), 1);
    } else if (pr.type === 'minutes' && newM > oldM + 1e-9) {
      pr.from = snapshot(S, p);
      pr.restarted = { season: S.time.season, month: S.time.month };
    }
  }
}

/** The promise type that suits this player's trait AND is keepable now (cards that offer "give your word" use it). */
export function suggest(S, p) {
  const want = p.trait === 'paraci' ? 'wage' : p.trait === 'sadik' || p.trait === 'ailebabasi' ? 'visit' : 'minutes';
  return assess(S, p, want).keepable ? want : 'visit';
}

/** For a table: which open promises of this player would the package keep / break. `[{id,type,text,ok,note}]`. */
export function checksFor(S, p, pkg) {
  const out = [];
  for (const pr of forPlayer(S, p.id)) {
    if (pr.type === 'wage') out.push({ id: pr.id, type: pr.type, text: pr.text, ok: pkg.wage >= pr.target, note: pkg.wage >= pr.target ? 'Maaş sözünü tutar' : 'Maaş sözünün altında (€' + fmt(pr.target) + ' gerekir)' });
    else if (pr.type === 'stay') out.push({ id: pr.id, type: pr.type, text: pr.text, ok: false, note: 'Kalma sözünü bozar' });
  }
  return out;
}

/** Open `stay` promise of a player (or null). */
export function stayPromise(S, playerId) { return S.promises.find(x => x.playerId === playerId && x.status === 'open' && x.type === 'stay') || null; }

/** Share of minutes over the promise period (0..1). */
export function minutesProgress(S, pr, p) {
  const f = pr.from || { season: S.time.season, mins: 0, md: 0 };
  const baseMins = f.season === S.time.season ? f.mins : 0, baseMd = f.season === S.time.season ? f.md : 0;
  const md = mdOf(S, p);
  const window = md - baseMd;
  if (window < BAL.promise.minWindow) return md > 0 ? clamp(p.st.mins / (md * 90), 0, 1) : p.st.sh;
  return clamp((p.st.mins - baseMins) / (window * 90), 0, 1);
}
function minutesKept(S, pr, p) { return minutesProgress(S, pr, p) >= pr.target; }

/**
 * Open promises of a player.
 * @param {object} S @param {string} playerId @returns {object[]}
 */
export function forPlayer(S, playerId) { return S.promises.filter(p => p.playerId === playerId && p.status === 'open'); }

/** Current progress of an open promise for the UI: `{value, target, text}` (value/target numbers; text Turkish). */
export function progressOf(S, pr) {
  const p = S.players[pr.playerId];
  if (!p) return { value: 0, target: 1, text: '' };
  switch (pr.type) {
    case 'minutes': { const v = minutesProgress(S, pr, p); return { value: Math.round(v * 100), target: Math.round(pr.target * 100), text: `Dakika payı %${Math.round(v * 100)} / %${Math.round(pr.target * 100)}` }; }
    case 'wage': return { value: p.wage, target: pr.target, text: `Maaş €${fmt(p.wage)} / €${fmt(pr.target)}` };
    case 'transfer_up': return { value: prestigeOf(S, p), target: pr.target, text: `Lig seviyesi ${prestigeOf(S, p)} / ${pr.target}` };
    case 'stay': { const gone = pr.moved || (p.clubId && p.clubId !== pr.from.clubId); return { value: gone ? 0 : 1, target: 1, text: gone ? 'Kulüp değiştirdi' : 'Kulübünde' }; }
    default: { const h = pr.half || {}; return { value: (h.a ? 1 : 0) + (h.b ? 1 : 0), target: (h.needA ? 1 : 0) + 1, text: `Ziyaret: ${h.a ? 'ilk yarı ✓' : 'ilk yarı –'} ${h.b ? 'ikinci yarı ✓' : 'ikinci yarı –'}` }; }
  }
}
