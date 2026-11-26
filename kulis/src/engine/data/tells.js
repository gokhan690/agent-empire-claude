// STUB — phase 2c. Director tells: 5 levels by gap (≤5%, ≤12%, ≤22%, ≤35%, >35%) × persona.
// TELLS[persona][level 0..4] = {face:'...', lines:['...']}
export const TELLS = {};
/**
 * @param {string} persona
 * @param {number} level 0..4 (0 = almost there)
 * @returns {{face:string, line:string}}
 */
export function tellLine(persona, level) { return { face: 'neutral', line: '' }; }
