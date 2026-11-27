// Office upgrades: six one-time purchases (BAL.upgrades), stored as S.agency.upgrades[id] = true. Effects are read through selectors.hasUpgrade.
import { BAL } from './constants.js';
import { spend } from './economy.js';
import { energyMaxFor } from './selectors.js';

/** @typedef {{ok:true,events:object[],[k:string]:any}|{ok:false,error:string}} Result */

/** The list for the Ajans sheet: `{id, name, text, price, owned, canAfford}`. */
export function list(S) {
  return BAL.upgrades.map(u => ({ id: u.id, name: u.name, text: u.text, price: u.price, owned: !!S.agency.upgrades[u.id], canAfford: S.agency.cash >= u.price }));
}

/**
 * Buy an upgrade (costs €, no energy). "Büyük ofis" raises energyMax at once and refills the extra energy.
 * @param {object} S
 * @param {{upgradeId:string}} a
 * @returns {Result}
 */
export function buy(S, a) {
  const u = BAL.upgrades.find(x => x.id === (a && a.upgradeId));
  if (!u) return { ok: false, error: 'Bilinmeyen yükseltme' };
  if (S.agency.upgrades[u.id]) return { ok: false, error: 'Zaten aldın' };
  if (S.agency.cash < u.price) return { ok: false, error: 'Yeterli paran yok' };
  spend(S, u.price, 'upgrade', u.name);
  S.agency.upgrades[u.id] = true;
  const oldMax = S.agency.energyMax;
  S.agency.energyMax = energyMaxFor(S);
  S.agency.energy = Math.min(S.agency.energyMax, S.agency.energy + Math.max(0, S.agency.energyMax - oldMax));
  return { ok: true, events: [{ type: 'upgrade', upgradeId: u.id, cost: u.price }] };
}
