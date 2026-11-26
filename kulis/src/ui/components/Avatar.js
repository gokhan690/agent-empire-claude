import { html, cx, hash32, mulberry32 } from '../lib.js';

const SKINS = ['#F6D3B8', '#EBB991', '#D49C70', '#B97B50', '#8E5B3A', '#5E3A27'];
const HAIRS = ['#14100D', '#2A1A11', '#4B2D1A', '#7B4B26', '#B3793C', '#D8B25A', '#9A9A9A', '#B8452B'];
const KITS = [['#E5423B', '#F5C451'], ['#2F7DE1', '#EEF4EF'], ['#1FA463', '#0A0F0C'], ['#F58B2A', '#14213D'], ['#7A3FD1', '#F5C451'], ['#E8E8E8', '#C8102E'], ['#0E2A47', '#5AB0FF'], ['#C9183C', '#0A0F0C']];
export const HAIR_STYLES = 10;

export function lum(hex) {
  const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Deterministic look from an id string. Exposed so screens can e.g. show the same hair colour elsewhere. */
export function avatarSpec(id) {
  const r = mulberry32(hash32('av:' + id));
  const pick = (a) => a[Math.floor(r() * a.length)];
  const skin = pick(SKINS);
  return { skin, hair: pick(HAIRS), style: Math.floor(r() * HAIR_STYLES), kit: pick(KITS), beard: r() < 0.4 ? Math.floor(r() * 3) + 1 : 0,
    mouth: Math.floor(r() * 4), brow: Math.floor(r() * 3), eyeY: 28 + (r() < 0.5 ? 0 : 0.6), tilt: (r() - 0.5) * 2 };
}

// hair: [back layer, front layer] path strings (64x64, head centre 32,27)
function hairParts(style) {
  switch (style) {
    case 0: return [null, ['M21 25.5C20 13.5 44 13.5 43 25.5 40 19.5 24 19.5 21 25.5z']]; // buzz
    case 1: return [null, ['M20.5 27C18.5 10.5 45.5 10.5 43.5 27 42.5 20.5 38 17.5 32 17.5 26 17.5 21.5 20.5 20.5 27z']]; // crop
    case 2: return [null, ['M20.5 27C17 9 47 8 43.5 27 42.5 21.5 40.5 19 36.5 18 31 20.5 25 21 22 25z', 'M36.5 18c1 2 .5 4-.5 5']]; // side part
    case 3: return [['M18.5 24a5.5 5.5 0 1 0 0 .1z'], ['M22 19a5 5 0 1 0 0 .1zM27.5 14.5a5.4 5.4 0 1 0 0 .1zM34.5 14a5.4 5.4 0 1 0 0 .1zM40.5 17.5a5 5 0 1 0 0 .1zM43.5 23.5a4.2 4.2 0 1 0 0 .1zM20.5 24a4 4 0 1 0 0 .1z']]; // curly
    case 4: return [['M32 5.5C45 5.5 51 14 49 25c-.6 4-2 6-4 7L19 32c-2-1-3.4-3-4-7-2-11 4-19.500 17-19.500z'], ['M22.500 22C25 19 29 18.500 32 18.500S39 19 41.500 22C40 19.5 36 17 32 17S24 19.500 22.500 22z']]; // afro
    case 5: return [['M19 27C16 8 48 8 45 27l1.500 15c-2 4.500-4.500 3-4.500-2L42 33 22 33l0 7c0 5-2.500 6.500-4.500 2z'], ['M21 25C21.500 15 42.500 15 43 25 40 20 26 20 21 25z']]; // long
    case 6: return [null, ['M20.500 24C20 18 24 17 24.500 17.500M43.500 24C44 18 40 17 39.500 17.500', 'M28.500 7.500c1-1.500 6-1.500 7 0l1.500 11c-3-2-10-2-12 0z']]; // mohawk
    case 7: return [null, []]; // bald
    case 8: return [null, ['M20.500 26C19 12.500 45 12.500 43.500 26 41 20 23 20 20.500 26z', 'M32 6.500a4.500 4.500 0 1 0 0 .1z']]; // bun
    default: return [null, ['M20.500 27C18 10 46 10 43.500 27 43 20 40 15.500 32 15.500S21 20 20.500 27z', 'M25 17c4-1.500 10-1.500 14 0']]; // slick
  }
}
const BROWS = [['M24.500 24.500l5-.8', 'M34.500 23.700l5 .8'], ['M24.500 24l5 .4', 'M34.500 24.400l5-.4'], ['M24.500 24.800l5-1.400', 'M34.500 23.400l5 1.400']];
const MOUTHS = [['M28.500 34.300Q32 37.300 35.500 34.300'], ['M29 35.200h6'], ['M28.800 34.800Q33 36.800 36 34'], ['M28.800 34.200Q32 39 35.200 34.200z']];

/**
 * <Avatar id="p123" size=48 colors=${[c1,c2]} ring />  — procedural footballer bust, fully deterministic from `id`.
 * `colors` overrides the kit (use the club's colours). `ring` adds a lime ring (selected / client).
 */
export function Avatar({ id, size = 48, colors, ring, class: cls, title }) {
  const s = avatarSpec(id ?? 'x');
  const kit = colors || s.kit;
  const [back, front] = hairParts(s.style);
  const shade = 'rgba(20,10,5,.16)';
  const dark = '#1a1210';
  return html`<svg class=${cx('avatar', ring && 'avatar--ring', cls)} width=${size} height=${size} viewBox="0 0 64 64" role=${title ? 'img' : undefined} aria-label=${title} aria-hidden=${title ? undefined : 'true'}>
    <rect class="avatar__bg" width="64" height="64" rx="14" />
    <rect width="64" height="64" rx="14" fill=${kit[0]} opacity=".20" />
    <path d="M0 60Q16 44 32 44T64 60" fill="none" stroke=${kit[1]} stroke-opacity=".18" stroke-width="1.5" />
    ${back ? back.map((d) => html`<path d=${d} fill=${s.hair} />`) : null}
    <path d="M7 64C7 53 17 47 32 47s25 6 25 17z" fill=${kit[0]} />
    <path d="M7 64C7 53 17 47 32 47s25 6 25 17" fill="none" stroke=${kit[1]} stroke-width="2.400" stroke-opacity=".9" />
    <rect x="27" y="35" width="10" height="13" rx="3" fill=${s.skin} />
    <path d="M27 40q5 4.500 10 0v-3H27z" fill=${shade} />
    <path d="M26 47l6 6.500 6-6.500" fill=${s.skin} stroke=${kit[1]} stroke-width="2" stroke-linejoin="round" />
    <circle cx="21" cy="28" r="2.800" fill=${s.skin} /><circle cx="43" cy="28" r="2.800" fill=${s.skin} />
    <ellipse cx="32" cy="27" rx="11" ry="13.500" fill=${s.skin} />
    ${s.beard === 1 ? html`<path d="M21.500 29Q22 40 32 40.500 42 40 42.500 29 40 35 32 35 24 35 21.500 29z" fill=${s.hair} opacity=".28" />` : null}
    ${s.beard === 2 ? html`<path d="M21.200 28Q21.500 42 32 42.200 42.500 42 42.800 28 41 36 32 36 23 36 21.200 28z" fill=${s.hair} />` : null}
    ${s.beard === 3 ? html`<path d="M26.500 33.300Q32 31 37.500 33.300 32 35.500 26.500 33.300z" fill=${s.hair} />` : null}
    <ellipse cx="27.500" cy=${s.eyeY} rx="2" ry="1.700" fill="#fff" /><ellipse cx="36.500" cy=${s.eyeY} rx="2" ry="1.700" fill="#fff" />
    <circle cx=${27.8 + s.tilt * 0.3} cy=${s.eyeY} r="1.150" fill=${dark} /><circle cx=${36.8 + s.tilt * 0.3} cy=${s.eyeY} r="1.150" fill=${dark} />
    ${BROWS[s.brow].map((d) => html`<path d=${d} stroke=${s.beard ? s.hair : dark} stroke-opacity=".8" stroke-width="1.400" stroke-linecap="round" fill="none" />`)}
    <path d="M32 29.500v3.200q-1.300.8-2.200 0" stroke=${shade} stroke-width="1.200" fill="none" stroke-linecap="round" />
    ${MOUTHS[s.mouth].map((d) => html`<path d=${d} stroke=${s.beard === 2 ? '#f3d6c6' : dark} stroke-opacity=".85" stroke-width="1.300" stroke-linecap="round" stroke-linejoin="round" fill=${s.mouth === 3 ? '#7a2a2a' : 'none'} />`)}
    ${front ? front.map((d) => /z/i.test(d) ? html`<path d=${d} fill=${s.hair} />` : html`<path d=${d} fill="none" stroke=${s.hair} stroke-width="1.600" stroke-linecap="round" />`) : null}
    ${s.style === 7 ? html`<ellipse cx="27" cy="17.500" rx="3" ry="1.400" fill="#fff" opacity=".18" />` : null}
  </svg>`;
}

let cid = 0;
const crestIds = new Map();
/**
 * <Crest colors=${[c1,c2]} pattern=${0..5} size=40 />  — procedural shield. 6 patterns: 0 stripe, 1 halves, 2 band, 3 sash, 4 chevron, 5 quarters.
 */
export function Crest({ colors = ['#2F7DE1', '#EEF4EF'], pattern = 0, size = 40, class: cls, title }) {
  const [c1, c2] = colors, p = ((pattern % 6) + 6) % 6;
  const key = `${c1}${c2}${p}`;
  if (!crestIds.has(key)) crestIds.set(key, 'cr' + (cid++));
  const id = crestIds.get(key);
  const S = 'M4 3h32v21c0 11-8 17-16 21C12 41 4 35 4 24z';
  const starOn = [c2, null, c1, null, c1, null][p];
  const starFill = starOn ? (lum(starOn) > 0.45 ? '#0A0F0C' : '#fff') : null;
  const body = [
    html`<rect width="40" height="48" fill=${c1} /><rect x="15" y="0" width="10" height="48" fill=${c2} />`,
    html`<rect width="40" height="48" fill=${c1} /><rect x="20" y="0" width="20" height="48" fill=${c2} />`,
    html`<rect width="40" height="48" fill=${c1} /><rect y="17" width="40" height="12" fill=${c2} />`,
    html`<rect width="40" height="48" fill=${c1} /><path d="M-4 6L46 34V46L-4 18z" fill=${c2} />`,
    html`<rect width="40" height="48" fill=${c1} /><path d="M0 16L20 30 40 16V26L20 40 0 26z" fill=${c2} />`,
    html`<rect width="40" height="48" fill=${c1} /><rect width="20" height="24" fill=${c2} /><rect x="20" y="24" width="20" height="24" fill=${c2} />`,
  ][p];
  return html`<svg class=${cx('crest', cls)} width=${size} height=${size * 1.2} viewBox="0 0 40 48" role=${title ? 'img' : undefined} aria-label=${title} aria-hidden=${title ? undefined : 'true'}>
    <defs><clipPath id=${id}><path d=${S} /></clipPath></defs>
    <path d=${S} fill="#000" opacity=".35" transform="translate(0 1.500)" />
    <g clip-path=${`url(#${id})`}>${body}
      ${starFill ? html`<path d="m20 7.500 1.700 3.500 3.800.5-2.800 2.600.7 3.800L20 16l-3.400 1.900.7-3.800-2.800-2.600 3.800-.5z" fill=${starFill} opacity=".92" />` : null}
      <ellipse cx="14" cy="8" rx="14" ry="7" fill="#fff" opacity=".10" />
    </g>
    <path d=${S} fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.400" stroke-linejoin="round" />
  </svg>`;
}
