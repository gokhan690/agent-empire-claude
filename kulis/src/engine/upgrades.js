// Office upgrades: 3 branches (scout, table, network) × 4 levels. Level stored in S.agency.upgrades[branch].
// Upkeep per level: BAL.econ.upkeepUpgrade (economy.js charges selectors.officeUpkeep, which already reads it).
// Other modules read effects through selectors.upg(S, branch) / selectors.upgradeEffects(S).
import { BAL } from './constants.js';
import { spend } from './economy.js';
import { energyMaxFor } from './selectors.js';

/** @typedef {{ok:true,events:object[],[k:string]:any}|{ok:false,error:string}} Result */
export const BRANCHES = ['scout', 'table', 'network'];

/**
 * @param {object} S
 * @param {{branch:'scout'|'table'|'network'}} a
 * @returns {{branch:string, name:string, level:number, nextLevel:number|null, maxed:boolean, cost:number, upkeep:number, upkeepDelta:number, text:string, currentText:string, canAfford:boolean, error?:string}}
 *   next-level info (cost in € shown before buying; `upkeep` = new monthly upkeep of this branch, `upkeepDelta` = extra per month)
 */
export function preview(S, a) {
  const b = a && a.branch;
  if (!BRANCHES.includes(b)) return { branch: b, name: '', level: 0, nextLevel: null, maxed: true, cost: 0, upkeep: 0, upkeepDelta: 0, text: '', currentText: '', canAfford: false, error: 'Bilinmeyen dal' };
  const U = BAL.upgrade, lvl = S.agency.upgrades[b];
  const maxed = lvl >= 4;
  const T = BAL.econ.upkeepUpgrade;
  const cost = maxed ? 0 : U.cost[b][lvl];
  return {
    branch: b, name: U.names[b], level: lvl, nextLevel: maxed ? null : lvl + 1, maxed, cost,
    upkeep: maxed ? T[lvl] : T[lvl + 1], upkeepDelta: maxed ? 0 : T[lvl + 1] - T[lvl],
    text: maxed ? 'En üst seviye' : U.text[b][lvl], currentText: lvl ? U.text[b].slice(0, lvl).join(' · ') : '',
    canAfford: !maxed && S.agency.cash >= cost,
  };
}

/**
 * Buy the next level (costs €, no energy). Network levels raise energyMax immediately (and add the extra energy now).
 * @param {object} S
 * @param {{branch:'scout'|'table'|'network'}} a
 * @returns {Result}
 */
export function buy(S, a) {
  const pv = preview(S, a || {});
  if (pv.error) return { ok: false, error: pv.error };
  if (pv.maxed) return { ok: false, error: 'Bu dal zaten en üst seviyede' };
  if (S.agency.cash < pv.cost) return { ok: false, error: 'Yeterli paran yok' };
  spend(S, pv.cost, 'upgrade', `${pv.name} yükseltmesi (Sv.${pv.nextLevel})`);
  S.agency.upgrades[pv.branch] = pv.nextLevel;
  const oldMax = S.agency.energyMax;
  S.agency.energyMax = energyMaxFor(S);
  S.agency.energy = Math.min(S.agency.energyMax, S.agency.energy + Math.max(0, S.agency.energyMax - oldMax));
  return { ok: true, events: [{ type: 'upgrade', branch: pv.branch, level: pv.nextLevel, cost: pv.cost }] };
}
