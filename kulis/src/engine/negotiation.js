// STUB — phase 2b. The Masa. State: S.negotiation (null when closed); owned entirely by this module.
// Package: {wage (monthly €), years 1..5, bonus, fee (your commission, lump sum), clauses:{minutes,release}}.
import { notReady } from './util.js';

/** @typedef {{ok:true,events:object[],[k:string]:any}|{ok:false,error:string}} Result */

/**
 * Open a table for an interest (1 energy; free from Son Gün). Generates Koz cards from real state,
 * hidden ceiling K, patience (persona + upgrades + archetype hukukcu +1).
 * @param {object} S
 * @param {{interestId:string}} a
 * @returns {Result}
 */
export function open(S, a) { return notReady(); }

/**
 * Live preview while sliders move (no state change).
 * @param {object} S
 * @param {{package:object, koz?:string|null}} a
 * @returns {{cost:number, satisfaction:number, feeShare:number, warnFee:boolean, transferFee:number, expectedMinutes:number}}
 */
export function preview(S, a) { return { cost: 0, satisfaction: 0, feeShare: 0, warnFee: false, transferFee: 0, expectedMinutes: 0 }; }

/**
 * Make an offer (patience −1, tell + counter if refused; at most one Koz per round).
 * @param {object} S
 * @param {{package:object, koz?:string|null}} a
 * @returns {Result} `{ok:true, outcome:'accepted'|'countered'|'left', tell?:{level,line,face}, counter?:object}`
 */
export function propose(S, a) { return notReady(); }

/**
 * Accept the director's last counter-package.
 * @param {object} S
 * @returns {Result}
 */
export function acceptCounter(S) { return notReady(); }

/**
 * Walk away (no penalty). Closes S.negotiation.
 * @param {object} S
 * @returns {Result}
 */
export function walkAway(S) { return notReady(); }

/**
 * "İkna et": when client satisfaction is 40..49, lean on him (loyalty −8) so he signs.
 * @param {object} S
 * @returns {Result}
 */
export function leanOnClient(S) { return notReady(); }
