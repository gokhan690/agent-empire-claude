import { html, cx, useRef } from '../lib.js';
import { Icon } from './Icon.js';
import { audio } from '../fx/audio.js';

/** <Card tone="default|must|gold|lime|rival|danger" glow chalk onClick eyebrow title action>…</Card> */
export function Card({ tone, glow, chalk, onClick, eyebrow, title, action, class: cls, children, ...rest }) {
  const Tag = onClick ? 'button' : 'section';
  return html`<${Tag} type=${onClick ? 'button' : undefined} class=${cx('card', tone && `card--${tone}`, glow && 'card--glow', chalk && 'card--chalk', onClick && 'card--tap', cls)}
    onClick=${onClick ? (e) => { audio.play('click'); onClick(e); } : undefined} ...${rest}>
    ${eyebrow || title || action ? html`<header class="card__head">
      <div>${eyebrow ? html`<div class="eyebrow">${eyebrow}</div>` : null}${title ? html`<h3 class="card__title">${title}</h3>` : null}</div>
      ${action ? html`<div class="card__action">${action}</div>` : null}</header>` : null}
    ${children}
  </${Tag}>`;
}

/** Section heading with chalk line: <SectionTitle right=${node}>Başlık</SectionTitle> */
export function SectionTitle({ children, right, class: cls }) {
  return html`<div class=${cx('sec-title', cls)}><span>${children}</span><i class="sec-title__line"></i>${right ? html`<span class="sec-title__right">${right}</span>` : null}</div>`;
}

/** <EmptyState icon="inbox" title="…" body="…" action=${<Button/>} /> — chalk-drawn pitch illustration. */
export function EmptyState({ icon = 'ball', title, body, action, class: cls }) {
  return html`<div class=${cx('empty', cls)}>
    <div class="empty__art" aria-hidden="true">
      <svg viewBox="0 0 120 120" width="120" height="120" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="60" cy="60" r="44" stroke-dasharray="3 5" opacity=".55"/><circle cx="60" cy="60" r="28" opacity=".35"/>
        <path d="M60 16v88" opacity=".25"/><path d="M12 60h96" opacity=".18"/>
      </svg>
      <span class="empty__icon"><${Icon} name=${icon} size=${30} /></span>
    </div>
    <h3 class="empty__title">${title}</h3>
    ${body ? html`<p class="empty__body">${body}</p>` : null}
    ${action ? html`<div class="empty__action">${action}</div>` : null}
  </div>`;
}

/** <Badge tone="lime|gold|danger|info|rival|muted" icon="flame">text</Badge> */
export function Badge({ tone = 'muted', icon, class: cls, children }) {
  return html`<span class=${cx('badge', `badge--${tone}`, cls)}>${icon ? html`<${Icon} name=${icon} size=${12} />` : null}${children}</span>`;
}
/** Selectable pill (filters). <Chip active onClick>U21</Chip> */
export function Chip({ active, onClick, icon, class: cls, children }) {
  return html`<button type="button" class=${cx('chip', active && 'is-active', cls)} aria-pressed=${active ? 'true' : 'false'} onClick=${() => { audio.play('click'); onClick && onClick(); }}>
    ${icon ? html`<${Icon} name=${icon} size=${14} />` : null}${children}</button>`;
}
const POS_LABEL = { KL: 'Kaleci', DF: 'Defans', OS: 'Orta Saha', FV: 'Forvet' };
/** Position chip: <PosChip pos="OS" /> (KL | DF | OS | FV) */
export function PosChip({ pos }) {
  return html`<span class=${cx('pos', `pos--${pos}`)} title=${POS_LABEL[pos] || pos}>${pos}</span>`;
}

/**
 * <Tabs items=${[{id,label,icon?,badge?}]} value onChange variant="underline|segmented" />
 * Arrow keys move between tabs (roving tabindex).
 */
export function Tabs({ items, value, onChange, variant = 'underline', class: cls, label }) {
  const ref = useRef();
  const onKey = (e) => {
    const i = items.findIndex((t) => t.id === value);
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % items.length; else if (e.key === 'ArrowLeft') n = (i - 1 + items.length) % items.length;
    if (n < 0) return;
    e.preventDefault(); onChange(items[n].id);
    requestAnimationFrame(() => ref.current && ref.current.querySelectorAll('[role=tab]')[n]?.focus());
  };
  return html`<div class=${cx('tabs', `tabs--${variant}`, cls)} role="tablist" aria-label=${label} ref=${ref} onKeyDown=${onKey}>
    ${items.map((t) => html`<button type="button" role="tab" class=${cx('tabs__tab', t.id === value && 'is-active')} aria-selected=${t.id === value ? 'true' : 'false'}
      tabindex=${t.id === value ? 0 : -1} onClick=${() => { if (t.id !== value) { audio.play('click'); onChange(t.id); } }}>
      ${t.icon ? html`<${Icon} name=${t.icon} size=${16} />` : null}<span>${t.label}</span>${t.badge ? html`<em class="tabs__badge">${t.badge}</em>` : null}
    </button>`)}
  </div>`;
}
/** Alias: segmented control. */
export const Segmented = (p) => Tabs({ ...p, variant: 'segmented' });

/**
 * <Stat label value delta unit big icon tone /> — label + big condensed value; `delta` shows an arrow (+up lime / −down danger).
 * `value` may be a string/number/vnode (e.g. <Money/>).
 */
export function Stat({ label, value, delta, unit, big, icon, tone, hint, class: cls }) {
  const up = delta > 0, down = delta < 0;
  return html`<div class=${cx('stat', big && 'stat--big', tone && `stat--${tone}`, cls)}>
    <div class="stat__label">${icon ? html`<${Icon} name=${icon} size=${13} />` : null}${label}</div>
    <div class="stat__value num">${value}${unit ? html`<small>${unit}</small>` : null}
      ${delta != null && delta !== 0 ? html`<span class=${cx('stat__delta', up ? 'is-up' : 'is-down')}><${Icon} name=${up ? 'arrowUp' : 'arrowDown'} size=${13} strokeWidth=${2.4} />${Math.abs(Math.round(delta * 10) / 10)}</span>` : null}</div>
    ${hint ? html`<div class="stat__hint">${hint}</div>` : null}
  </div>`;
}
