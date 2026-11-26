// STUB — phase 2c (narrative). Inbox deck (Gündem). Templates in data/events.js.
// Card shape: {id,key,kind,title,body,from,playerId,clubId,must,expiresIn,options:[{id,label,hint,cost:{energy,cash},risk}]}
import { uid } from './rng.js';
import { notReady } from './util.js';

/** @typedef {{ok:true,events:object[],[k:string]:any}|{ok:false,error:string}} Result */

/**
 * Add a card to S.inbox (works already; assigns id).
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
 * Monthly (turn step 10): expire old cards (expiresIn−1; remove at 0 unless must), then generate next month's
 * cards from conditions (≥40 templates), loan offer when S.flags.loanOfferPending.
 * @param {object} S
 * @returns {object[]} UI events
 */
export function monthly(S) { return []; }

/**
 * Resolve an inbox card option: pay cost, applyEffects (effects.js), remove the card.
 * @param {object} S
 * @param {{inboxId:string, optionId:string}} a
 * @returns {Result}
 */
export function answerInbox(S, a) { return notReady(); }
