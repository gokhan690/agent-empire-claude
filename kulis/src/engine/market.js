// STUB — phase 2b (market). Clubs' needs, interest, AI transfers, pitch/lunch/media actions,
// executing a transfer (move, fee, commission, fit effects).
// Needs: club.needs=[{pos,level 1..3}]. Interest: S.interests=[{id,playerId,clubId,level 0..100,kind,cooldown}].
import { notReady } from './util.js';

/** @typedef {{ok:true,events:object[],[k:string]:any}|{ok:false,error:string}} Result */

/**
 * Monthly (turn step 5): recompute needs, build/decay interest (≥60 in an open window → negotiable),
 * AI clubs trade among themselves in windows (0–2 signings each), keep squads 18–22 (hard 16–24),
 * push news via news.push.
 * @param {object} S
 * @returns {object[]} UI events
 */
export function monthly(S) { return []; }

/**
 * Season-end hook (called by season.js BEFORE default renewal) for a CLIENT whose contract ends this June.
 * Return true if market handled him (renewed via negotiation, free agent, etc.); false → engine auto-renews him.
 * @param {object} S
 * @param {object} p player
 * @returns {boolean}
 */
export function handleExpiry(S, p) { return false; }

/**
 * Preview a pitch (shown, deterministic).
 * @param {object} S
 * @param {{playerId:string, clubId:string}} a
 * @returns {{energy:number, cash:number, delta:number, levelBefore:number, levelAfter:number}}
 */
export function pitchPreview(S, a) { return { energy: 1, cash: 0, delta: 0, levelBefore: 0, levelAfter: 0 }; }
/**
 * Pitch a client to a club: 1 energy, raises that club's interest by the previewed amount.
 * @param {object} S
 * @param {{playerId:string, clubId:string}} a
 * @returns {Result}
 */
export function pitchPlayer(S, a) { return notReady(); }
/**
 * Club lunch: 1 energy + € → club.trust +10 (+15 at network L2), reveals needs & budget hint (club.lunchKnown=true).
 * @param {object} S
 * @param {{clubId:string}} a
 * @returns {Result}
 */
export function clubLunch(S, a) { return notReady(); }
/**
 * Media push: 1 energy + € → hype +15 (yildiz morale +, sadik −).
 * @param {object} S
 * @param {{playerId:string}} a
 * @returns {Result}
 */
export function mediaPush(S, a) { return notReady(); }
/**
 * Execute an agreed move (used by negotiation.js and deadline.js): move player, settle fee, pay commission
 * (economy.earn 'commission'), record S.deals, apply career-fit effects (minutes, morale, loyalty), news.
 * @param {object} S
 * @param {{playerId:string, toClubId:string, kind:'transfer'|'free'|'renewal', wage:number, years:number,
 *   bonus:number, fee:number, clauses:{minutes:boolean,release:boolean}, transferFee?:number}} deal
 * @returns {Result} `{ok:true, events:[{type:'deal', ...}], deal}`
 */
export function executeTransfer(S, deal) { return notReady(); }
