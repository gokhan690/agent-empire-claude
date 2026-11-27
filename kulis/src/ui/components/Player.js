import { html, cx, fmtMoney } from '../lib.js';
import { Avatar } from './Avatar.js';
import { PosChip } from './Layout.js';
import { audio } from '../fx/audio.js';

/** One word + dot for a mood tone ('good' | 'mid' | 'bad'). */
export function MoodDot({ tone, word, class: cls }) {
  return html`<span class=${cx('mood', `mood--${tone}`, cls)} title=${'Ruh hali: ' + word}><i></i>${word ? html`<em>${word}</em>` : null}</span>`;
}

/**
 * Compact client row: avatar, name, position, age, value, one mood indicator.
 * `p`: { id, name, age, pos, value, moodTone, moodWord }.
 */
export function PlayerRow({ p, colors, right, onClick, class: cls }) {
  const Tag = onClick ? 'button' : 'div';
  return html`<${Tag} type=${onClick ? 'button' : undefined} class=${cx('prow', onClick && 'prow--tap', cls)} onClick=${onClick ? (e) => { audio.play('click'); onClick(e); } : undefined}>
    <${Avatar} id=${p.id} size=${44} colors=${colors} />
    <div class="prow__main">
      <div class="prow__name">${p.name}</div>
      <div class="prow__meta"><${PosChip} pos=${p.pos} /><span>${p.age} yaş</span><span class="num">${fmtMoney(p.value)}</span></div>
    </div>
    <div class="prow__right">${right ?? html`<${MoodDot} tone=${p.moodTone} word=${p.moodWord} />`}</div>
  </${Tag}>`;
}
