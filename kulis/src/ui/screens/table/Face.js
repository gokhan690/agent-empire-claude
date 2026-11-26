// Procedural director face — 5 expressions (smile / neutral / frown / angry / stand), animated via CSS on [data-face].
import { html, cx, hash32, mulberry32, useRef } from '../../ui-kit.js';

const SKINS = ['#F2CBA7', '#E3B48A', '#C98F63', '#A56B45', '#7B4B2E'];
const HAIRS = ['#1A1410', '#2E2018', '#5A5A5E', '#C9C9CC', '#3B2A1C'];
const SUITS = ['#1E2A3A', '#2A2F33', '#3A1F2B', '#1F3328', '#2B2B45'];
const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
};
let uid = 0;

export function DirectorFace({ seed = 'x', colors = ['#2F7DE1', '#EEF4EF'], face = 'neutral', talking = false, leaving = false, size = 168, label }) {
  const idRef = useRef(null);
  if (!idRef.current) idRef.current = 'df' + (++uid);
  const id = idRef.current;
  const r = mulberry32(hash32('dir:' + seed));
  const pick = (a) => a[Math.floor(r() * a.length)];
  const skin = pick(SKINS), hair = pick(HAIRS), suit = pick(SUITS);
  const style = Math.floor(r() * 4), stache = r() < 0.4, glasses = r() < 0.35;
  const skinD = shade(skin, -0.16), skinL = shade(skin, 0.12), suitD = shade(suit, -0.35), suitL = shade(suit, 0.12);
  const brow = shade(hair, hair === '#C9C9CC' ? -0.35 : 0);
  const ink = '#2A120F';
  const hairPath = [
    html`<path d="M56 84 C52 48 76 34 100 34 C124 34 148 48 144 84 C140 68 128 56 100 56 C72 56 60 68 56 84Z" fill=${hair}/>`,
    html`<g fill=${hair}><path d="M56 92 C52 72 58 62 64 60 C60 72 60 84 62 98Z"/><path d="M144 92 C148 72 142 62 136 60 C140 72 140 84 138 98Z"/></g>`,
    html`<path d="M54 88 C46 50 74 30 104 32 C132 34 152 54 146 88 C142 70 130 54 104 54 C80 54 62 64 54 88Z" fill=${hair}/>`,
    html`<g><path d="M56 86 C54 50 80 36 102 36 C126 36 146 50 144 86 C138 64 120 52 96 54 C76 56 62 68 56 86Z" fill=${hair}/><path d="M92 40 C90 48 90 52 94 55" stroke=${shade(hair, 0.25)} stroke-width="2" fill="none" stroke-linecap="round"/></g>`,
  ][style];
  return html`<svg class=${cx('tface', talking && 'is-talking', leaving && 'is-leaving')} data-face=${face} viewBox="0 0 200 210" width=${size} height=${Math.round(size * 1.05)} role="img" aria-label=${label || 'Kulüp direktörü'}>
    <defs>
      <clipPath id=${id + 'l'}><ellipse cx="80" cy="91" rx="10" ry="7.5"/></clipPath>
      <clipPath id=${id + 'r'}><ellipse cx="120" cy="91" rx="10" ry="7.5"/></clipPath>
      <radialGradient id=${id + 'g'} cx=".42" cy=".32" r=".85"><stop offset="0" stop-color=${skinL}/><stop offset=".55" stop-color=${skin}/><stop offset="1" stop-color=${skinD}/></radialGradient>
    </defs>
    <rect x="30" y="58" width="140" height="160" rx="46" fill="#0E1511" stroke="#26352D" stroke-width="2"/>
    <rect x="42" y="70" width="116" height="140" rx="38" fill="#141D17"/>
    <g class="tface__figure">
      <g class="tface__body">
        <path d="M12 212 C12 168 48 152 100 152 C152 152 188 168 188 212Z" fill=${suit}/>
        <path d="M78 152 L100 190 L122 152Z" fill="#F2F5F3"/>
        <path d="M78 152 L100 190 L84 212 L58 212 L68 164Z" fill=${suitD}/><path d="M122 152 L100 190 L116 212 L142 212 L132 164Z" fill=${suitD}/>
        <path d="M70 158 l8 -6 l10 12 l-9 4z" fill="#E4EAE6"/><path d="M130 158 l-8 -6 l-10 12 l9 4z" fill="#E4EAE6"/>
        <path d="M94 164 L106 164 L109 204 L100 211 L91 204Z" fill=${colors[0]}/><path d="M93 160 h14 l-2.4 8 h-9.2z" fill=${shade(colors[0], -0.25)}/>
        <path d="M136 182 l14 -3 l-1 9 h-12z" fill=${colors[1]}/>
        <path d="M14 212 C14 190 30 172 52 164" stroke=${suitL} stroke-width="2" fill="none" opacity=".5"/>
      </g>
      <path d="M86 118 h28 v36 q-14 12 -28 0z" fill=${skinD}/>
      <g class="tface__head">
        <ellipse cx="58" cy="98" rx="6.5" ry="11" fill=${skin}/><ellipse cx="142" cy="98" rx="6.5" ry="11" fill=${skin}/>
        <path d="M57 82 C57 50 78 38 100 38 C122 38 143 50 143 82 C143 104 138 124 124 136 C116 143 108 146 100 146 C92 146 84 143 76 136 C62 124 57 104 57 82Z" fill=${`url(#${id}g)`}/>
        ${hairPath}
        <g class="tface__eyes">
          <ellipse cx="80" cy="91" rx="10" ry="7.5" fill="#FAFAF7"/><ellipse cx="120" cy="91" rx="10" ry="7.5" fill="#FAFAF7"/>
          <g class="tface__pupils"><circle cx="80" cy="91.5" r="4.2" fill="#1B1410"/><circle cx="120" cy="91.5" r="4.2" fill="#1B1410"/><circle cx="81.4" cy="90" r="1.2" fill="#fff"/><circle cx="121.4" cy="90" r="1.2" fill="#fff"/></g>
          <g clip-path=${`url(#${id}l)`}><rect class="tface__lid tface__lid--l" x="66" y="70" width="28" height="15" fill=${skin}/><rect class="tface__lid2" x="66" y="98.5" width="28" height="8" fill=${skin}/><rect class="tface__blink" x="66" y="80" width="28" height="22" fill=${skin}/></g>
          <g clip-path=${`url(#${id}r)`}><rect class="tface__lid tface__lid--r" x="106" y="70" width="28" height="15" fill=${skin}/><rect class="tface__lid2" x="106" y="98.5" width="28" height="8" fill=${skin}/><rect class="tface__blink" x="106" y="80" width="28" height="22" fill=${skin}/></g>
        </g>
        ${glasses ? html`<g fill="rgba(255,255,255,.07)" stroke="#0c0f0d" stroke-width="2.2"><rect x="66" y="81" width="28" height="20" rx="7"/><rect x="106" y="81" width="28" height="20" rx="7"/><path d="M94 89 h12" fill="none"/></g>` : null}
        <g class="tface__brow tface__brow--l"><rect x="67" y="72" width="27" height="6" rx="3" fill=${brow}/></g>
        <g class="tface__brow tface__brow--r"><rect x="106" y="72" width="27" height="6" rx="3" fill=${brow}/></g>
        <path d="M100 96 C97 108 95 112 99 114 C102 115 106 113 104 108" fill="none" stroke=${skinD} stroke-width="2.4" stroke-linecap="round"/>
        <circle class="tface__cheek tface__cheek--warm" cx="71" cy="113" r="9" fill="#E8776C"/><circle class="tface__cheek tface__cheek--warm" cx="129" cy="113" r="9" fill="#E8776C"/>
        <path class="tface__vein" d="M112 50 l4 7 l-5 3 l4 8" fill="none" stroke="#E0453F" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        <g class="tface__mouth">
          <path class="m m-neutral" d="M89 129 Q100 131 111 129" fill="none" stroke=${ink} stroke-width="3" stroke-linecap="round"/>
          <path class="m m-smile" d="M83 124 Q100 144 117 124 Q100 131 83 124Z" fill="#FAFAF7" stroke=${ink} stroke-width="2.4" stroke-linejoin="round"/>
          <path class="m m-frown" d="M88 135 Q100 122 112 135" fill="none" stroke=${ink} stroke-width="3" stroke-linecap="round"/>
          <g class="m m-angry"><path d="M85 131 Q100 121 115 131 L112 138 Q100 133 88 138Z" fill="#2A0D0D"/><path d="M90 130.5 Q100 126 110 130.5 L109 134 Q100 130.5 91 134Z" fill="#FAFAF7"/></g>
          <g class="m m-stand"><path d="M85 126 Q100 119 115 126 Q118 145 100 147 Q82 145 85 126Z" fill="#2A0D0D"/><path d="M92 140 Q100 133 108 140 Q100 146 92 140Z" fill="#C94B4B"/><path d="M89 126.5 Q100 122 111 126.5 L110 131 Q100 127 90 131Z" fill="#FAFAF7"/></g>
        </g>
        ${stache ? html`<path d="M81 121 C90 113 98 118 100 120 C102 118 110 113 119 121 C111 126 102 123 100 123 C98 123 89 126 81 121Z" fill=${shade(hair, hair === '#C9C9CC' ? -0.2 : 0)}/>` : null}
      </g>
    </g>
  </svg>`;
}
