import { useState, useEffect } from './lib.js';

export const ROUTES = ['hub', 'players', 'scout', 'market', 'agency', 'gallery'];
const parse = () => {
  const m = (location.hash || '').match(/^#\/?([a-z]+)/);
  return m && ROUTES.includes(m[1]) ? m[1] : null;
};
/** Current route name (hub|players|scout|market|agency|gallery); `fallback` if the hash is empty/unknown. */
export function useRoute(fallback = 'hub') {
  const [r, setR] = useState(parse() || fallback);
  useEffect(() => {
    const f = () => setR(parse() || fallback);
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, [fallback]);
  return r;
}
export function navigate(name) { if (parse() !== name) location.hash = '#' + name; }
export const currentRoute = parse;
