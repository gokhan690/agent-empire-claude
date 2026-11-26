// STUB — phase 2c. Scripted first-months cards (first visit, first scout trip, first negotiation).
// Progress in S.flags.tutorial (number) and S.flags.seen.

/**
 * Called once from newGame: add the first scripted inbox card(s) (events.addCard).
 * @param {object} S
 * @returns {object[]} UI events
 */
export function start(S) { return []; }

/**
 * Called after each successful player action by game.act (`actionId`, `result`) so the tutorial can advance.
 * @param {object} S
 * @param {string} actionId
 * @param {object} result
 * @returns {void}
 */
export function onAction(S, actionId, result) {}

/**
 * Monthly (turn step 10, after events.monthly): next scripted card for the first months.
 * @param {object} S
 * @returns {object[]} UI events
 */
export function monthly(S) { return []; }
