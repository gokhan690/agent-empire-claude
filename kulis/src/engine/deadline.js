// STUB — phase 2b. Son Gün (deadline day): hours 18..23, one action per hour (two at network L4).
// State: S.deadline (null when inactive). turn.advanceMonth calls start(); the UI drives takeCall/skipHour/finish.
import { notReady } from './util.js';

/** @typedef {{ok:true,events:object[],[k:string]:any}|{ok:false,error:string}} Result */

/**
 * Start Son Gün for the current month (Ağustos/Ocak). Build panic calls from clubs with unfilled needs bidding
 * for your clients. Return false (and leave S.deadline null) when there is nothing to do (no clients/interests).
 * turn.js sets S.time.phase='deadline' when this returns true.
 * @param {object} S
 * @returns {boolean} started
 */
export function start(S) { return false; }

/**
 * Take an incoming call: quick Masa (patience −1, K +10..25%).
 * @param {object} S
 * @param {{callId:string}} a
 * @returns {Result}
 */
export function takeCall(S, a) { return notReady(); }

/**
 * Skip the current hour (or spend it pitching).
 * @param {object} S
 * @returns {Result}
 */
export function skipHour(S) { return notReady(); }

/**
 * Midnight: collapse open calls, S.deadline=null, S.time.phase='plan',
 * S.flags.deadlineDone = `${season}:${month}` so advance() proceeds with the month simulation.
 * @param {object} S
 * @returns {Result}
 */
export function finish(S) {
  S.deadline = null;
  S.time.phase = 'plan';
  S.flags.deadlineDone = S.time.season + ':' + S.time.month;
  return { ok: true, events: [{ type: 'deadlineEnd' }] };
}
