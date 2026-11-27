// Facade used by the UI: newGame, act, advance, serialize, deserialize.
import { BAL, MONTHS } from './constants.js';
import { seedRng } from './rng.js';
import { createWorld } from './world.js';
import { advanceMonth } from './turn.js';
import { takeLoan } from './economy.js';
import { energyMaxFor } from './selectors.js';
import * as scouting from './scouting.js';
import * as clients from './clients.js';
import * as upgrades from './upgrades.js';
import * as market from './market.js';
import * as negotiation from './negotiation.js';
import * as events from './events.js';
import * as goal from './goal.js';
import * as guide from './guide.js';
import * as ending from './ending.js';
import { pack, unpack, SAVE_VERSION } from './save.js';

/**
 * Create a new game.
 * @param {{seed?:number|string, agentName?:string, agencyName?:string, careerSeasons?:number}} [opts]
 * @returns {object} S
 */
export function newGame(opts = {}) {
  const S = {
    v: SAVE_VERSION, seed: 0, rng: 0, seq: 0,
    meta: { agentName: opts.agentName || 'Ajan', agencyName: opts.agencyName || 'Kulis Menajerlik', careerSeasons: opts.careerSeasons || BAL.careerSeasons },
    time: { season: 1, month: 0, phase: 'plan' },
    agency: {
      cash: BAL.start.cash, rep: BAL.start.rep, energy: BAL.energy.base, energyMax: BAL.energy.base,
      upgrades: {}, loan: null, negMonths: 0, loanOffered: false, noClientMonths: 0,
      stats: { deals: 0, commission: 0 },
    },
    ledger: [], leagues: {}, clubs: {}, players: {}, rivals: [], inbox: [], interests: [], found: [],
    negotiation: null, goal: null, news: [], deals: [], ranking: [], history: [], flags: {}, ending: null,
  };
  seedRng(S, opts.seed === undefined ? 20260101 : opts.seed);
  createWorld(S);
  S.agency.energyMax = energyMaxFor(S);
  S.agency.energy = S.agency.energyMax;
  goal.assign(S);
  guide.start(S);
  return S;
}

const ROUTES = {
  searchPlayers: (S) => scouting.search(S), watchPlayer: scouting.watch,
  signPlayer: clients.sign, releaseClient: clients.release,
  pitchPlayer: market.pitchPlayer,
  openNegotiation: negotiation.open, negPreview: negotiation.preview, negPropose: negotiation.propose,
  negAcceptCounter: (S) => negotiation.acceptCounter(S), negWalkAway: (S) => negotiation.walkAway(S),
  buyUpgrade: upgrades.buy,
  answerInbox: events.answerInbox,
  skipGuide: (S) => guide.skip(S),
  takeLoan: (S) => takeLoan(S),
  continueEndless: (S) => ending.continueEndless(S),
};
/** Action ids whose result is read-only data: act() returns `{ok:true, preview: data}`. */
const PREVIEWS = new Set(['negPreview']);
export const ACTION_IDS = Object.keys(ROUTES);

/**
 * Perform a player action. Never throws for player mistakes.
 * @param {object} S
 * @param {string} actionId one of ACTION_IDS
 * @param {object} [payload]
 * @returns {{ok:true,events:object[]}|{ok:false,error:string}}
 */
export function act(S, actionId, payload = {}) {
  const fn = ROUTES[actionId];
  if (!fn) return { ok: false, error: 'Bilinmeyen eylem' };
  if (S.time.phase === 'over' && actionId !== 'continueEndless') return { ok: false, error: 'Kariyer sona erdi' };
  const res = fn(S, payload);
  if (PREVIEWS.has(actionId) && res && res.ok === undefined) return { ok: true, preview: res };
  if (res && res.ok) guide.onAction(S, actionId, res);
  return res;
}

/** Advance one month. See turn.js. */
export function advance(S) { return advanceMonth(S); }

/** @returns {string} compact JSON of the whole state (see save.js; use this for saves/export) */
export function serialize(S) { return pack(S); }
/** @param {string} json @returns {object} S (throws on corrupt/incompatible saves) */
export function deserialize(json) { return unpack(json); }
export { MONTHS };
