import { html, cx } from '../lib.js';

// 24x24 stroke icons. Each entry is a list of path `d` strings.
const P = {
  bolt: ['M13 2 4.5 13.5H11L10 22l9-12h-6.5z'],
  cash: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M14.6 9.3c-.5-.8-1.4-1.3-2.6-1.3-1.5 0-2.6.8-2.6 2s1 1.6 2.6 2c1.6.3 2.6.8 2.6 2s-1.1 2-2.6 2c-1.2 0-2.1-.5-2.6-1.3', 'M12 6v2M12 16v2'],
  star: ['m12 2.8 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4L12 17.4l-5.7 3 1.1-6.4L2.8 9.5l6.4-.9z'],
  handshake: ['M2 8h3v8H2z', 'M19 8h3v8h-3z', 'M5 9l4-2 3 1.5L15 7l4 2v6l-4 2-2-1.5-1.5 1.5L9 16l-4-1z', 'M9 11l2 2M12 11l2 2'],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  phone: ['M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z'],
  calendar: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4M16 3v4'],
  whistle: ['M14 9a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z', 'M2.5 10h8.5l3-3h5', 'M14 14.5h.01'],
  flame: ['M12 2.5c.8 3.6 6 5.6 6 11.3a6 6 0 0 1-12 0c0-2.6 1.6-3.8 2.4-6 1.6.8 2.4 2 2.6 3.7C11.8 8.6 12.3 5.6 12 2.5z'],
  heart: ['M12 20.5S3 15 3 8.8A4.8 4.8 0 0 1 12 6.5a4.8 4.8 0 0 1 9 2.3C21 15 12 20.5 12 20.5z'],
  trophy: ['M7 4h10v5a5 5 0 0 1-10 0z', 'M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3', 'M12 14v4M8 21h8M9 18h6'],
  arrowUp: ['M12 19V5M5 12l7-7 7 7'],
  arrowDown: ['M12 5v14M5 12l7 7 7-7'],
  arrowRight: ['M5 12h14M12 5l7 7-7 7'],
  trendUp: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
  lock: ['M5 11h14v10H5z', 'M8 11V8a4 4 0 0 1 8 0v3'],
  close: ['M6 6l12 12M18 6 6 18'],
  chevronLeft: ['m15 6-6 6 6 6'],
  chevronRight: ['m9 6 6 6-6 6'],
  chevronUp: ['m6 15 6-6 6 6'],
  chevronDown: ['m6 9 6 6 6-6'],
  settings: ['M4 7h9M19 7h1M4 17h1M11 17h9', 'M16 4.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z', 'M8 14.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z'],
  soundOn: ['M4 9v6h4l5 4V5L8 9z', 'M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11'],
  soundOff: ['M4 9v6h4l5 4V5L8 9z', 'M17 9.5l4.5 5M21.5 9.5l-4.5 5'],
  news: ['M4 4h13v16H6a2 2 0 0 1-2-2z', 'M17 8h3v10a2 2 0 0 1-2 2', 'M7 8h7M7 12h7M7 16h4'],
  building: ['M5 21V5l7-2 7 2v16', 'M3 21h18', 'M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-4h4v4'],
  inbox: ['M3 13l3-8h12l3 8v6H3z', 'M3 13h5l1 3h6l1-3h5'],
  users: ['M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M2.5 20a6.5 6.5 0 0 1 13 0', 'M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6.5 6.5 0 0 1 3.5 6'],
  swap: ['M4 8h15l-3.5-3.5M20 16H5l3.5 3.5'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 11v5M12 8h.01'],
  alert: ['M12 3 2 20h20z', 'M12 10v4M12 17h.01'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3 2'],
  pen: ['M4 20l1-4L16 5l3 3L8 19z', 'M14 7l3 3'],
  ball: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 8l3.4 2.5-1.3 4h-4.2l-1.3-4z', 'M12 8V3M15.4 10.5l5-1.5M14.1 14.5l3 4M9.9 14.5l-3 4M8.6 10.5l-5-1.5'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  play: ['M7 4.5l12 7.5-12 7.5z'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'm20 20-4-4'],
  download: ['M12 4v11M7 11l5 5 5-5', 'M4 20h16'],
  upload: ['M12 16V5M7 9l5-5 5 5', 'M4 20h16'],
  shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'],
  target: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 12h.01'],
  dice: ['M5 4h14v16H5z', 'M9 8h.01M15 8h.01M12 12h.01M9 16h.01M15 16h.01'],
};
const FILLED = new Set(['bolt', 'star', 'flame', 'heart', 'play']);

/** <Icon name="bolt" size=20 fill />  — `fill` fills the shape with currentColor (default for bolt/star/flame/heart/play). */
export function Icon({ name, size = 20, fill, class: cls, title, strokeWidth = 1.8 }) {
  const d = P[name];
  if (!d) return null;
  const filled = fill ?? FILLED.has(name);
  return html`<svg class=${cx('icon', cls)} width=${size} height=${size} viewBox="0 0 24 24" fill=${filled ? 'currentColor' : 'none'}
    stroke="currentColor" stroke-width=${strokeWidth} stroke-linecap="round" stroke-linejoin="round" aria-hidden=${title ? undefined : 'true'} role=${title ? 'img' : undefined} aria-label=${title}>
    ${d.map((p) => html`<path d=${p} />`)}
  </svg>`;
}
export const ICON_NAMES = Object.keys(P);
