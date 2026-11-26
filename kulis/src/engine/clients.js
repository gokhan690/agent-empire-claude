// Clients: recruiting, visits, loyalty/morale drift, dreams, representation-contract renewals.
// Representation contract: p.agentId='you', p.rep={commissionPct 5..10, endSeason}.
import { BAL, MONTHS, TRAITS, DREAMS } from './constants.js';
import { clamp, tidy, r1 } from './util.js';
import { spendEnergy } from './economy.js';
import { fairWage } from './valuation.js';
import { myClients, prospectLevel, isRecruitable, upgradeEffects, monthIndex, tableSorted } from './selectors.js';
import * as promises from './promises.js';
import * as events from './events.js';
import * as news from './news.js';

/** @typedef {{ok:true,events:object[],[k:string]:any}|{ok:false,error:string}} Result */

const fmt = n => Math.round(n).toLocaleString('tr-TR');

function leagueIdOf(S, p) { const c = S.clubs[p.clubId]; return c ? c.leagueId : 'tr2'; }
function prestigeOf(S, p) { const c = S.clubs[p.clubId]; return c ? S.leagues[c.leagueId].prestige : 1; }

/** How much a promise type adds to the recruit score for this player (trait fit multiplies). */
export function promiseValue(p, type) {
  const R = BAL.recruit;
  const fit = R.fit[type].includes(p.trait);
  return Math.round(R.promiseAdd * (fit ? R.promiseFit : R.promiseOffFit));
}

/** Score threshold to sign player `p` (deterministic). */
export function recruitThreshold(S, p) {
  const R = BAL.recruit;
  let t = R.thrBase + Math.max(0, prospectLevel(p) - R.thrFrom) * R.thrSlope + p.hype * R.thrHype;
  if (p.agentId && p.agentId !== 'you') t += R.thrRival;
  return Math.round(t);
}

function eligibility(S, p) {
  if (!p) return 'Oyuncu bulunamadı';
  if (p.agentId === 'you') return 'Zaten müşterin';
  if (!p.seen) return 'Önce bu oyuncuyu keşfetmelisin';
  if (!isRecruitable(S, p)) return 'Başka bir menajerle sözleşmeli; sözleşmesinin son sezonunu bekle';
  return null;
}

function normPromises(S, p, list) {
  const out = [], seen = new Set();
  for (const x of list || []) {
    if (!x || !BAL.recruit.fit[x.type] || seen.has(x.type)) continue;
    seen.add(x.type);
    out.push(promises.make(S, p, x.type, x));
  }
  return out;
}

/**
 * Live recruiting meter (no state change, no dice).
 * @param {object} S
 * @param {{playerId:string, promises?:Array<{type:string}>}} a
 * @returns {{score:number, threshold:number, parts:Array<{label:string,value:number}>, thresholdParts:Array<{label:string,value:number}>,
 *   promiseOptions:Array<{type:string,label:string,add:number,text:string,due:{dueSeason:number,dueMonth:number},fit:boolean,chosen:boolean}>,
 *   promiseBonus:Array<{type:string,value:number}>, canSign:boolean, cost:{energy:number,cash:number}, rival:boolean, error?:string}}
 */
export function recruitPreview(S, a) {
  const R = BAL.recruit;
  const p = a && S.players[a.playerId];
  const err = eligibility(S, p);
  const base = { score: 0, threshold: 0, parts: [], thresholdParts: [], promiseOptions: [], promiseBonus: [], canSign: false, cost: { energy: 1, cash: 0 }, rival: false };
  if (err) return { ...base, error: err };
  const parts = [];
  parts.push({ label: 'İtibarın', value: Math.round(S.agency.rep * R.repW) });
  parts.push({ label: 'Tanışıklık', value: Math.round(p.know * R.knowW) });
  parts.push({ label: 'Ajansın cazibesi', value: R.base });
  if (S.meta.archetype === 'mahalle' && p.nat === 'TR' && p.age <= 21) parts.push({ label: 'Mahalle bağı', value: BAL.archetype.mahalle.recruitTrYouth });
  if (p.contractEnd <= S.time.season) parts.push({ label: 'Sözleşmesi bitiyor', value: R.expiring });
  const chosen = normPromises(S, p, (a.promises || []).slice(0, R.maxPromises));
  const promiseBonus = chosen.map(s => ({ type: s.type, value: promiseValue(p, s.type) }));
  for (const b of promiseBonus) parts.push({ label: promises.PROMISE_LABELS[b.type], value: b.value });
  const lvl = prospectLevel(p);
  const rival = !!(p.agentId && p.agentId !== 'you');
  const thresholdParts = [
    { label: 'Taban', value: R.thrBase },
    { label: 'Seviye / potansiyel', value: Math.round(Math.max(0, lvl - R.thrFrom) * R.thrSlope) },
    { label: 'Şöhret', value: Math.round(p.hype * R.thrHype) },
  ];
  if (rival) thresholdParts.push({ label: 'Rakip menajerden koparma', value: R.thrRival });
  const score = parts.reduce((s, x) => s + x.value, 0);
  const threshold = recruitThreshold(S, p);
  const promiseOptions = promises.PROMISE_TYPES.map(type => {
    const spec = promises.make(S, p, type);
    return { type, label: promises.PROMISE_LABELS[type], add: promiseValue(p, type), text: spec.text, due: { dueSeason: spec.dueSeason, dueMonth: spec.dueMonth }, target: spec.target,
      fit: R.fit[type].includes(p.trait), chosen: chosen.some(c => c.type === type) };
  });
  return { score, threshold, parts, thresholdParts, promiseOptions, promiseBonus, canSign: score >= threshold && S.agency.energy >= 1, cost: { energy: 1, cash: 0 }, rival, gap: threshold - score };
}

/**
 * Signing pitch: 1 energy. If recruitScore ≥ threshold the player signs (agentId='you', rep set,
 * promises created via promises.add) — no dice. Rival-held players only when their rep.endSeason ≤ current season.
 * Higher surplus over the threshold earns a higher commission (5..10 %).
 * @param {object} S
 * @param {{playerId:string, promises?:Array<object>}} a
 * @returns {Result} `{ok:true, events:[{type:'signed', playerId}]}` or ok:false with the reason (score below threshold, etc.)
 */
export function recruit(S, a) {
  const R = BAL.recruit;
  const pv = recruitPreview(S, a || {});
  if (pv.error) return { ok: false, error: pv.error };
  if (S.agency.energy < 1) return { ok: false, error: 'Enerjin yok' };
  if (pv.score < pv.threshold) return { ok: false, error: `Henüz ikna olmadı (${pv.score}/${pv.threshold}). Söz vererek ya da onu daha yakından tanıyarak şansını artır.` };
  const p = S.players[a.playerId];
  const chosen = normPromises(S, p, (a.promises || []).slice(0, R.maxPromises));
  spendEnergy(S, 1);
  const prev = p.agentId && p.agentId !== 'you' ? S.rivals.find(r => r.id === p.agentId) : null;
  const surplus = pv.score - pv.threshold;
  const pct = clamp(R.commission[0] + Math.floor(surplus / R.commissionStep), R.commission[0], R.commission[1]);
  p.agentId = 'you';
  p.rep = { commissionPct: pct, endSeason: S.time.season + R.contractYears };
  p.heat = 0; p.shortlisted = false;
  p.loyalty = R.startLoyalty + (S.meta.archetype === 'mahalle' ? BAL.archetype.mahalle.loyaltyBonus : 0);
  p.morale = Math.max(p.morale, R.startMorale);
  p.know = Math.max(p.know, R.startKnow);
  p.lastVisit = { season: S.time.season, month: S.time.month };
  p.signed = { season: S.time.season, month: S.time.month, idx: monthIndex(S) };
  p.dreamProg = null;
  const ids = chosen.map(s => promises.add(S, s).id);
  news.push(S, { kind: 'signing', playerId: p.id, text: prev ? `${p.name}, ${prev.agency} ile yollarını ayırıp ${S.meta.agencyName} ile anlaştı.` : `${p.name}, ${S.meta.agencyName} ile temsil sözleşmesi imzaladı.` });
  return { ok: true, events: [{ type: 'signed', playerId: p.id, commissionPct: pct, endSeason: p.rep.endSeason, promiseIds: ids, fromRival: prev ? prev.id : null }] };
}

/** Short Turkish line: what the client wants right now (trait, minutes, wage, dream). */
export function wantsLine(S, p) {
  const D = BAL.clientDrift;
  const sh = p.st.sh, exp = D.minExp[p.trait] ?? 0.5;
  const fair = fairWage(S, p, leagueIdOf(S, p));
  const ratio = p.wage / fair;
  const open = promises.forPlayer(S, p.id);
  if (open.length) {
    const pr = open[0];
    return `"Bana verdiğin sözü unutma: ${pr.text}"`;
  }
  if (sh < exp - 0.1) {
    if (p.trait === 'hirsli') return '"Yedekte çürümek istemiyorum. Ya oynayacağım ya gideceğim."';
    if (p.trait === 'yildiz') return '"Sahaya çıkmam lazım, yoksa herkes beni unutur."';
    return '"Daha çok süre almam lazım. Bu kadar az oynamak beni geriletiyor."';
  }
  if (ratio < D.wageLow) return p.trait === 'paraci' ? '"Emeğimin karşılığını alamıyorum. Maaşıma bir bakalım."' : '"Maaşım piyasanın biraz altında kalmış gibi."';
  if (!p.dream.done) {
    const d = p.dream;
    if (d.type === 'top_league') return '"Bir gün Avrupa\'nın büyük liglerinden birinde oynamak istiyorum."';
    if (d.type === 'big_wage') return `"Ayda €${fmt(d.target)} kazanabileceğim bir yere ulaşmak istiyorum."`;
    if (d.type === 'champion') return '"Bir şampiyonluk yaşamadan bırakmam bu işi."';
    if (d.type === 'star') return '"Sahanın en iyilerinden biri olmak istiyorum."';
    if (d.type === 'hometown') return '"Memleketimde, ilk 11\'de üç sezon geçirmek benim hayalim."';
  }
  if (p.trait === 'sadik') return '"Buradayım, bir şey istemem. Yeter ki beni unutma."';
  if (p.trait === 'ailebabasi') return '"Ailemin yanında, huzurlu bir yer her şeyden önemli."';
  return '"Her şey yolunda, sadece işime bakmak istiyorum."';
}

/**
 * Visit a client: 1 energy, morale +10, loyalty +8, dreamKnown=true, lastVisit={season,month}.
 * One visit per client per month.
 * @param {object} S
 * @param {{playerId:string}} a
 * @returns {Result} `{ok:true, events:[{type:'visit', playerId, line}], line}`
 */
export function visitClient(S, a) {
  const p = a && S.players[a.playerId];
  if (!p || p.agentId !== 'you') return { ok: false, error: 'Bu oyuncu müşterin değil' };
  const lv = p.lastVisit;
  if (lv && lv.season === S.time.season && lv.month === S.time.month) return { ok: false, error: 'Bu ay zaten ziyaret ettin' };
  if (S.agency.energy < 1) return { ok: false, error: 'Enerjin yok' };
  spendEnergy(S, 1);
  p.morale = clamp(p.morale + 10, 0, 100);
  p.loyalty = clamp(p.loyalty + 8, 0, 100);
  p.dreamKnown = true;
  p.lastVisit = { season: S.time.season, month: S.time.month };
  promises.noteVisit(S, p.id);
  const line = wantsLine(S, p);
  return { ok: true, events: [{ type: 'visit', playerId: p.id, line }], line };
}

/**
 * Let a client go (agentId=null, rep=null, open promises dropped).
 * @param {object} S
 * @param {{playerId:string}} a
 * @returns {Result}
 */
export function release(S, a) {
  const p = a && S.players[a.playerId];
  if (!p || p.agentId !== 'you') return { ok: false, error: 'Bu oyuncu müşterin değil' };
  drop(S, p);
  news.push(S, { kind: 'release', playerId: p.id, text: `${S.meta.agencyName}, ${p.name} ile yollarını ayırdı.` });
  return { ok: true, events: [{ type: 'released', playerId: p.id }] };
}

function drop(S, p) {
  p.agentId = null; p.rep = null; p.loyalty = 40; p.shortlisted = false;
  S.promises = S.promises.filter(pr => pr.playerId !== p.id || pr.status !== 'open');
}

// ---------------------------------------------------------------- monthly drift

function driftOne(S, p, fx) {
  const D = BAL.clientDrift;
  const sh = p.st.sh;
  const exp = D.minExp[p.trait] ?? 0.5;
  const fair = fairWage(S, p, leagueIdOf(S, p));
  const ratio = p.wage / fair;
  let dm = (D.moraleBase - p.morale) * D.moraleRegress + p.form * D.moraleForm;
  let dl = D.loyBase * (p.trait === 'sadik' ? D.sadikDecay : 1) * fx.loyaltyDecayMult;
  if (!p.injured && p.clubId) {
    const gap = sh - exp;
    dm += clamp(gap * D.moraleMinK, D.moraleMinMin, D.moraleMinMax);
    const trait = p.trait === 'hirsli' || p.trait === 'yildiz' ? 1.5 : 1;
    if (gap < 0) dl += gap * D.loyMinK * trait; else dl += Math.min(1.5, gap * 3);
  } else if (p.injured) dm += D.injuredMorale;
  if (ratio < D.wageLow) { const k = p.trait === 'paraci' ? 2 : 1; dm -= 1 * k; dl -= 1.5 * k; }
  else if (ratio > D.wageHigh) { dm += 1; dl += p.trait === 'paraci' ? 1.5 : 0.5; }
  if (p.trait === 'yildiz') dm += p.hype >= 50 ? 1 : -1.5;
  const since = p.lastVisit ? monthIndex(S) - (p.lastVisit.season * 12 + p.lastVisit.month) : 12;
  if (since > D.visitGrace) dl -= Math.min(D.visitDecayMax, (since - D.visitGrace) * D.visitDecay) * fx.loyaltyDecayMult;
  p.morale = r1(clamp(p.morale + dm, 0, 100));
  p.loyalty = r1(clamp(p.loyalty + dl, 0, 100));
}

function dreamDone(S, p) {
  const d = p.dream;
  switch (d.type) {
    case 'top_league': return prestigeOf(S, p) >= d.target && !!p.clubId;
    case 'big_wage': return p.wage >= d.target;
    case 'star': return p.ca >= d.target;
    case 'champion': {
      if (S.time.month < 10 || !p.clubId) return false;
      const L = S.leagues[leagueIdOf(S, p)];
      if (L.matchday < 18) return false;
      return tableSorted(S, L.id)[0].clubId === p.clubId && p.st.apps >= BAL.clientDrift.championApps;
    }
    case 'hometown': return !!p.dreamProg && p.dreamProg.n >= d.target;
    default: return false;
  }
}

function trackHometown(S, p) {
  const c = S.clubs[p.clubId];
  const turkish = c && (c.leagueId === 'tr1' || c.leagueId === 'tr2');
  const starter = p.st.sh >= BAL.clientDrift.hometownShare;
  const prog = p.dreamProg && p.dreamProg.clubId === p.clubId ? p.dreamProg : { clubId: p.clubId, n: 0 };
  prog.n = turkish && starter ? prog.n + 1 : (turkish ? prog.n : 0);
  p.dreamProg = prog;
}

/**
 * Monthly hook (turn step 6): morale/loyalty drift (minutes vs trait expectation, wage vs fair, visit recency,
 * network L2 slows decay), dream completion (loyalty +30, rep +4, stats.dreams++), clients with loyalty ≤ 10 leave,
 * representation contracts: renewals processed, season-end auto renew (loyalty ≥ 55) or inbox card.
 * @param {object} S
 * @returns {object[]} UI events
 */
export function monthly(S) {
  const D = BAL.clientDrift;
  const out = [];
  const fx = upgradeEffects(S);
  const { season, month } = S.time;
  // renewals chosen via inbox flags
  for (const p of myClients(S)) {
    const f = 'renew:' + p.id;
    if (S.flags.seen[f]) {
      delete S.flags.seen[f];
      p.rep.endSeason = season + BAL.recruit.contractYears;
      out.push({ type: 'repRenewed', playerId: p.id, endSeason: p.rep.endSeason });
    }
  }
  for (const p of myClients(S)) {
    driftOne(S, p, fx);
    if (month === 11 && p.clubId) trackHometown(S, p);
    if (!p.dream.done && dreamDone(S, p)) {
      p.dream.done = true; p.dreamKnown = true;
      p.loyalty = clamp(p.loyalty + D.dreamLoyalty, 0, 100); p.morale = clamp(p.morale + D.dreamMorale, 0, 100);
      S.agency.rep = clamp(S.agency.rep + D.dreamRep, 0, 100); S.agency.stats.dreams++;
      news.push(S, { kind: 'dream', playerId: p.id, text: `${p.name} hayalini gerçekleştirdi: ${DREAMS[p.dream.type].label}!` });
      out.push({ type: 'dream', playerId: p.id, dream: p.dream.type });
    }
  }
  // leaving: loyalty ≤ 10
  for (const p of myClients(S)) {
    if (p.loyalty <= D.leaveLoyalty) {
      drop(S, p);
      news.push(S, { kind: 'clientLeft', playerId: p.id, text: `${p.name}, bağlılığını yitirip ${S.meta.agencyName} ile yolları ayırdı.` });
      out.push({ type: 'clientLeft', playerId: p.id, name: p.name });
    }
  }
  // representation contracts
  for (const p of myClients(S)) {
    if (!p.rep) { p.rep = { commissionPct: BAL.start.commissionPct, endSeason: season + 1 }; continue; }
    const cardKey = 'repend:' + p.id;
    const hasCard = S.inbox.some(c => c.key === cardKey);
    if (p.rep.endSeason < season) {
      if (!hasCard) {
        drop(S, p);
        news.push(S, { kind: 'repExpired', playerId: p.id, text: `${p.name} ile temsil sözleşmen sona erdi.` });
        out.push({ type: 'clientLeft', playerId: p.id, name: p.name, expired: true });
      }
    } else if (month === 11 && p.rep.endSeason <= season) {
      if (p.loyalty >= D.renewLoyalty) {
        p.rep.endSeason = season + BAL.recruit.contractYears;
        out.push({ type: 'repRenewed', playerId: p.id, endSeason: p.rep.endSeason, auto: true });
      } else if (!hasCard) {
        events.addCard(S, renewalCard(S, p, cardKey));
        out.push({ type: 'repExpiring', playerId: p.id });
      }
    }
  }
  return out;
}

function renewalCard(S, p, key) {
  const bonus = clamp(tidy(p.wage * BAL.clientDrift.repBonusCashK * 2), 3000, 50000);
  const prom = promises.make(S, p, p.trait === 'paraci' ? 'wage' : p.trait === 'sadik' || p.trait === 'ailebabasi' ? 'visit' : 'minutes');
  return {
    key, kind: 'client', title: `${p.name}: temsil sözleşmesi bitiyor`, from: p.name, playerId: p.id, expiresIn: 3,
    body: `${p.name} (${TRAITS[p.trait].label}) ile temsil sözleşmen bu sezon sona eriyor. Bağlılığı yeterince yüksek değil; yenilemek için bir jest bekliyor.`,
    options: [
      { id: 'bonus', label: `İmza primi öde (€${fmt(bonus)})`, hint: '2 sezon daha, bağlılık +5', cost: { energy: 0, cash: bonus }, risk: null, effects: [{ flag: 'renew:' + p.id }, { loyalty: 5, playerId: p.id }] },
      { id: 'promise', label: 'Söz ver ve yenile', hint: prom.text, cost: { energy: 0, cash: 0 }, risk: null, effects: [{ flag: 'renew:' + p.id }, { promise: prom, playerId: p.id }] },
      { id: 'letgo', label: 'Yollarını ayır', hint: 'Müşterin olmaktan çıkar', cost: { energy: 0, cash: 0 }, risk: null, effects: [{ releaseClient: p.id }] },
    ],
  };
}
