// Season objectives: in July offer 3 goals (safe / balanced / bold) with rep/cash rewards.
// State: S.objectives = {offered:[], active:null, history:[]}.
// offered item: {id, tier, kind, title, text, target, reward:{cash,rep}}
// active item: offered item + {status:'active', progress, base:{...}, startSeason, startMonth}
import { BAL } from './constants.js';
import { pick, uid } from './rng.js';
import { clamp, tidy } from './util.js';
import { earn, addRep } from './economy.js';
import { myClients, monthlyCommission, monthIndex } from './selectors.js';
import * as news from './news.js';

/** @typedef {{ok:true,events:object[],[k:string]:any}|{ok:false,error:string}} Result */

const fmt = n => Math.round(n).toLocaleString('tr-TR');
const TIERS = ['safe', 'balanced', 'bold'];
const rankOf = S => { const i = S.ranking.findIndex(r => r.id === 'you'); return i < 0 ? S.ranking.length : i + 1; };
const portfolioValue = S => myClients(S).reduce((s, p) => s + p.value, 0);
function prestigeOfClub(S, id) { const c = S.clubs[id]; return c ? S.leagues[c.leagueId].prestige : 0; }

/** Objective templates. make(S, tier) → {target, title, text} or null when not applicable; progress(S, active) → number. */
export const TEMPLATES = {
  commission: {
    tiers: TIERS,
    make(S, tier) {
      const exp = 12 * monthlyCommission(S) + 20000 * (1 + myClients(S).length / 3);
      const k = { safe: 0.6, balanced: 1.1, bold: 2.0 }[tier];
      const target = tidy(Math.max(15000, exp * k));
      return { target, title: `€${fmt(target)} komisyon kazan`, text: `Sezon içinde transfer komisyonu ve maaş payı olarak toplam €${fmt(target)} gelir elde et.` };
    },
    progress: (S, o) => S.agency.stats.commission - o.base.commission,
  },
  signYouth: {
    tiers: TIERS,
    make(S, tier) {
      const n = { safe: 1, balanced: 2, bold: 3 }[tier];
      return { target: n, title: `${n} genç yetenek imzala`, text: `21 yaş ve altı ${n} oyuncuyu müşteri olarak kadrona kat.` };
    },
    progress: (S, o) => myClients(S).filter(p => p.signed && p.signed.idx >= o.base.idx && p.age <= 21).length,
  },
  moveUp: {
    tiers: ['balanced', 'bold'],
    make(S, tier) {
      const n = tier === 'bold' ? 2 : 1;
      return { target: n, title: n === 1 ? 'Bir oyuncunu üst lige taşı' : 'İki oyuncunu üst lige taşı', text: 'Müşterilerinden birini daha yüksek prestijli bir lige transfer et.' };
    },
    progress: (S, o) => S.deals.filter(d => (d.season * 12 + d.month) >= o.base.idx && S.players[d.playerId] && S.players[d.playerId].agentId === 'you'
      && prestigeOfClub(S, d.toClubId) > prestigeOfClub(S, d.fromClubId)).length,
  },
  cleanSlate: {
    tiers: TIERS, endOnly: true,
    make(S, tier) {
      const n = { safe: 1, balanced: 2, bold: 3 }[tier];
      return { target: n, title: 'Hiç söz bozma', text: `Sezon boyunca hiçbir sözünü bozma ve en az ${n} söz tut.` };
    },
    progress: (S, o) => S.agency.stats.promisesKept - o.base.kept,
    failed: (S, o) => S.agency.stats.promisesBroken > o.base.broken,
  },
  clients: {
    tiers: TIERS,
    make(S, tier) {
      const n = myClients(S).length + { safe: 1, balanced: 2, bold: 4 }[tier];
      return { target: n, title: `Müşteri sayısını ${n}'e çıkar`, text: `Ajansında aynı anda en az ${n} müşteri bulunsun.` };
    },
    progress: S => myClients(S).length,
  },
  rep: {
    tiers: TIERS,
    make(S, tier) {
      const t = Math.min(100, Math.ceil(S.agency.rep) + { safe: 4, balanced: 8, bold: 14 }[tier]);
      return { target: t, title: `İtibarı ${t}'e çıkar`, text: `Ajansının itibarını ${t} puana yükselt.` };
    },
    progress: S => Math.floor(S.agency.rep),
  },
  cash: {
    tiers: TIERS,
    make(S, tier) {
      const c = Math.max(0, S.agency.cash);
      const target = tidy(c + Math.max({ safe: 20000, balanced: 45000, bold: 100000 }[tier], c * { safe: 0.2, balanced: 0.5, bold: 1.0 }[tier]));
      return { target, title: `Kasayı €${fmt(target)}'ya çıkar`, text: `Sezon içinde kasandaki parayı €${fmt(target)} seviyesine ulaştır.` };
    },
    progress: S => Math.max(0, Math.round(S.agency.cash)),
  },
  dream: {
    tiers: ['balanced', 'bold'],
    make(S) {
      if (!myClients(S).some(p => !p.dream.done)) return null;
      return { target: 1, title: 'Bir müşterinin hayalini gerçekleştir', text: 'Müşterilerinden birinin hayalini gerçeğe dönüştür.' };
    },
    progress: (S, o) => S.agency.stats.dreams - o.base.dreams,
  },
  discover: {
    tiers: ['safe', 'balanced', 'bold'],
    make(S, tier) {
      const n = { safe: 5, balanced: 9, bold: 15 }[tier];
      return { target: n, title: `${n} yeni oyuncu keşfet`, text: `Gözlem gezileri ve takiple ${n} yeni oyuncu keşfet.` };
    },
    progress: (S, o) => { let n = 0; for (const id in S.players) { const p = S.players[id]; if (p.seenAt !== undefined && p.seenAt >= o.base.idx) n++; } return n; },
  },
  bestCa: {
    tiers: TIERS,
    make(S, tier) {
      const best = Math.max(0, ...myClients(S).map(p => p.ca));
      const t = Math.min(95, best + { safe: 2, balanced: 4, bold: 7 }[tier]);
      return { target: t, title: `En iyi müşterin ${t} güce ulaşsın`, text: `Müşterilerinden birinin gücü (CA) ${t} olsun.` };
    },
    progress: S => Math.max(0, ...myClients(S).map(p => p.ca)),
  },
  portfolio: {
    tiers: TIERS,
    make(S, tier) {
      const v = portfolioValue(S);
      const target = tidy(Math.max(500000, v * { safe: 1.15, balanced: 1.4, bold: 2.0 }[tier]));
      return { target, title: `Portföy değerini €${fmt(target)}'ya çıkar`, text: `Müşterilerinin toplam piyasa değeri €${fmt(target)} olsun.` };
    },
    progress: S => Math.round(portfolioValue(S)),
  },
  rank: {
    tiers: TIERS, endOnly: true,
    make(S, tier) {
      const r = rankOf(S);
      const tr = r <= 1 ? 1 : tier === 'bold' ? Math.max(1, r - 2) : tier === 'balanced' ? r - 1 : r;
      if (tier === 'safe' && r > 4) return { target: 2, title: 'Sıralamada sonuncu olma', text: 'Sezonu ajans sıralamasında en az 4. sırada bitir.', rankTarget: 4 };
      return { target: 6 - tr, title: tr === 1 ? 'Ajans sıralamasında 1. ol' : `Ajans sıralamasında ${tr}. sıraya çık`, text: `Sezon sonunda beş ajans arasında en az ${tr}. sırada ol.`, rankTarget: tr };
    },
    progress: (S, o) => 6 - rankOf(S),
  },
};
export const OBJECTIVE_KINDS = Object.keys(TEMPLATES);

function baseline(S) {
  const A = S.agency.stats;
  return { commission: A.commission, kept: A.promisesKept, broken: A.promisesBroken, dreams: A.dreams, idx: monthIndex(S) };
}

function mkOffer(S, tier, used) {
  const keys = OBJECTIVE_KINDS.filter(k => !used.has(k) && TEMPLATES[k].tiers.includes(tier));
  for (let tries = 0; tries < 8 && keys.length; tries++) {
    const k = pick(S, keys);
    keys.splice(keys.indexOf(k), 1);
    const m = TEMPLATES[k].make(S, tier);
    if (!m) continue;
    used.add(k);
    const R = BAL.objective.reward[tier];
    const grow = 1 + BAL.objective.cashSeasonGrowth * (S.time.season - 1);
    return { id: uid(S, 'o'), tier, kind: k, ...m, reward: { cash: tidy(R.cash * grow), rep: R.rep } };
  }
  return null;
}

/**
 * Fill S.objectives.offered with 3 goals (called at game start and at each new season's July).
 * Targets scale with the current agency size.
 * @param {object} S
 * @returns {object[]} UI events
 */
export function offer(S) {
  const used = new Set();
  const list = [];
  for (const tier of TIERS) { const o = mkOffer(S, tier, used); if (o) list.push(o); }
  S.objectives.offered = list;
  return [{ type: 'objectivesOffered', count: list.length }];
}

/**
 * Pick one offered objective.
 * @param {object} S
 * @param {{objectiveId:string}} a
 * @returns {Result}
 */
export function choose(S, a) {
  const O = S.objectives;
  if (O.active) return { ok: false, error: 'Zaten bir hedefin var' };
  const o = O.offered.find(x => x.id === (a && a.objectiveId));
  if (!o) return { ok: false, error: 'Hedef bulunamadı' };
  O.active = { ...o, status: 'active', base: baseline(S), startSeason: S.time.season, startMonth: S.time.month, progress: 0 };
  O.offered = [];
  O.active.progress = TEMPLATES[o.kind].progress(S, O.active);
  return { ok: true, events: [{ type: 'objectiveChosen', id: o.id, kind: o.kind, tier: o.tier }] };
}

/**
 * Progress of the active objective for the UI.
 * @param {object} S
 * @returns {null|{id:string,kind:string,tier:string,title:string,text:string,progress:number,target:number,pct:number,reward:object,failed:boolean,endOnly:boolean}}
 */
export function status(S) {
  const o = S.objectives.active;
  if (!o) return null;
  const T = TEMPLATES[o.kind];
  const progress = T.progress(S, o);
  const failed = !!(T.failed && T.failed(S, o));
  return { id: o.id, kind: o.kind, tier: o.tier, title: o.title, text: o.text, progress, target: o.target, pct: clamp(o.target ? progress / o.target : 0, 0, 1), reward: o.reward, failed, endOnly: !!T.endOnly };
}

function finish(S, o, result) {
  S.objectives.history.push({ season: S.time.season, kind: o.kind, tier: o.tier, title: o.title, result, reward: result === 'done' ? o.reward : null });
  S.objectives.active = null;
}

/**
 * Monthly (turn step 10): track progress, pay rewards on completion, fail at season end (June).
 * @param {object} S
 * @returns {object[]} UI events
 */
export function check(S) {
  const o = S.objectives.active;
  if (!o) return [];
  const st = status(S);
  o.progress = st.progress;
  const last = S.time.month === 11;
  if (st.failed) { finish(S, o, 'failed'); return [{ type: 'objective', status: 'failed', title: o.title }]; }
  const reached = st.progress >= o.target;
  if (reached && (!st.endOnly || last)) {
    earn(S, o.reward.cash, 'objective', 'Hedef ödülü: ' + o.title);
    addRep(S, o.reward.rep);
    news.push(S, { kind: 'objective', text: `${S.meta.agencyName} sezon hedefini tamamladı: ${o.title}` });
    finish(S, o, 'done');
    return [{ type: 'objective', status: 'done', title: o.title, reward: o.reward }];
  }
  if (last) { finish(S, o, 'failed'); return [{ type: 'objective', status: 'failed', title: o.title }]; }
  return [];
}
