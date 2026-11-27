import { html, cx, clamp } from '../lib.js';
import { Icon } from './Icon.js';

/**
 * <Meter value max=100 threshold label valueText tone="auto|lime|gold|danger|info|rival" hint size="sm|md|lg" />
 * `threshold` draws a notch + label ("Eşik"); tone auto = lime when value>=threshold, gold otherwise (or lime if no threshold).
 */
export function Meter({ value, max = 100, threshold, thresholdLabel = 'Eşik', label, valueText, tone = 'auto', hint, size = 'md', class: cls }) {
  const pct = clamp((value / max) * 100, 0, 100);
  const t = threshold != null ? clamp((threshold / max) * 100, 0, 100) : null;
  const tn = tone === 'auto' ? (t == null || value >= threshold ? 'lime' : 'gold') : tone;
  return html`<div class=${cx('meter', `meter--${tn}`, `meter--${size}`, cls)} role="meter" aria-valuemin="0" aria-valuemax=${max} aria-valuenow=${Math.round(value)} aria-label=${label}>
    ${label || valueText != null ? html`<div class="meter__head"><span>${label}</span><b class="num">${valueText ?? Math.round(value)}</b></div>` : null}
    <div class="meter__track">
      <div class="meter__fill" style=${{ width: pct + '%' }}></div>
      ${t != null ? html`<div class="meter__mark" style=${{ left: t + '%' }}><span>${thresholdLabel}</span></div>` : null}
    </div>
    ${hint ? html`<div class="meter__hint">${hint}</div>` : null}
  </div>`;
}

/**
 * <PipMeter value max variant="energy|patience" label />  — discrete pips (energy = slanted bolts, patience = dots)
 */
export function PipMeter({ value, max, variant = 'energy', label, class: cls }) {
  return html`<div class=${cx('pips', `pips--${variant}`, cls)} role="meter" aria-valuemin="0" aria-valuemax=${max} aria-valuenow=${value} aria-label=${label || variant}>
    ${Array.from({ length: max }, (_, i) => html`<i class=${cx('pip', i < value && 'is-on')}></i>`)}
  </div>`;
}

/** <Stars value=1..5 /> — filled stars of 5. <Stars lo hi /> shows a potential range as "3–5 ★" (filled up to lo, outlined up to hi). */
export function Stars({ value, lo, hi, label, class: cls }) {
  const range = lo != null && hi != null && lo !== hi;
  const full = range ? lo : (value ?? lo ?? 0);
  const upto = range ? hi : full;
  const text = range ? `${lo}–${hi} ★` : `${full} ★`;
  return html`<span class=${cx('stars', range && 'stars--range', cls)} role="img" aria-label=${(label ? label + ' ' : '') + text}>
    ${[1, 2, 3, 4, 5].map((i) => html`<i class=${cx('stars__s', i <= full && 'is-on', i > full && i <= upto && 'is-maybe')}></i>`)}
    ${range ? html`<small class="stars__txt num">${text}</small>` : null}
  </span>`;
}
