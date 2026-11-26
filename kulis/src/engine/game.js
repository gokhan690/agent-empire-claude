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
import * as deadline from './deadline.js';
import * as events from './events.js';
import * as objectives from './objectives.js';
import * as tutorial from './tutorial.js';
import * as ending from './ending.js';
import { pack, unpack } from './save.js';

/**
 * Create a new game.
 * @param {{seed?:number|string, agentName?:string, agencyName?:string, archetype?:'mahalle'|'eskifutbolcu'|'hukukcu', careerSeasons?:number}} [opts]
 * @returns {object} S
 */
export function newGame(opts = {}) {
  const S = {
    v: 1, seed: 0, rng: 0, seq: 0,
    meta: { agentName: opts.agentName || 'Ajan', agencyName: opts.agencyName || 'Kulis Menajerlik', archetype: opts.archetype || 'mahalle', careerSeasons: opts.careerSeasons || BAL.careerSeasons },
    time: { season: 1, month: 0, phase: 'plan' },
    agency: {
      cash: BAL.start.cash, rep: BAL.start.rep, energy: BAL.energy.base, energyMax: BAL.energy.base,
      upgrades: { scout: 0, table: 0, network: 0 }, loan: null, negMonths: 0, loanOffered: false,
      stats: { deals: 0, commission: 0, promisesKept: 0, promisesBroken: 0, bluffsCaught: 0, dreams: 0 },
    },
    ledger: [], leagues: {}, clubs: {}, players: {}, rivals: [], inbox: [], promises: [], interests: [],
    negotiation: null, deadline: null, objectives: { offered: [], active: null, history: [] },
    news: [], deals: [], ranking: [], history: [], flags: { tutorial: null, seen: {} }, ending: null,
  };
  seedRng(S, opts.seed === undefined ? 20260101 : opts.seed);
  createWorld(S);
  S.agency.energyMax = energyMaxFor(S);
  S.agency.energy = S.agency.energyMax;
  objectives.offer(S);
  tutorial.start(S);
  return S;
}

const ROUTES = {
  scoutTrip: scouting.scoutTrip, tripPreview: scouting.tripPreview, watchPlayer: scouting.watchPlayer, toggleShortlist: scouting.toggleShortlist,
  recruit: clients.recruit, recruitPreview: clients.recruitPreview, visitClient: clients.visitClient, releaseClient: clients.release,
  clubLunch: market.clubLunch, pitchPlayer: market.pitchPlayer, pitchPreview: market.pitchPreview, mediaPush: market.mediaPush,
  openNegotiation: negotiation.open, negPreview: negotiation.preview, negPropose: negotiation.propose,
  negAcceptCounter: (S) => negotiation.acceptCounter(S), negWalkAway: (S) => negotiation.walkAway(S), negLeanOnClient: (S) => negotiation.leanOnClient(S),
  buyUpgrade: upgrades.buy, upgradePreview: upgrades.preview,
  answerInbox: events.answerInbox,
  chooseObjective: objectives.choose,
  deadlineTakeCall: deadline.takeCall, deadlineSkipHour: (S) => deadline.skipHour(S), deadlineFinish: (S) => deadline.finish(S),
  takeLoan: (S) => takeLoan(S),
  continueEndless: (S) => ending.continueEndless(S),
};
/** Energy actions that are closed while Son Gün runs. */
const DEADLINE_CLOSED = new Set(['scoutTrip', 'watchPlayer', 'recruit', 'visitClient', 'clubLunch', 'mediaPush']);
/** Action ids whose result is read-only data: act() returns `{ok:true, preview: data}`. */
const PREVIEWS = new Set(['tripPreview', 'recruitPreview', 'pitchPreview', 'negPreview', 'upgradePreview']);
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
  if (S.time.phase === 'deadline' && DEADLINE_CLOSED.has(actionId)) return { ok: false, error: 'Son Gün sürüyor: sadece arama, masa ve öneri' };
  let res = fn(S, payload);
  if (PREVIEWS.has(actionId) && res && res.ok === undefined) return { ok: true, preview: res };
  if (res && res.ok) tutorial.onAction(S, actionId, res);
  return res;
}

/** Advance one month (or start Son Gün). See turn.js. */
export function advance(S) { return advanceMonth(S); }

/** @returns {string} compact JSON of the whole state (see save.js; use this for saves/export) */
export function serialize(S) { return pack(S); }
/** @param {string} json @returns {object} S (throws on corrupt/incompatible saves) */
export function deserialize(json) { return unpack(json); }
export { MONTHS };
