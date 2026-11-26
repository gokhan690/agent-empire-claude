import { html, cx, fmtMoney } from '../lib.js';
import { Icon } from './Icon.js';
import { audio } from '../fx/audio.js';
import { haptics } from '../fx/haptics.js';

/**
 * <Button variant="primary|ghost|danger|gold" size="sm|md|lg" loading disabled block icon="bolt"
 *         energy=1 cash=2000 sfx="click"|false onClick>label</Button>
 * `energy`/`cash` render a cost badge on the right so the player sees the price BEFORE pressing.
 */
export function Button({ variant = 'primary', size = 'md', loading, disabled, block, icon, energy, cash, sfx, onClick, type = 'button', class: cls, children, ...rest }) {
  const off = disabled || loading;
  const handle = (e) => {
    if (off) { e.preventDefault(); return; }
    if (sfx !== false) { audio.play(sfx || 'click'); haptics.tap(); }
    onClick && onClick(e);
  };
  return html`<button type=${type} class=${cx('btn', `btn--${variant}`, `btn--${size}`, block && 'btn--block', loading && 'is-loading', off && 'is-off', cls)}
    aria-disabled=${off ? 'true' : undefined} aria-busy=${loading ? 'true' : undefined} onClick=${handle} ...${rest}>
    ${loading ? html`<span class="btn__spin" aria-hidden="true"></span>` : icon ? html`<${Icon} name=${icon} size=${size === 'lg' ? 22 : 18} />` : null}
    <span class="btn__label">${children}</span>
    ${energy != null ? html`<span class="btn__cost btn__cost--energy" title="Enerji"><${Icon} name="bolt" size=${13} />${energy}</span>` : null}
    ${cash != null ? html`<span class="btn__cost btn__cost--cash" title="Para">${fmtMoney(cash)}</span>` : null}
  </button>`;
}

/** Square icon-only button (44px hit area). `label` is required for a11y. */
export function IconButton({ icon, label, onClick, size = 20, class: cls, sfx, ...rest }) {
  return html`<button type="button" class=${cx('iconbtn', cls)} aria-label=${label} title=${label}
    onClick=${(e) => { if (sfx !== false) { audio.play(sfx || 'click'); haptics.tap(); } onClick && onClick(e); }} ...${rest}>
    <${Icon} name=${icon} size=${size} /></button>`;
}
