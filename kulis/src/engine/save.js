// Compact (de)serialisation. In memory S keeps the full authoritative shape; the saved JSON omits
// default-valued player fields, packs `st` as an array and restores everything on load.
// (~0.65 MB raw → well under 600 KB; round-trips to a deep-equal state.)

export const SAVE_VERSION = 2;

const PD = { form: 0, injured: 0, agentId: null, know: 0, seen: false };
const SPECIAL = new Set(['cf', 'career', 'st']);

function packPlayer(p) {
  const o = {};
  for (const k in p) {
    if (SPECIAL.has(k)) continue;
    if (k in PD && p[k] === PD[k]) continue;
    o[k] = p[k];
  }
  if (p.cf !== p.ca) o.cf = p.cf;
  if (p.career.length) o.career = p.career;
  const s = p.st;
  o.st = [s.apps, s.mins, s.goals, s.assists, s.ratingSum, s.last, s.m, s.sh];
  const c = {};
  for (const k of Object.keys(o).sort()) c[k] = o[k]; // canonical key order
  return c;
}
function unpackPlayer(o) {
  const p = { ...o };
  for (const k in PD) if (!(k in p)) p[k] = PD[k];
  if (!('cf' in p)) p.cf = p.ca;
  if (!('career' in p)) p.career = [];
  const s = o.st;
  p.st = { apps: s[0], mins: s[1], goals: s[2], assists: s[3], ratingSum: s[4], last: s[5], m: s[6], sh: s[7] };
  return p;
}

/** @param {object} S @returns {string} compact JSON */
export function pack(S) {
  const players = {};
  for (const id in S.players) players[id] = packPlayer(S.players[id]);
  return JSON.stringify({ ...S, players });
}
/** @param {string} json @returns {object} full-shape S */
export function unpack(json) {
  const S = JSON.parse(json);
  if (!S || S.v !== SAVE_VERSION || !S.players || !S.clubs) throw new Error('Geçersiz kayıt');
  const players = {};
  for (const id in S.players) players[id] = unpackPlayer(S.players[id]);
  S.players = players;
  return S;
}
