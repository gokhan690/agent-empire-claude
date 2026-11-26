import { html, cx } from '../lib.js';
import { Avatar, Crest } from './Avatar.js';
import { PosChip, Badge } from './Layout.js';
import { PotentialBand } from './Meters.js';
import { Icon } from './Icon.js';
import { audio } from '../fx/audio.js';

/**
 * UI-level player shape (map engine players into this): { id, name, age, pos, ca }.
 * `club`: { name, colors:[c1,c2], crest:0..5 }  `band`: { lo, hi, know? }  `right`: vnode shown at the far right.
 * `badges`: [{ tone, icon, text }]
 */
export function PlayerRow({ p, club, band, right, badges, onClick, selected, class: cls }) {
  const Tag = onClick ? 'button' : 'div';
  return html`<${Tag} type=${onClick ? 'button' : undefined} class=${cx('prow', onClick && 'prow--tap', selected && 'is-selected', cls)}
    onClick=${onClick ? (e) => { audio.play('click'); onClick(e); } : undefined}>
    <${Avatar} id=${p.id} size=${48} colors=${club && club.colors} />
    <div class="prow__main">
      <div class="prow__name">${p.name}</div>
      <div class="prow__meta"><${PosChip} pos=${p.pos} /><span>${p.age} yaş</span>${club ? html`<span class="prow__club"><${Crest} colors=${club.colors} pattern=${club.crest} size=${13} />${club.name}</span>` : null}</div>
      ${band ? html`<${PotentialBand} ca=${p.ca} lo=${band.lo} hi=${band.hi} compact />` : null}
      ${badges && badges.length ? html`<div class="prow__badges">${badges.map((b) => html`<${Badge} tone=${b.tone} icon=${b.icon}>${b.text}</${Badge}>`)}</div>` : null}
    </div>
    <div class="prow__right">${right ?? html`<div class="prow__ca num" aria-label=${`Güç ${p.ca}`}>${p.ca}<small>GÜÇ</small></div>`}</div>
  </${Tag}>`;
}

/** Larger hero card: <PlayerCard p club band stats=${[{label,value}]} footer=${vnode} onClick /> */
export function PlayerCard({ p, club, band, stats, footer, onClick, class: cls }) {
  const Tag = onClick ? 'button' : 'div';
  return html`<${Tag} type=${onClick ? 'button' : undefined} class=${cx('pcard', onClick && 'pcard--tap', cls)} onClick=${onClick ? (e) => { audio.play('click'); onClick(e); } : undefined}>
    <div class="pcard__top">
      <${Avatar} id=${p.id} size=${72} colors=${club && club.colors} ring />
      <div class="pcard__id">
        <div class="pcard__name">${p.name}</div>
        <div class="prow__meta"><${PosChip} pos=${p.pos} /><span>${p.age} yaş</span></div>
        ${club ? html`<div class="pcard__club"><${Crest} colors=${club.colors} pattern=${club.crest} size=${16} />${club.name}</div>` : null}
      </div>
      <div class="pcard__ca num">${p.ca}<small>GÜÇ</small></div>
    </div>
    ${band ? html`<${PotentialBand} ca=${p.ca} lo=${band.lo} hi=${band.hi} know=${band.know} />` : null}
    ${stats ? html`<div class="pcard__stats">${stats.map((s) => html`<div><b class="num">${s.value}</b><span>${s.label}</span></div>`)}</div>` : null}
    ${footer || null}
  </${Tag}>`;
}
