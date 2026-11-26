// Compact (de)serialisation. In memory S keeps the full authoritative shape; the saved JSON omits
// default-valued player fields, packs `st`/`dream` as arrays and restores everything on load.
// (~0.65 MB raw → well under 600 KB; round-trips to a deep-equal state.)

const PD = {
  form: 0, injured: 0, guarantee: false, releaseClause: 0, agentId: null, rep: null, know: 0, seen: false,
  heat: 0, shortlisted: false, dreamKnown: false, lastVisit: null,
};
const SPECIAL = new Set(['cf', 'career', 'st', 'dream']);

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
  o.dream = [p.dream.type, p.dream.target, p.dream.done ? 1 : 0];
  return o;
}
function unpackPlayer(o) {
  const p = { ...o };
  for (const k in PD) if (!(k in p)) p[k] = PD[k];
  if (!('cf' in p)) p.cf = p.ca;
  if (!('career' in p)) p.career = [];
  const s = o.st;
  p.st = { apps: s[0], mins: s[1], goals: s[2], assists: s[3], ratingSum: s[4], last: s[5], m: s[6], sh: s[7] };
  const d = o.dream;
  p.dream = Array.isArray(d) ? { type: d[0], target: d[1], done: !!d[2] } : d;
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
  if (!S || S.v !== 1 || !S.players || !S.clubs) throw new Error('Geçersiz kayıt');
  const players = {};
  for (const id in S.players) players[id] = unpackPlayer(S.players[id]);
  S.players = players;
  return S;
}
