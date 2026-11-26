// Inbox deck (Gündem). Templates live in data/events.js; this module draws, renders, expires and resolves cards.
//
// Card shape (what the UI sees):
//   {id, key, kind, title, body, from, playerId, clubId, must, expiresIn, defaultOption, ctx,
//    options:[{id, label, hint, cost:{energy,cash}, risk:null|{pct,text}, preview:[{key,label,value,...}], summary, riskSummary}]}
// Cards created by other modules (rivals, objectives…) may carry `effects`/`altEffects`/`resultText`/`altResultText`
// directly on their options (plain JSON); template cards resolve those from the template by `card.key`.
import { BAL, MONTHS } from './constants.js';
import { uid, chance, pickBy, pickWeighted, rint } from './rng.js';
import { myClients, absMonth, squadIndex, clubStrength } from './selectors.js';
import { spend, spendEnergy, takeLoan } from './economy.js';
import { applyEffects } from './effects.js';
import { clamp } from './util.js';
import { fmt, eur } from './data/text.js';
import { makeName } from './data/names.js';
import { LEAGUE_DEFS } from './constants.js';
import { EVENT_TEMPLATES, TUTORIAL_TEMPLATES } from './data/events.js';
import * as tutorial from './tutorial.js';
import * as ending from './ending.js';

/** @typedef {{ok:true,events:object[],[k:string]:any}|{ok:false,error:string}} Result */

/** All templates by key (random deck, follow-ups, tutorial). */
export const TEMPLATES = {};
for (const t of EVENT_TEMPLATES.concat(TUTORIAL_TEMPLATES)) TEMPLATES[t.key] = t;
/** Templates eligible for the random monthly draw. */
export const DECK = EVENT_TEMPLATES.filter(t => t.weight > 0 && !t.followUp);

// ---------------------------------------------------------------- helpers
const KEY_LABEL = {
  cash: 'Para', rep: 'İtibar', energy: 'Enerji', loyalty: 'Bağlılık', morale: 'Moral', hype: 'Şöhret', form: 'Form',
  trust: 'Kulüp güveni', know: 'Bilgi', scout: 'Bilgi', injure: 'Sakatlık', heal: 'Sakatlık', interest: 'İlgi', promise: 'Söz',
  commission: 'Komisyon', releaseClient: 'Müşteri ayrılır', sellTo: 'Müşteri satılır',
};
const SILENT = new Set(['news', 'flag', 'queue', 'directorMove', 'label']);
/** Effect keys handled here, on top of effects.js's primitives. Move them into effects.js when convenient. */
export const LOCAL_EFFECT_KEYS = ['heal', 'scout', 'directorMove', 'sellTo', 'commission', 'queue'];
const NON_KEYS = new Set(['playerId', 'clubId', 'label']);

function flags(S) {
  const f = S.flags;
  if (!f.evCool) f.evCool = {};
  if (!f.evPl) f.evPl = {};
  if (!f.evQueue) f.evQueue = [];
  return f;
}

/** Context handed to every template's `when(S, X)`. Cheap to build; club strengths are computed lazily. */
export function whenCtx(S) {
  let idx = null;
  const cache = {};
  const clients = myClients(S);
  return {
    clients, abs: absMonth(S), month: S.time.month, season: S.time.season, window: MONTHS[S.time.month].window,
    str(cid) {
      if (cache[cid] === undefined) { if (!idx) idx = squadIndex(S); cache[cid] = clubStrength(S, cid, idx[cid]); }
      return cache[cid];
    },
    interestsOf(pid) { return S.interests.filter(i => i.playerId === pid); },
  };
}

/** Variables available to the text templates of a card with candidate `c`. */
export function renderCtx(S, c) {
  const R = { agent: S.meta.agentName, agency: S.meta.agencyName, month: MONTHS[S.time.month].name, season: S.time.season };
  for (const k in c) {
    const v = c[k];
    if (k.length > 2 && k.endsWith('Id') && typeof v === 'string') {
      const base = k.slice(0, -2);
      const p = S.players[v], cl = S.clubs[v], rv = S.rivals.find(r => r.id === v);
      if (p) { R[base] = p.name; R[base + 'Age'] = p.age; R[base + 'Club'] = S.clubs[p.clubId] ? S.clubs[p.clubId].name : ''; }
      else if (cl) { R[base] = cl.name; R[base + 'Dir'] = cl.director.name; }
      else if (rv) { R[base] = rv.name; R[base + 'Agency'] = rv.agency; }
    } else R[k] = v;
  }
  const p = c.playerId ? S.players[c.playerId] : null;
  if (p) {
    R.age = p.age;
    if (!R.club && S.clubs[p.clubId]) R.club = S.clubs[p.clubId].name;
  }
  const dc = (c.clubId && S.clubs[c.clubId]) || (p && S.clubs[p.clubId]) || null;
  if (dc && !R.director) R.director = dc.director.name;
  return R;
}

function resolveEffects(S, ef, c, R) {
  if (!ef) return [];
  const list = typeof ef === 'function' ? ef(S, c, R) : ef;
  return (list || []).map(e => renderEffect(e, R));
}
function renderEffect(e, R) {
  const o = {};
  for (const k in e) {
    const v = e[k];
    if (typeof v === 'string' && k !== 'flag') o[k] = fmt(v, R);
    else if (v && typeof v === 'object' && !Array.isArray(v)) o[k] = renderEffect(v, R);
    else o[k] = v;
  }
  return o;
}

function previewOf(S, list, c) {
  const out = [];
  for (const e of list) {
    const target = e.playerId ? 'player' : null;
    for (const k in e) {
      if (NON_KEYS.has(k) || SILENT.has(k)) continue;
      let v = e[k];
      if (k === 'interest') v = v.level;
      else if (k === 'promise') v = v.text || '';
      else if (typeof v === 'object') continue;
      const kind = (k === 'trust') ? 'club' : (k === 'cash' || k === 'rep' || k === 'energy' || k === 'queue') ? 'you' : 'player';
      out.push({ key: k, label: KEY_LABEL[k] || k, value: v, target: target || kind, playerId: e.playerId || (kind === 'player' ? c.playerId || null : null), clubId: e.clubId || (kind === 'club' ? c.clubId || null : null) });
    }
  }
  return out;
}
function summaryOf(prev) {
  return prev.map(p => {
    if (p.key === 'releaseClient' || p.key === 'sellTo') return p.label;
    if (p.key === 'promise') return 'Söz: ' + p.value;
    if (p.key === 'interest') return 'İlgi ' + p.value;
    if (p.key === 'cash') return 'Para ' + (p.value > 0 ? '+' : '') + eur(p.value);
    if (p.key === 'heal') return 'Sakatlık −' + p.value + ' ay';
    if (p.key === 'injure') return 'Sakatlık ' + p.value + ' ay';
    if (p.key === 'commission') return 'Komisyon ' + (p.value > 0 ? '+' : '−') + '%' + Math.abs(p.value);
    return p.label + ' ' + (p.value > 0 ? '+' : p.value < 0 ? '−' : '') + Math.abs(p.value);
  }).join(' · ');
}

function buildOptions(S, tpl, c, R) {
  const out = [];
  for (const o of tpl.options) {
    if (o.show && !o.show(S, c)) continue;
    const c0 = (typeof o.cost === 'function' ? o.cost(S, c) : o.cost) || {};
    const cost = { energy: c0.energy || 0, cash: Math.round(c0.cash || 0) };
    const r0 = typeof o.risk === 'function' ? o.risk(S, c) : o.risk;
    const risk = r0 ? { pct: r0.pct, text: fmt(r0.text, R) } : null;
    const ok = previewOf(S, resolveEffects(S, o.effects, c, R), c);
    const alt = risk ? previewOf(S, resolveEffects(S, o.altEffects, c, R), c) : null;
    out.push({ id: o.id, label: fmt(o.label, R), hint: fmt(o.hint || '', R), cost, risk, preview: ok, summary: summaryOf(ok), riskPreview: alt, riskSummary: alt ? summaryOf(alt) : '' });
  }
  return out;
}

function tplText(t, R, S) { return typeof t === 'function' ? t(R, S) : fmt(t || '', R); }

/**
 * Add a card to S.inbox (assigns id).
 * @param {object} S
 * @param {object} card without id
 * @returns {object} the card
 */
export function addCard(S, card) {
  const c = { id: uid(S, 'c'), must: false, expiresIn: 2, options: [], playerId: null, clubId: null, from: '', ...card };
  S.inbox.push(c);
  return c;
}

/**
 * Build a card from a template + candidate and add it to the inbox.
 * @param {object} S @param {string} key template key @param {object} [cand] candidate vars (playerId, clubId, …; JSON-clean)
 * @param {object} [over] fields overriding the card (e.g. {pinned:true, expiresIn:99})
 * @returns {object|null} the card (null for an unknown key)
 */
export function spawn(S, key, cand = {}, over = {}) {
  const tpl = TEMPLATES[key];
  if (!tpl) return null;
  const c = { ...(tpl.vars ? tpl.vars(S) : {}), ...JSON.parse(JSON.stringify(cand)) };
  const R = renderCtx(S, c);
  return addCard(S, {
    key, kind: tpl.kind, title: tplText(tpl.title, R, S), body: tplText(tpl.body, R, S), from: tplText(tpl.from, R, S),
    playerId: c.playerId || null, clubId: c.clubId || null, must: !!tpl.must, expiresIn: tpl.expiresIn || 2,
    defaultOption: tpl.defaultOption || null, ctx: c, options: buildOptions(S, tpl, c, R), ...over,
  });
}

function candidatesOf(tpl, S, X) {
  const r = tpl.when ? tpl.when(S, X) : true;
  if (!r) return [];
  if (r === true) return [{}];
  return (Array.isArray(r) ? r : [r]).filter(Boolean).map(x => (x === true ? {} : x));
}

// ---------------------------------------------------------------- local effect primitives
function ownedPlayer(S, ef, ctx) { const id = ef.playerId ?? ctx.playerId; return id ? S.players[id] : null; }

function applyLocal(S, ef, ctx, events) {
  const rest = {};
  for (const k in ef) {
    const v = ef[k];
    const p = ownedPlayer(S, ef, ctx);
    switch (k) {
      case 'heal': if (p) p.injured = Math.max(0, p.injured - v); events.push({ type: 'effect', key: k, value: v, playerId: p ? p.id : null }); break;
      case 'scout': if (p) { p.seen = true; p.know = clamp(p.know + v, 0, 100); } events.push({ type: 'effect', key: k, value: v, playerId: p ? p.id : null }); break;
      case 'commission': if (p && p.rep) p.rep.commissionPct = clamp(p.rep.commissionPct + v, 3, 12); events.push({ type: 'effect', key: k, value: v, playerId: p ? p.id : null }); break;
      case 'sellTo': {
        const rv = S.rivals.find(r => r.id === v);
        if (p && rv && p.agentId === 'you') {
          p.agentId = rv.id; p.rep = { commissionPct: rint(S, BAL.rivalCommission[0], BAL.rivalCommission[1]), endSeason: S.time.season + 2 };
          p.loyalty = 55;
          S.promises = S.promises.filter(q => !(q.playerId === p.id && q.status === 'open'));
        }
        events.push({ type: 'effect', key: k, value: v, playerId: p ? p.id : null });
        break;
      }
      case 'directorMove': {
        const A = S.clubs[v.from], B = S.clubs[v.to];
        if (A && B && A !== B) {
          const nat = (LEAGUE_DEFS.find(d => d.id === A.leagueId) || LEAGUE_DEFS[0]).nat;
          B.director = A.director;
          A.director = { name: makeName(S, nat), persona: pickWeighted(S, BAL.persona.weights), info: 0 };
          B.trust = Math.max(B.trust, clamp(A.trust - 10, 0, 100));
          A.trust = clamp(A.trust - 15, 0, 100);
        }
        events.push({ type: 'effect', key: k, value: v });
        break;
      }
      case 'queue': {
        flags(S).evQueue.push({ key: v.key, due: absMonth(S) + (v.months || 1), ctx: v.ctx || {} });
        break;
      }
      case 'releaseClient': {
        S.promises = S.promises.filter(q => !(q.playerId === v && q.status === 'open'));
        rest[k] = v;
        break;
      }
      default: rest[k] = v;
    }
  }
  return rest;
}

function runEffects(S, effects, ctx, label) {
  const events = [];
  for (const ef of effects) {
    const rest = applyLocal(S, ef, ctx, events);
    if (Object.keys(rest).some(k => !NON_KEYS.has(k))) events.push(...applyEffects(S, [{ label, ...rest }], ctx));
  }
  return events;
}

/** Resolve one option: pick effects (roll risk), apply, build the result. Used by answerInbox and by expiry. */
function resolveOption(S, card, opt, paid) {
  const tpl = TEMPLATES[card.key];
  const ot = tpl ? tpl.options.find(o => o.id === opt.id) : null;
  const c = card.ctx || {};
  const R = renderCtx(S, c);
  let riskFired = false;
  if (opt.risk && paid) riskFired = chance(S, opt.risk.pct / 100);
  let effects, text;
  if (ot) {
    effects = resolveEffects(S, riskFired ? ot.altEffects : ot.effects, c, R);
    text = riskFired ? (ot.altResultText || ot.resultText) : ot.resultText;
  } else {
    effects = (riskFired ? opt.altEffects : opt.effects) || [];
    text = riskFired ? (opt.altResultText || opt.resultText) : opt.resultText;
  }
  const ctx = { playerId: card.playerId, clubId: card.clubId };
  let extra = null;
  if (ot && ot.run) {
    const r = ot.run(S, c, riskFired);
    if (r && r.ok === false) return { ok: false, error: r.error || 'Yapılamadı' };
    extra = r;
  }
  const events = runEffects(S, effects, ctx, card.title);
  if (extra && extra.events) events.push(...extra.events);
  const resultText = fmt((extra && extra.resultText) || (typeof text === 'function' ? text(S, c, R) : text) || '', R);
  return { ok: true, events, resultText, riskFired };
}

function removeCard(S, card) { S.inbox = S.inbox.filter(c => c.id !== card.id); }

// ---------------------------------------------------------------- monthly
function tutorialOn(S) { return tutorial.active(S); }

function stillValid(S, card) {
  const tpl = TEMPLATES[card.key];
  if (tpl && tpl.clientOnly && card.playerId) { const p = S.players[card.playerId]; if (!p || p.agentId !== 'you') return false; }
  return true;
}

/**
 * Monthly (turn step 10): follow-ups, expire old cards (expiresIn−1; at 0 the default option is applied unless the
 * card is `must` or `pinned`), then generate next month's cards (2–4, fewer during the tutorial), loan offer card.
 * @param {object} S
 * @returns {object[]} UI events: {type:'inboxExpired'|'inboxNew', …}
 */
export function monthly(S) {
  const F = flags(S);
  const events = [];
  const abs = absMonth(S);
  ending.track(S);

  // 1. expire
  for (const card of S.inbox.slice()) {
    if (!stillValid(S, card)) { removeCard(S, card); continue; }
    if (card.pinned || card.must) continue;
    card.expiresIn -= 1;
    if (card.expiresIn > 0) continue;
    const opt = card.options.find(o => o.id === card.defaultOption) || null;
    let text = '';
    if (opt) { const r = resolveOption(S, card, opt, false); if (r.ok) { text = r.resultText; events.push(...r.events); } }
    removeCard(S, card);
    events.push({ type: 'inboxExpired', cardId: card.id, key: card.key, title: card.title, optionId: opt ? opt.id : null, resultText: text });
  }

  const X = whenCtx(S);
  const used = new Set(S.inbox.filter(c => c.playerId).map(c => c.playerId));
  const keys = new Set(S.inbox.map(c => c.key));
  let hasMust = S.inbox.some(c => c.must);
  const cap = BAL.events.inboxCap;

  // 2. loan offer from the bank (once per offer)
  if (S.flags.loanOfferPending && !F.loanCardShown && !keys.has('loan_offer') && S.inbox.length < cap) {
    F.loanCardShown = true;
    const card = spawn(S, 'loan_offer', {});
    if (card) { keys.add('loan_offer'); events.push({ type: 'inboxNew', cardId: card.id, key: card.key, title: card.title }); }
  } else if (!S.flags.loanOfferPending) F.loanCardShown = false;

  // 3. queued follow-ups that are due
  F.evQueue = F.evQueue.filter(q => {
    if (q.due > abs + 1) return true;
    if (S.inbox.length >= cap) return true;
    const card = spawn(S, q.key, q.ctx);
    if (card) { keys.add(card.key); events.push({ type: 'inboxNew', cardId: card.id, key: card.key, title: card.title }); if (card.must) hasMust = true; }
    return false;
  });

  // 4. draw new cards
  let want = parseInt(pickWeighted(S, BAL.events.perMonth), 10);
  if (tutorialOn(S)) want = Math.min(want, BAL.events.tutorialCards);
  want = Math.min(want, cap - S.inbox.length);
  if (want <= 0) return events;

  const pool = [];
  for (const tpl of DECK) {
    if (keys.has(tpl.key)) continue;
    if (tpl.once && S.flags.seen['ev_' + tpl.key]) continue;
    if (tpl.heavy && S.time.season < BAL.events.heavyFromSeason) continue;
    const last = F.evCool[tpl.key];
    if (last !== undefined && abs - last < (tpl.cooldownMonths || 0)) continue;
    const cands = candidatesOf(tpl, S, X);
    for (const cand of cands) {
      if (cand.playerId) {
        if (used.has(cand.playerId)) continue;
        const lp = F.evPl[cand.playerId];
        if (lp !== undefined && abs - lp < BAL.events.playerCooldown) continue;
      }
      pool.push({ tpl, cand, w: tpl.weight * (cand.w || 1) / cands.length });
    }
  }
  const kinds = {};
  for (let i = 0; i < want && pool.length; i++) {
    const pick = pickBy(S, pool, e => e.w * Math.pow(BAL.events.kindPenalty, kinds[e.tpl.kind] || 0) * (e.tpl.must && hasMust ? 0 : 1));
    const { tpl, cand } = pick;
    const card = spawn(S, tpl.key, cand);
    F.evCool[tpl.key] = abs;
    if (cand.playerId) { F.evPl[cand.playerId] = abs; used.add(cand.playerId); }
    if (tpl.once) S.flags.seen['ev_' + tpl.key] = true;
    if (card.must) hasMust = true;
    kinds[tpl.kind] = (kinds[tpl.kind] || 0) + 1;
    events.push({ type: 'inboxNew', cardId: card.id, key: card.key, title: card.title });
    for (let j = pool.length - 1; j >= 0; j--) {
      const e = pool[j];
      if (e.tpl.key === tpl.key || (cand.playerId && e.cand.playerId === cand.playerId)) pool.splice(j, 1);
    }
  }
  return events;
}

// ---------------------------------------------------------------- answering
/**
 * Resolve an inbox card option: check + pay cost, roll the visible risk, applyEffects (effects.js + local primitives),
 * remove the card.
 * @param {object} S
 * @param {{inboxId:string, optionId:string}} a
 * @returns {Result} `{ok, events, resultText, riskFired, cardId, optionId}`
 */
export function answerInbox(S, a = {}) {
  const card = S.inbox.find(c => c.id === a.inboxId);
  if (!card) return { ok: false, error: 'Bu kart artık yok' };
  const opt = card.options.find(o => o.id === a.optionId);
  if (!opt) return { ok: false, error: 'Geçersiz seçenek' };
  const cost = opt.cost || {};
  if ((cost.energy || 0) > S.agency.energy) return { ok: false, error: 'Yeterli enerjin yok' };
  if ((cost.cash || 0) > S.agency.cash) return { ok: false, error: 'Yeterli paran yok' };
  // resolve first (a failing `run` must not cost anything), then pay
  const snapshotRng = S.rng;
  const r = resolveOption(S, card, opt, true);
  if (!r.ok) { S.rng = snapshotRng; return r; }
  if (cost.energy) spendEnergy(S, cost.energy);
  if (cost.cash) spend(S, cost.cash, 'event', card.title);
  removeCard(S, card);
  const events = [{ type: 'inbox', cardId: card.id, key: card.key, optionId: opt.id, riskFired: r.riskFired }, ...r.events];
  tutorial.onAnswer(S, card, opt.id);
  return { ok: true, events, resultText: r.resultText, riskFired: r.riskFired, cardId: card.id, optionId: opt.id, title: card.title };
}

/** Special template runner for the bank loan card (see data/events.js `loan_offer`). */
export function acceptLoan(S) { return takeLoan(S); }
