// Promises (Söz). `add` is already functional (used by effects.js); the rest is phase 2a.
// Shape: {id, playerId, type:'minutes'|'transfer_up'|'wage'|'stay'|'visit', text, dueSeason, dueMonth,
//         status:'open'|'kept'|'broken', target?}
import { uid } from './rng.js';

/**
 * Create an open promise.
 * @param {object} S
 * @param {{playerId:string,type:string,text?:string,dueSeason:number,dueMonth:number,target?:number}} spec
 * @returns {object} the promise
 */
export function add(S, spec) {
  const pr = { id: uid(S, 's'), status: 'open', text: '', dueMonth: 11, ...spec };
  S.promises.push(pr);
  return pr;
}

/**
 * STUB — phase 2a. Monthly check (turn step 6): evaluate due promises (kept: loyalty +15, rep +2,
 * stats.promisesKept++; broken: loyalty −25, rep −3, stats.promisesBroken++, hirsli/yildiz may walk out).
 * @param {object} S
 * @returns {object[]} UI events / promise outcomes `[{type:'promise', id, status}]`
 */
export function check(S) { return []; }

/**
 * STUB — phase 2a. Open promises of a player.
 * @param {object} S
 * @param {string} playerId
 * @returns {object[]}
 */
export function forPlayer(S, playerId) { return S.promises.filter(p => p.playerId === playerId && p.status === 'open'); }
