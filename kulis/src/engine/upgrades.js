// STUB — phase 2a. Office upgrades: 3 branches (scout, table, network) × 4 levels.
// Level stored in S.agency.upgrades[branch]. Upkeep per level: BAL.econ.upkeepUpgrade (economy.js already charges it).
// After buying `network`, call energyMaxFor(S) from selectors to refresh agency.energyMax.
import { notReady } from './util.js';

/** @typedef {{ok:true,events:object[],[k:string]:any}|{ok:false,error:string}} Result */

/**
 * @param {object} S
 * @param {{branch:'scout'|'table'|'network'}} a
 * @returns {{level:number, nextLevel:number|null, cost:number, upkeep:number, text:string}} next-level info (cost in € shown before buying)
 */
export function preview(S, a) { return { level: 0, nextLevel: 1, cost: 0, upkeep: 0, text: '' }; }

/**
 * Buy the next level (costs €, no energy).
 * @param {object} S
 * @param {{branch:'scout'|'table'|'network'}} a
 * @returns {Result}
 */
export function buy(S, a) { return notReady(); }
