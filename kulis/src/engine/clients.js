// STUB — phase 2a. Clients: recruiting, visits, loyalty/morale drift, dreams.
// Representation contract: p.agentId='you', p.rep={commissionPct 5..10, endSeason}.
import { notReady } from './util.js';

/** @typedef {{ok:true,events:object[],[k:string]:any}|{ok:false,error:string}} Result */

/**
 * Live recruiting meter (no state change).
 * @param {object} S
 * @param {{playerId:string, promises?:Array<{type:string,dueSeason?:number,dueMonth?:number,target?:number}>}} a
 * @returns {{score:number, threshold:number, parts:Array<{label:string,value:number}>,
 *   promiseBonus:Array<{type:string,value:number}>, canSign:boolean, cost:{energy:number,cash:number}, error?:string}}
 */
export function recruitPreview(S, a) { return { score: 0, threshold: 100, parts: [], promiseBonus: [], canSign: false, cost: { energy: 1, cash: 0 } }; }

/**
 * Signing pitch: 1 energy. If recruitScore ≥ threshold the player signs (agentId='you', rep set,
 * promises created via promises.add) — no dice. Rival-held players only when their rep.endSeason == current season.
 * @param {object} S
 * @param {{playerId:string, promises?:Array<object>}} a
 * @returns {Result} `{ok:true, events:[{type:'signed', playerId}]}` or ok:false with the reason (score below threshold, etc.)
 */
export function recruit(S, a) { return notReady(); }

/**
 * Visit a client: 1 energy, morale +10, loyalty +8, dreamKnown=true, lastVisit={season,month}.
 * @param {object} S
 * @param {{playerId:string}} a
 * @returns {Result}
 */
export function visitClient(S, a) { return notReady(); }

/**
 * Let a client go (agentId=null, rep=null).
 * @param {object} S
 * @param {{playerId:string}} a
 * @returns {Result}
 */
export function release(S, a) { return notReady(); }

/**
 * Monthly hook (turn step 6): morale/loyalty drift (minutes vs trait expectation, wage vs fair),
 * dream completion (top_league, big_wage, champion, star, hometown → loyalty +30, rep +4,
 * stats.dreams++). League tables are final from month 10 (matchday 18) — use S.leagues[..].table.
 * @param {object} S
 * @returns {object[]} UI events
 */
export function monthly(S) { return []; }
