// Engine-side helpers for tools/e2e.mjs: build saves (JSON strings from game.serialize) to inject into localStorage.
import { newGame, act, advance, serialize } from '../src/engine/game.js';
import * as sel from '../src/engine/selectors.js';

export const SEED = 4242;

/** Answer the pending event card with its first free option so nothing lingers. */
export function clearInbox(S) {
  for (const c of [...S.inbox]) {
    const o = c.options.find((x) => !x.cost.cash && !x.cost.energy) || c.options[0];
    act(S, 'answerInbox', { inboxId: c.id, optionId: o.id });
  }
}

export function newS(seed = SEED) {
  const S = newGame({ seed, agentName: 'Test Menajer', agencyName: 'Test Ajans' });
  S.flags.guide.skipped = true;
  return S;
}

/** One month of no-effort play (cash topped up so the staging helper never goes bankrupt). */
export function passMonth(S) {
  if (S.negotiation) act(S, 'negWalkAway', {});
  clearInbox(S);
  S.agency.cash = Math.max(S.agency.cash, 150000);
  const r = advance(S);
  if (!r.ok) throw new Error('advance failed: ' + r.error);
  return r;
}

/** Final season, June (month 11), phase plan: pressing "Ayı Oynat" ends the career for real. */
export function lastJune(seed = SEED) {
  const S = newS(seed);
  while (!(S.time.season === S.meta.careerSeasons && S.time.month === 11)) {
    passMonth(S);
    if (S.time.phase === 'over') throw new Error('career ended early: ' + (S.ending && S.ending.kind));
  }
  clearInbox(S);
  return S;
}

/** Month 2 of season 1 with two waiting offers (two clients pitched to interested clubs) and plenty of energy and cash. */
export function withOffers(seed = SEED) {
  const S = newS(seed);
  S.agency.cash = 400000;
  S.agency.energy = 4;
  let n = 0;
  for (const p of sel.clientList(S)) {
    const o = sel.pitchOptions(S, p.id, 40).find((x) => x.fit === 'İlgilenir');
    if (!o || n >= 2) continue;
    const r = act(S, 'pitchPlayer', { playerId: p.id, clubId: o.clubId });
    if (r.ok && r.offer) { n++; S.agency.energy = 4; }
  }
  if (n < 1) throw new Error('no offers could be staged');
  S.agency.energy = 4;
  return S;
}

/** Cash below zero with two negative month ends behind: the next "Ayı Oynat" is bankruptcy. */
export function almostBankrupt() {
  const S = newS();
  S.agency.cash = -600000; S.agency.negMonths = 2; S.agency.loanOffered = true;
  return S;
}

export { serialize };
