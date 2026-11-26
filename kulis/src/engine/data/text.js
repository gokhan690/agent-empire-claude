// Turkish text helpers shared by data/events.js, data/news.js and ending.js. Pure, no state.

const VOWELS = 'aeıioöuü';
const VOICELESS = 'fstkçşhp';

function norm(w) {
  return w.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase()
    .replace(/[áàâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i').replace(/[óòô]/g, 'o').replace(/[úùû]/g, 'u');
}

/**
 * Turkish case suffix with vowel harmony, written after an apostrophe (proper names).
 * kind: gen (-ın) | dat (-a) | acc (-ı) | loc (-da) | abl (-dan) | ins (ile -> -la/-le) | pl (-lar).
 * @param {string} word @param {string} kind @returns {string} e.g. ek('Kerem','gen') -> "Kerem'in"
 */
export function ek(word, kind) {
  const w = norm(String(word).trim());
  if (!w) return String(word);
  let v = '';
  for (let i = w.length - 1; i >= 0; i--) if (VOWELS.includes(w[i])) { v = w[i]; break; }
  const last = w[w.length - 1];
  const endsVowel = VOWELS.includes(last);
  const back = 'aıou'.includes(v);
  const round = 'ouöü'.includes(v);
  const two = back ? 'a' : 'e';
  const four = back ? (round ? 'u' : 'ı') : (round ? 'ü' : 'i');
  const d = VOICELESS.includes(last) ? 't' : 'd';
  let s;
  switch (kind) {
    case 'gen': s = (endsVowel ? 'n' : '') + four + 'n'; break;
    case 'dat': s = (endsVowel ? 'y' : '') + two; break;
    case 'acc': s = (endsVowel ? 'y' : '') + four; break;
    case 'loc': s = d + two; break;
    case 'abl': s = d + two + 'n'; break;
    case 'ins': s = (endsVowel ? 'y' : '') + 'l' + two; break;
    case 'pl': s = 'l' + two + 'r'; break;
    default: s = '';
  }
  return String(word).trim() + "'" + s;
}

/** Money in the UI style: 850 -> "€850", 450_000 -> "€450K", 1_250_000 -> "€1,25M". */
export function eur(n) {
  n = Math.round(Number(n) || 0);
  const a = Math.abs(n), sg = n < 0 ? '−' : '';
  if (a >= 1e6) { const m = Math.round(a / 1e4) / 100; return sg + '€' + String(m).replace('.', ',') + 'M'; }
  if (a >= 1e4) return sg + '€' + Math.round(a / 1000) + 'K';
  if (a >= 1e3) { const k = Math.round(a / 100) / 10; return sg + '€' + String(k).replace('.', ',') + 'K'; }
  return sg + '€' + a;
}

const MONEY_KEY = /^(amount|fee|wage|price|gift|cost|bonus|offer|debt|fine|sum|loan|prize)\d*$/;

/**
 * Render a template: {key} plain, {key:gen|dat|acc|loc|abl|ins|pl} Turkish suffix after an apostrophe.
 * Money-named numeric keys (amount, fee, wage, ...) are formatted with eur(). Unknown keys stay as written
 * (the tests look for leftovers).
 * @param {string} str @param {object} R @returns {string}
 */
export function fmt(str, R) {
  if (typeof str !== 'string') return str;
  return str.replace(/\{(\w+)(?::(\w+))?\}/g, (m, k, kind) => {
    let v = R[k];
    if (v === undefined || v === null) return m;
    if (typeof v === 'number') v = MONEY_KEY.test(k) ? eur(v) : String(Math.round(v * 10) / 10).replace('.', ',');
    return kind ? ek(v, kind) : String(v);
  });
}

/** Deterministic pick from an array by a string key (no RNG touched). */
export function hpick(arr, key) {
  let h = 0x811c9dc5;
  const s = String(key);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return arr[(h >>> 0) % arr.length];
}
