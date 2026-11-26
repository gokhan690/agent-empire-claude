// STUB — phase 2a (agency systems). Fill in the bodies; keep names & signatures.
// Scouting: trips reveal prospects, watching narrows the potential band, shortlist, passive discovery.
// Hidden potential: p.know 0..100; band via selectors.potentialBand. Unrepresented discovered players
// have p.seen=true and p.heat 0..100 (rival interest; rivals.monthly raises it).
import { notReady } from './util.js';

/** @typedef {{ok:true,events:object[],[k:string]:any}|{ok:false,error:string}} Result */

/**
 * Preview of a scout trip (costs shown before confirming).
 * @param {object} S
 * @param {{leagueId:string, focus:'u21'|'form'|'expiring'|'any'}} a
 * @returns {{energy:number, cash:number, count:number}} cost (1 E + travel €) and prospects revealed (3, 4 at scout L1)
 */
export function tripPreview(S, a) { return { energy: 1, cash: 0, count: 3 }; }

/**
 * Scout trip: spend 1 energy + travel €, reveal prospects (seen=true, know=starting know, +15 at scout L2).
 * @param {object} S
 * @param {{leagueId:string, focus:'u21'|'form'|'expiring'|'any'}} a
 * @returns {Result} on success `{ok:true, events:[{type:'scout', playerIds:[...]}], prospects:string[]}`
 */
export function scoutTrip(S, a) { return notReady(); }

/**
 * Watch a player: 1 energy, know +30 (narrower band), trait revealed at know ≥ 60.
 * @param {object} S
 * @param {{playerId:string}} a
 * @returns {Result}
 */
export function watchPlayer(S, a) { return notReady(); }

/**
 * Toggle p.shortlisted (free action).
 * @param {object} S
 * @param {{playerId:string}} a
 * @returns {Result}
 */
export function toggleShortlist(S, a) { return notReady(); }

/**
 * Monthly hook (turn step 8): passive discovery at scout L3+, heat slows on shortlist at L4.
 * @param {object} S
 * @returns {object[]} UI events
 */
export function monthly(S) { return []; }
