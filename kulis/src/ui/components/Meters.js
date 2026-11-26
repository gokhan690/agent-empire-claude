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
 * <PipMeter value max variant="energy|patience|loyalty" label />  — discrete pips (energy = slanted bolts, patience = dots)
 */
export function PipMeter({ value, max, variant = 'energy', label, class: cls }) {
  return html`<div class=${cx('pips', `pips--${variant}`, cls)} role="meter" aria-valuemin="0" aria-valuemax=${max} aria-valuenow=${value} aria-label=${label || variant}>
    ${Array.from({ length: max }, (_, i) => html`<i class=${cx('pip', i < value && 'is-on')}></i>`)}
  </div>`;
}

const LO = 40, HI = 99;
const pos = (v) => clamp(((v - LO) / (HI - LO)) * 100, 0, 100);
/**
 * <PotentialBand ca lo hi know compact />  — hidden-potential band on a 40–99 scale with a current-ability marker.
 * The band is the *shown* range (the truth is always inside, not necessarily centred). `know` (0-100) is optional caption.
 */
export function PotentialBand({ ca, lo, hi, know, compact, class: cls }) {
  const w = hi - lo;
  return html`<div class=${cx('pband', compact && 'pband--compact', cls)} role="img" aria-label=${`Güç ${ca}, potansiyel ${lo} ile ${hi} arası`}>
    <div class="pband__track">
      ${[50, 60, 70, 80, 90].map((v) => html`<i class="pband__tick" style=${{ left: pos(v) + '%' }}></i>`)}
      <div class=${cx('pband__range', w >= 14 && 'is-wide')} style=${{ left: pos(lo) + '%', width: Math.max(2, pos(hi) - pos(lo)) + '%' }}></div>
      <div class="pband__ca" style=${{ left: pos(ca) + '%' }}><b class="num">${ca}</b></div>
    </div>
    ${compact ? null : html`<div class="pband__legend"><span>Güç <b class="num">${ca}</b></span>
      <span class="pband__pot">Potansiyel <b class="num">${lo}–${hi}</b></span>${know != null ? html`<span class="pband__know"><${Icon} name="eye" size=${12} /> %${Math.round(know)}</span>` : null}</div>`}
  </div>`;
}
