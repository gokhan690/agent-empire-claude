// PHASE 2c to polish. `build` works minimally (rank + simple legacy) so bankruptcy/career end are safe now.
// S.ending = {kind:'kariyer'|'iflas'|'musterisiz', rank, legacy, epilogues:[]}
import { BAL } from './constants.js';

/**
 * Legacy score from history/stats (phase 2c: refine; include dreams, deals, promises, rank).
 * @param {object} S
 * @returns {number}
 */
export function legacyScore(S) {
  const A = S.agency.stats;
  return Math.round(A.deals * 50 + A.dreams * 200 + A.promisesKept * 30 - A.promisesBroken * 60 + A.commission / 10000);
}

/**
 * Build S.ending and set S.time.phase='over' (turn.js/economy call it).
 * @param {object} S
 * @param {'kariyer'|'iflas'|'musterisiz'} [kind]
 * @returns {object} the ending
 */
export function build(S, kind = 'kariyer') {
  const rank = Math.max(1, S.ranking.findIndex(r => r.id === 'you') + 1);
  S.ending = { kind, rank, legacy: legacyScore(S), epilogues: [] };
  S.time.phase = 'over';
  return S.ending;
}

/**
 * Endless mode: after a finished career flip phase back to 'plan' and extend careerSeasons.
 * @param {object} S
 * @returns {{ok:boolean, error?:string, events?:object[]}}
 */
export function continueEndless(S) {
  if (!S.ending || S.ending.kind !== 'kariyer') return { ok: false, error: 'Devam edilemez' };
  S.meta.endless = true;
  S.meta.careerSeasons = 999;
  S.time.phase = 'plan';
  return { ok: true, events: [{ type: 'endless' }] };
}
