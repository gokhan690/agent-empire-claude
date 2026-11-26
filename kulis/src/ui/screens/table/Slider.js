// Range slider with value readout, nudge buttons (thumb-friendly) and labelled markers (client demand, fair value, warning limit).
import { html, cx, clamp, Icon, audio, haptics } from '../../ui-kit.js';

/** Nice step for a range: ~1/200 of the span snapped to 1/2/5 × 10^k, never below `min`. */
export function niceStep(span, min = 100) {
  const raw = Math.max(min, span / 200);
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

/**
 * <Slider label value min max step onChange format markers=[{value,label,tone}] tone="lime|gold" hint nudge />
 * markers whose labels would collide are staggered (alternate rows above the track).
 */
export function Slider({ label, value, min, max, step = 100, onChange, format = (v) => String(v), markers = [], tone = 'lime', hint, nudge, big }) {
  const span = Math.max(1, max - min);
  const pct = (v) => clamp(((v - min) / span) * 100, 0, 100);
  const snap = (v) => clamp(Math.round(v / step) * step, min, max);
  const nd = nudge || Math.max(step, Math.round((span / 40) / step) * step);
  const ms = markers.filter((m) => m && m.value != null && m.value >= min && m.value <= max).sort((a, b) => a.value - b.value);
  let lastRow = -1, lastPos = -99;
  const placed = ms.map((m) => {
    const p = pct(m.value);
    const row = p - lastPos < 24 ? (lastRow + 1) % 2 : 0;
    lastRow = row; lastPos = p;
    return { ...m, p, row };
  });
  const bump = (d) => { const v = snap(value + d); if (v !== value) { onChange(v); audio.play('tick'); haptics.tap(); } };
  return html`<div class=${cx('tslider', `tslider--${tone}`, big && 'tslider--big')}>
    <div class="tslider__head"><span class="tslider__label">${label}</span><b class="tslider__value num">${format(value)}</b></div>
    <div class="tslider__row">
      <button type="button" class="tslider__nudge" aria-label=${label + ' azalt'} onClick=${() => bump(-nd)}><${Icon} name="minus" size=${18} /></button>
      <div class="tslider__track" style=${{ '--f': pct(value) / 100 }}>
        <div class="tslider__marks" aria-hidden="true">
          ${placed.map((m) => html`<span class=${cx('tslider__mark', m.tone && `is-${m.tone}`, m.row && 'is-low', m.p > 82 && 'is-right', m.p < 18 && 'is-left')} style=${{ '--m': m.p / 100 }}><i></i><em>${m.label}</em></span>`)}
        </div>
        <input type="range" min=${min} max=${max} step=${step} value=${value} aria-label=${label} onInput=${(e) => { const v = snap(+e.target.value); if (v !== value) { onChange(v); haptics.tap(); } }} />
      </div>
      <button type="button" class="tslider__nudge" aria-label=${label + ' artır'} onClick=${() => bump(nd)}><${Icon} name="plus" size=${18} /></button>
    </div>
    ${hint ? html`<div class="tslider__hint">${hint}</div>` : null}
  </div>`;
}
