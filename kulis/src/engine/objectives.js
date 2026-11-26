// STUB — phase 2a. Season objectives: in July offer 3 goals (safe/balanced/bold) with rep/cash rewards.
// State: S.objectives = {offered:[], active:null, history:[]}.
import { notReady } from './util.js';

/** @typedef {{ok:true,events:object[],[k:string]:any}|{ok:false,error:string}} Result */

/**
 * Fill S.objectives.offered with 3 goals (called at game start and at each new season's July).
 * @param {object} S
 * @returns {object[]} UI events
 */
export function offer(S) { return []; }

/**
 * Pick one offered objective.
 * @param {object} S
 * @param {{objectiveId:string}} a
 * @returns {Result}
 */
export function choose(S, a) { return notReady(); }

/**
 * Monthly (turn step 10): track progress, pay rewards, archive to history at season end.
 * @param {object} S
 * @returns {object[]} UI events
 */
export function check(S) { return []; }
