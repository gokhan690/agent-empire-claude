import { html, cx, MONTH_NAMES, fmtMoney } from '../lib.js';
import { Icon } from './Icon.js';
import { PipMeter } from './Meters.js';
import { NumberTicker } from './Money.js';
import { IconButton } from './Button.js';
import { audio } from '../fx/audio.js';

export const NAV_TABS = [
  { id: 'hub', label: 'Gündem', icon: 'inbox' },
  { id: 'players', label: 'Oyuncular', icon: 'users' },
  { id: 'scout', label: 'Keşif', icon: 'eye' },
  { id: 'market', label: 'Piyasa', icon: 'swap' },
  { id: 'agency', label: 'Ajans', icon: 'building' },
];

/**
 * <TopBar cash rep energy energyMax season month onSettings /> — values are props (app.js feeds them from the store).
 * Pass `cash=null` to show dashes (no game yet).
 */
export function TopBar({ cash, rep, energy, energyMax = 4, season, month, onSettings, muted, onMute }) {
  const has = cash != null;
  return html`<header class="topbar">
    <div class="topbar__row">
      <div class="topbar__cash" aria-label="Para">
        <span class="topbar__lbl">KASA</span>
        <b class=${cx('topbar__cashv num', has && cash < 0 && 'is-neg')}>${has ? html`<${NumberTicker} value=${cash} format=${(n) => fmtMoney(n)} />` : '—'}</b>
      </div>
      <div class="topbar__rep" aria-label="İtibar">
        <span class="topbar__lbl">İTİBAR</span>
        <b class="topbar__repv num"><${Icon} name="star" size=${15} />${has ? Math.round(rep) : '—'}</b>
      </div>
      <div class="topbar__tools">
        <${IconButton} icon=${muted ? 'soundOff' : 'soundOn'} label=${muted ? 'Sesi aç' : 'Sesi kapat'} onClick=${onMute} sfx=${false} />
        <${IconButton} icon="settings" label="Ayarlar" onClick=${onSettings} />
      </div>
    </div>
    <div class="topbar__row topbar__row--sub">
      <div class="topbar__time"><${Icon} name="calendar" size=${14} />${has ? html`<span>${MONTH_NAMES[month] || '—'}</span><i>·</i><span>Sezon ${season}</span>` : html`<span>KULİS</span>`}</div>
      <div class="topbar__energy"><span class="topbar__lbl">ENERJİ</span><${PipMeter} value=${has ? energy : 0} max=${energyMax} variant="energy" /></div>
    </div>
  </header>`;
}

/** <BottomNav route onNavigate badges=${{hub: 3, market: 1}} /> */
export function BottomNav({ route, onNavigate, badges = {} }) {
  return html`<nav class="bottomnav" aria-label="Ana menü">
    ${NAV_TABS.map((t) => html`<a href=${'#/' + t.id} class=${cx('bottomnav__tab', route === t.id && 'is-active')} aria-current=${route === t.id ? 'page' : undefined}
      onClick=${(e) => { e.preventDefault(); if (route !== t.id) audio.play('page'); onNavigate(t.id); }}>
      <span class="bottomnav__ico"><${Icon} name=${t.icon} size=${23} />${badges[t.id] ? html`<em class="bottomnav__badge">${badges[t.id] > 9 ? '9+' : badges[t.id]}</em>` : null}</span>
      <span class="bottomnav__lbl">${t.label}</span>
    </a>`)}
  </nav>`;
}
