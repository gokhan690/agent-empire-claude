// Gündem event cards: at most one per month (S.inbox holds 0 or 1 card). Templates live in data/events.js.
// Card: {id, key, title, body, playerId?, clubId?, amount?, options:[{id, label, cost:{energy,cash}}]}
import { BAL } from './constants.js';
import { uid, chance, pickBy } from './rng.js';
import { clamp } from './util.js';
import { myClients } from './selectors.js';
import { spend, earn, addRep, spendEnergy, takeLoan } from './economy.js';
import { fmt } from './data/text.js';
import { EVENTS, LOAN_CARD } from './data/events.js';
import { pickCandidate } from './scouting.js';

/** @typedef {{ok:true,events:object[],[k:string]:any}|{ok:false,error:string}} Result */

const TEMPLATES = Object.fromEntries([...EVENTS, LOAN_CARD].map(t => [t.key, t]));

function render(S, card, str) {
  const p = card.playerId ? S.players[card.playerId] : null, c = card.clubId ? S.clubs[card.clubId] : null;
  return fmt(str, { player: p ? p.name : 'Oyuncu', club: c ? c.name : 'Kulüp', amount: card.amount || 0 });
}

/** The cash price of an option. */
function optCost(card, o) { return { energy: (o.cost && o.cost.energy) || 0, cash: o.cost && o.cost.cash ? (card.amount || 0) : 0 }; }

function makeCard(S, t, cand) {
  const card = { id: uid(S, 'c'), key: t.key, title: t.title, playerId: cand.playerId || null, clubId: cand.clubId || null, amount: t.amount ? t.amount(S) : 0 };
  card.body = render(S, card, t.body);
  card.options = t.options.map(o => ({ id: o.id, label: o.label, cost: optCost(card, o) }));
  return card;
}

/** Monthly: drop last month's card, then maybe draw a new one (the bank's card has priority). */
export function monthly(S) {
  S.inbox = [];
  const out = [];
  let card = null;
  const A = S.agency;
  if (S.flags.loanOfferPending && !A.loan) { card = makeCard(S, LOAN_CARD, {}); S.flags.loanOfferPending = false; }
  else if (chance(S, BAL.events.chance)) {
    const cd = S.flags.evCool || (S.flags.evCool = {});
    const abs = S.time.season * 12 + S.time.month;
    const X = { clients: myClients(S), clubs: Object.values(S.clubs), pick: arr => pickBy(S, arr, () => 1) };
    const opts = [];
    for (const t of EVENTS) {
      if (cd[t.key] !== undefined && abs - cd[t.key] < BAL.events.cooldown) continue;
      const cand = t.when(S, X);
      if (cand) opts.push({ t, cand });
    }
    if (opts.length) {
      const o = pickBy(S, opts, x => x.t.weight);
      cd[o.t.key] = abs;
      card = makeCard(S, o.t, o.cand === true ? {} : o.cand);
    }
  }
  if (card) { S.inbox.push(card); out.push({ type: 'inboxNew', cardId: card.id, key: card.key, title: card.title }); }
  return out;
}

/** Answer the card. @param {{inboxId:string, optionId:string}} a @returns {Result} `{ok, resultText}` */
export function answerInbox(S, a) {
  const card = S.inbox.find(c => c.id === (a && a.inboxId));
  if (!card) return { ok: false, error: 'Kart bulunamadı' };
  const t = TEMPLATES[card.key];
  const o = t && t.options.find(x => x.id === a.optionId);
  const co = card.options.find(x => x.id === a.optionId);
  if (!o) return { ok: false, error: 'Seçenek bulunamadı' };
  const A = S.agency;
  if (co.cost.energy && co.cost.energy > A.energy) return { ok: false, error: 'Enerjin yok' };
  if (co.cost.cash && co.cost.cash > A.cash) return { ok: false, error: 'Yeterli paran yok' };
  if (co.cost.energy) spendEnergy(S, co.cost.energy);
  if (co.cost.cash) spend(S, co.cost.cash, 'event', card.title);
  const p = card.playerId ? S.players[card.playerId] : null, c = card.clubId ? S.clubs[card.clubId] : null;
  const events = [];
  for (const fx of o.fx) {
    for (const k in fx) {
      const v = fx[k];
      if (k === 'cash') earn(S, card.amount, 'event', card.title);
      else if (k === 'rep') addRep(S, v);
      else if (k === 'mood' && p) p.mood = clamp(p.mood + v, 0, 100);
      else if (k === 'hype' && p) p.hype = clamp(p.hype + v, 0, 100);
      else if (k === 'heal' && p) p.injured = Math.max(0, p.injured - v);
      else if (k === 'trust' && c) c.trust = clamp(c.trust + v, 0, 100);
      else if (k === 'found') { const q = pickCandidate(S); if (q) events.push({ type: 'scout', playerIds: [q] }); }
      else if (k === 'loan') takeLoan(S);
      events.push({ type: 'effect', key: k });
    }
  }
  S.inbox = S.inbox.filter(x => x !== card);
  return { ok: true, events, resultText: render(S, card, o.result), title: card.title };
}

