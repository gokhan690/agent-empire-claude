// Scripted first months (season 1) as ONE short inbox card per step. A step is completed by really doing the action.
// State: S.flags.tutorial = { step, done, skipped, gem, target:{playerId,clubId}|null, did:{visit,scout,market,open} }.
// Steps: welcome → visit → scout → market → interest (guaranteed suitor with a durust director → first Masa)
//        → promises → ranking → done. The last two arrive via monthly() so the first month is not a wall of cards.
import { BAL, MONTHS } from './constants.js';
import { myClients } from './selectors.js';
import { applyEffects } from './effects.js';
import * as events from './events.js';

export const STEPS = ['welcome', 'visit', 'scout', 'market', 'interest', 'promises', 'ranking'];
const MONTHLY_STEPS = new Set(['promises', 'ranking']);
const ACTION_OF = { visitClient: 'visit', scoutTrip: 'scout', clubLunch: 'market', pitchPlayer: 'market', openNegotiation: 'open' };
const NEEDS_ACTION = { visit: 'visit', scout: 'scout', market: 'market', interest: 'open' };

/** Is the tutorial running? */
export function active(S) {
  const t = S.flags.tutorial;
  return !!t && typeof t === 'object' && !t.done;
}
const T = S => S.flags.tutorial;
const cardKey = step => 'tut_' + STEPS[step];
const hasCard = (S, key) => S.inbox.some(c => c.key === key);

function dropCards(S) { S.inbox = S.inbox.filter(c => !(c.key && c.key.startsWith('tut_'))); }

function ctxFor(S, step) {
  const t = T(S);
  const name = STEPS[step];
  if (name === 'interest' && t.target) return { playerId: t.target.playerId, clubId: t.target.clubId };
  if (t.gem && S.players[t.gem]) return { playerId: t.gem, clubId: S.players[t.gem].clubId };
  const c = myClients(S)[0];
  return c ? { playerId: c.id, clubId: c.clubId } : {};
}

function show(S) {
  const t = T(S);
  if (!active(S) || t.step >= STEPS.length) return [];
  const key = cardKey(t.step);
  if (hasCard(S, key)) return [];
  const card = events.spawn(S, key, ctxFor(S, t.step), { pinned: true, expiresIn: 99 });
  return card ? [{ type: 'inboxNew', cardId: card.id, key, title: card.title }] : [];
}

/** Pick the first suitor: a club with a durust director in reach of the client; make sure it exists. */
function makeInterest(S) {
  const t = T(S);
  const p = (t.gem && S.players[t.gem] && S.players[t.gem].agentId === 'you') ? S.players[t.gem] : myClients(S)[0];
  if (!p) return false;
  const own = S.clubs[p.clubId];
  const cp = S.leagues[own.leagueId].prestige;
  let best = null, bestScore = 1e9;
  for (const cid in S.clubs) {
    const c = S.clubs[cid];
    if (cid === p.clubId) continue;
    const pr = S.leagues[c.leagueId].prestige;
    if (pr < cp || pr > cp + 1) continue;
    const score = (c.director.persona === 'durust' ? 0 : 100) + (pr === cp ? 0 : 5) + Math.abs(c.id.charCodeAt(0) % 7 - 3);
    if (score < bestScore) { best = c; bestScore = score; }
  }
  if (!best) return false;
  if (best.director.persona !== 'durust') best.director.persona = 'durust';
  best.trust = Math.max(best.trust, 35);
  if (!best.needs.some(n => n.pos === p.pos && n.level >= 2)) best.needs = [{ pos: p.pos, level: 3 }, ...best.needs.filter(n => n.pos !== p.pos)];
  t.target = { playerId: p.id, clubId: best.id };
  applyEffects(S, [{ interest: { playerId: p.id, clubId: best.id, level: 72, kind: 'transfer' } }]);
  return true;
}

function enter(S) {
  const t = T(S);
  const ev = [];
  // skip steps whose action the player has already done
  while (t.step < STEPS.length) {
    const need = NEEDS_ACTION[STEPS[t.step]];
    if (need && t.did[need] && STEPS[t.step] !== 'interest') { t.step++; continue; }
    break;
  }
  if (t.step >= STEPS.length) { finish(S); return ev; }
  const name = STEPS[t.step];
  if (name === 'interest') {
    if (t.did.open) { t.step++; return enter(S); }
    if (!makeInterest(S)) { t.step++; return enter(S); }
  }
  if (!MONTHLY_STEPS.has(name)) ev.push(...show(S));
  return ev;
}

function finish(S) {
  const t = T(S);
  t.done = true;
  t.step = STEPS.length;
  dropCards(S);
}

function complete(S, name) {
  const t = T(S);
  if (!active(S) || STEPS[t.step] !== name) return [];
  S.inbox = S.inbox.filter(c => c.key !== cardKey(t.step));
  t.step++;
  return enter(S);
}

/**
 * Called once from newGame: the welcome card from Rıza Abi.
 * @param {object} S
 * @returns {object[]} UI events
 */
export function start(S) {
  const clients = myClients(S).slice().sort((a, b) => a.age - b.age);
  S.flags.tutorial = { step: 0, done: false, skipped: false, gem: clients[0] ? clients[0].id : null, target: null, did: {} };
  return show(S);
}

/**
 * Called after each successful player action by game.act so the tutorial can advance. Never throws.
 * @param {object} S
 * @param {string} actionId
 * @param {object} result
 * @returns {void}
 */
export function onAction(S, actionId, result) {
  if (!active(S) || (result && result.ok === false)) return;
  const what = ACTION_OF[actionId];
  if (!what) return;
  const t = T(S);
  t.did[what] = true;
  const name = STEPS[t.step];
  if (name === 'visit' && what === 'visit') complete(S, 'visit');
  else if (name === 'scout' && what === 'scout') complete(S, 'scout');
  else if (name === 'market' && what === 'market') complete(S, 'market');
  else if (name === 'interest' && what === 'open') complete(S, 'interest');
}

/**
 * Called by events.answerInbox after a card was answered: acknowledgement steps and the skip option.
 * @param {object} S @param {{key:string}} card @param {string} optionId
 */
export function onAnswer(S, card, optionId) {
  if (!card.key || !card.key.startsWith('tut_') || !active(S)) return;
  const t = T(S);
  if (optionId === 'skip') { t.skipped = true; finish(S); return; }
  const name = STEPS[t.step];
  if (card.key !== cardKey(t.step)) return;
  if (name === 'welcome' || name === 'promises' || name === 'ranking') {
    t.step++;
    if (t.step >= STEPS.length) { finish(S); return; }
    enter(S);
  }
}

/**
 * Monthly (turn step 10, after events.monthly): the promises/ranking cards, nudges, keeping the first suitor alive,
 * and retiring the tutorial after season 1.
 * @param {object} S
 * @returns {object[]} UI events
 */
export function monthly(S) {
  if (!active(S)) return [];
  const t = T(S);
  if (S.time.season > 1) { finish(S); return []; }
  const name = STEPS[t.step];
  const ev = [];
  if (name === 'interest' && t.target) {
    const nextOpen = MONTHS[(S.time.month + 1) % 12].window;
    const it = S.interests.find(i => i.playerId === t.target.playerId && i.clubId === t.target.clubId);
    if (nextOpen && S.players[t.target.playerId] && (!it || it.level < ((BAL.neg && BAL.neg.minLevel) || 60) + 5)) {
      applyEffects(S, [{ interest: { playerId: t.target.playerId, clubId: t.target.clubId, level: 72, kind: 'transfer' } }]);
    }
  }
  if (name === 'promises' || name === 'ranking' || !hasCard(S, cardKey(t.step))) ev.push(...show(S));
  return ev;
}

/** For the UI: which tutorial step is current (null when over). */
export function currentStep(S) { return active(S) ? STEPS[T(S).step] : null; }
