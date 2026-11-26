import { html, Card, Button, Badge, Money, PipMeter, Icon, toast, fmtMoney, store, audio, confetti, haptics } from '../../ui-kit.js';
import * as sel from '../../../engine/selectors.js';
import { burstFrom } from './common.js';
import { BAL } from '../../../engine/constants.js';

const BRANCH = {
  scout: { icon: 'eye', blurb: 'Keşif ve takip: daha çok aday, daha az rakip ısısı.' },
  table: { icon: 'handshake', blurb: 'Pazarlık masasında sabır, Koz ve tavan bilgisi.' },
  network: { icon: 'phone', blurb: 'Enerji, güven ve Son Gün temposu.' },
};
const energyBonus = (n) => (n >= 1 ? 1 : 0) + (n >= 3 ? 1 : 0);

function Track({ level, texts }) {
  return html`<ol class="agency-track" aria-label=${`Seviye ${level} / 4`}>
    ${[0, 1, 2, 3].map((i) => html`<li class=${'agency-node' + (i < level ? ' is-done' : i === level ? ' is-next' : '')} title=${texts[i]}>
      <span class="agency-node__dot num">${i < level ? html`<${Icon} name="check" size=${14} strokeWidth=${3} />` : i + 1}</span>
    </li>`)}
  </ol>`;
}

function Branch({ pv, texts, cash }) {
  const meta = BRANCH[pv.branch];
  const lvl = pv.level;
  const eGain = pv.branch === 'network' && !pv.maxed ? energyBonus(pv.nextLevel) - energyBonus(lvl) : 0;
  const reason = pv.maxed ? null : !pv.canAfford ? `Yeterli paran yok (${fmtMoney(Math.max(0, pv.cost - cash))} eksik)` : null;
  const buy = (e) => {
    const el = e.currentTarget;
    const before = store.S.agency.energyMax;
    const r = store.act('buyUpgrade', { branch: pv.branch });
    if (!r.ok) return;
    audio.play('levelup'); haptics.success && haptics.success();
    burstFrom(el, confetti, { colors: ['#3DDC84', '#F5C451', '#EEF4EF'] });
    const after = store.S.agency.energyMax;
    toast.success(after > before ? `${pv.name} Sv.${pv.nextLevel}: enerji tavanı ${before} → ${after}` : `${pv.name} Sv.${pv.nextLevel} açıldı`, { sfx: false });
  };
  return html`<${Card} class="agency-branch" tone=${pv.maxed ? 'gold' : undefined}>
    <header class="agency-branch__head">
      <span class="agency-branch__ico"><${Icon} name=${meta.icon} size=${22} /></span>
      <div class="grow"><h3 class="t-display">${pv.name}</h3><p class="muted small">${meta.blurb}</p></div>
      <${Badge} tone=${pv.maxed ? 'gold' : 'muted'}>Sv. ${lvl}/4</${Badge}>
    </header>
    <${Track} level=${lvl} texts=${texts} />
    <ol class="agency-levels">
      ${texts.map((t, i) => html`<li class=${i < lvl ? 'is-done' : i === lvl ? 'is-next' : ''}><span class="num">${i + 1}</span><em>${t}</em></li>`)}
    </ol>
    ${pv.maxed ? html`<p class="agency-branch__max gold"><${Icon} name="star" size=${15} fill />Bu dal tamamen açıldı.</p>` : html`<div class="agency-branch__next">
      <span class="eyebrow">Sıradaki: Sv. ${pv.nextLevel}</span>
      ${eGain ? html`<p class="agency-branch__energy"><${Icon} name="bolt" size=${14} fill />Enerji tavanı ${store.S.agency.energyMax} → ${store.S.agency.energyMax + eGain}</p>` : null}
      <div class="agency-branch__cost">
        <span>Bedel <b class="num"><${Money} value=${pv.cost} /></b></span>
        <span>Aylık gider <b class="num danger">+<${Money} value=${pv.upkeepDelta} /></b></span>
      </div>
      <${Button} block variant=${pv.canAfford ? 'primary' : 'ghost'} disabled=${!pv.canAfford} cash=${pv.cost} onClick=${buy}>Yükselt</${Button}>
      ${reason ? html`<p class="agency-reason">${reason}</p>` : null}
    </div>`}
  </${Card}>`;
}

export default function Office({ S, hub }) {
  const views = sel.upgradeView(S);
  return html`<div class="stack agency-sec">
    <${Card} class="agency-office-head">
      <div class="row row--between"><div><div class="eyebrow">Enerji tavanı</div><div class="agency-office-head__big num">${S.agency.energyMax}<small> / ay</small></div></div>
        <${PipMeter} value=${S.agency.energyMax} max=${6} variant="energy" label="Enerji tavanı" /></div>
      <p class="muted small">Aylık üst gider: <b><${Money} value=${hub.upkeep} /></b>. Her yükseltme ofis giderini kalıcı artırır; gelir getirmez, ama seni hızlandırır.</p>
    </${Card}>
    <div class="cols-2">
      ${views.map((pv) => html`<${Branch} pv=${pv} texts=${BAL.upgrade.text[pv.branch]} cash=${S.agency.cash} />`)}
    </div>
  </div>`;
}
