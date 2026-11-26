// Engine-side helpers for tools/e2e.mjs: build saves (JSON strings from game.serialize) to inject into localStorage.
import { newGame, act, advance, serialize, deserialize } from '../src/engine/game.js';
import * as endingMod from '../src/engine/ending.js';
import * as sel from '../src/engine/selectors.js';

export const SEED = 4242;

/** Answer every pending inbox card with its first affordable option (cheapest effect) so advance() is never blocked. */
export function clearInbox(S, only = 'must') {
  for (const c of [...S.inbox]) {
    if (only === 'must' && !c.must) continue;
    const o = c.options.find((x) => x.id === c.defaultOption) || c.options.find((x) => !x.cost.cash && !x.cost.energy) || c.options[0];
    act(S, 'answerInbox', { inboxId: c.id, optionId: o.id });
  }
}

/** One month with no-effort play: close tables, answer must cards, handle Son Gün, advance. */
export function passMonth(S) {
  if (S.negotiation) act(S, 'negWalkAway', {});
  clearInbox(S, 'must');
  for (const c of sel.myClients(S)) act(S, 'visitClient', { playerId: c.id }); // keeps loyalty up so representation contracts renew
  if (S.time.phase === 'deadline') act(S, 'deadlineFinish', {});
  let r = advance(S);
  if (r.ok && r.phase === 'deadline') { act(S, 'deadlineFinish', {}); r = advance(S); }
  if (!r.ok) throw new Error('advance failed: ' + r.error);
  return r;
}

export function newS(seed = SEED, extra = {}) {
  const S = newGame({ seed, agentName: 'Test Menajer', agencyName: 'Test Ajans', archetype: 'mahalle', careerSeasons: 8, ...extra });
  clearInbox(S, 'all');
  return S;
}

/** Tutorial done up to the guaranteed suitor, in July of season 1 (energy left for tables). Returns S. */
export function tutorialToInterest(S) {
  const w = S.inbox.find((c) => c.key === 'tut_welcome');
  if (w) act(S, 'answerInbox', { inboxId: w.id, optionId: w.options[0].id });
  const mine = sel.myClients(S);
  act(S, 'visitClient', { playerId: mine[0].id });
  act(S, 'scoutTrip', { leagueId: 'tr1', focus: 'u21' });
  const club = Object.values(S.clubs).find((c) => c.id !== mine[0].clubId);
  act(S, 'clubLunch', { clubId: club.id });
  return S;
}

/** A save in August of season 1 (Son Gün month) with an open, negotiable interest and plenty of cash. */
export function augustWithInterest() {
  const S = newS();
  tutorialToInterest(S);
  S.agency.cash = 400000;
  clearInbox(S, 'all');
  passMonth(S); // July -> August
  const open = sel.interestList(S).filter((i) => i.negotiable);
  if (!open.length) throw new Error('no open interest in August');
  // make the first suitor a realistic one (the player would actually play there) so a table can be won with real clicks
  for (let k = 0; k < 8 && sel.interestList(S).filter((i) => i.negotiable).sort((a, b) => b.fitSat - a.fitSat)[0].fitSat < 55; k++) {
    const best = sel.interestList(S).filter((i) => i.negotiable).sort((a, b) => b.fitSat - a.fitSat)[0];
    S.players[best.playerId].ca += 6;
  }
  return S;
}

/** Final season, June (month 11), phase plan: pressing "Ayı Oynat" ends the career for real. */
export function lastJune(opts = {}) {
  const S = newS(opts.seed || SEED, opts.extra);
  while (!(S.time.season === S.meta.careerSeasons && S.time.month === 11)) {
    S.agency.cash = Math.max(S.agency.cash, 150000); // passive play would go bankrupt; this is only a staging helper
    passMonth(S);
    if (S.time.phase === 'over') throw new Error('career ended early: ' + (S.ending && S.ending.kind));
  }
  clearInbox(S, 'all');
  return S;
}

/** Same state but with a finished ending of the given tier (UI boot restores the Ending screen). */
export function withEnding(S, kind) {
  const T = JSON.parse(serialize(S));
  return T && T;
}
import * as promisesMod from '../src/engine/promises.js';
/** August with a suitor, an open `stay` promise on the suitor's player (table closes with a reason) and one shortlisted prospect that has a blocked/warned promise option. */
export function promiseWorld() {
  const S = augustWithInterest();
  const i = sel.interestList(S).filter((x) => x.negotiable)[0];
  promisesMod.add(S, promisesMod.make(S, S.players[i.playerId], 'stay'));
  const prospects = sel.prospectList(S, {});
  let pick = null;
  for (const p of prospects) {
    const r = act(S, 'recruitPreview', { playerId: p.id, promises: [] });
    const o = r.ok && r.preview.promiseOptions.find((x) => x.blocked);
    if (o && !pick) pick = { id: p.id, name: p.name, reason: o.warning, type: o.type };
    if (pick) break;
  }
  if (!pick) throw new Error('no prospect with a blocked promise option');
  act(S, 'toggleShortlist', { playerId: pick.id });
  return { S, interest: i, pick };
}
export { deserialize, promisesMod, endingMod, serialize, sel, act, advance };
