import { html, Card, Button, Badge, Meter, Money, SectionTitle, EmptyState, Icon, store, audio, confetti } from '../../ui-kit.js';
import * as sel from '../../../engine/selectors.js';
import { burstFrom } from './common.js';

export const TIER = {
  safe: { label: 'Güvenli', tone: 'lime', icon: 'shield', hint: 'Düşük risk, küçük ödül' },
  balanced: { label: 'Dengeli', tone: 'gold', icon: 'target', hint: 'Orta risk, iyi ödül' },
  bold: { label: 'Cesur', tone: 'danger', icon: 'flame', hint: 'Yüksek risk, büyük ödül' },
};

export function Reward({ r }) {
  return html`<span class="agency-reward"><${Icon} name="cash" size=${14} /><b class="num"><${Money} value=${r.cash} /></b><${Icon} name="star" size=${14} /><b class="num">+${r.rep} itibar</b></span>`;
}

/** The three offered objectives (also used inline by the SeasonEnd overlay). */
export function OfferCards({ offered, onChosen }) {
  const pick = (o) => (e) => {
    const el = e.currentTarget;
    const r = store.act('chooseObjective', { objectiveId: o.id });
    if (r.ok) { audio.play('confirm'); burstFrom(el, confetti, { count: 50 }); onChosen && onChosen(o); }
  };
  return html`<div class="agency-offers">${offered.map((o) => {
    const t = TIER[o.tier] || TIER.balanced;
    return html`<${Card} class=${'agency-offer agency-offer--' + o.tier} tone=${o.tier === 'bold' ? 'danger' : o.tier === 'balanced' ? 'gold' : 'lime'}>
      <div class="row row--between"><${Badge} tone=${t.tone} icon=${t.icon}>${t.label}</${Badge}><span class="muted small">${t.hint}</span></div>
      <h3 class="agency-offer__title">${o.title}</h3>
      <p class="muted small">${o.text}</p>
      <div class="row row--between agency-offer__foot"><${Reward} r=${o.reward} />
        <${Button} size="sm" variant=${o.tier === 'bold' ? 'gold' : 'primary'} onClick=${pick(o)}>Seç</${Button}></div>
    </${Card}>`;
  })}</div>`;
}

export default function Goal({ S, hub }) {
  const v = sel.objectiveView(S);
  const a = v.active;
  return html`<div class="stack agency-sec">
    ${a ? html`<${Card} chalk glow tone=${a.failed ? 'danger' : 'lime'} eyebrow=${`Bu sezonun hedefi · ${(TIER[a.tier] || {}).label || ''}`} title=${a.title}>
      <p class="muted small">${a.text}</p>
      <${Meter} size="lg" value=${a.progress} max=${a.target || 1} tone=${a.failed ? 'danger' : a.pct >= 1 ? 'gold' : 'lime'} valueText=${a.kind === 'rank' ? (a.pct >= 1 ? 'Hedefte' : 'Peşindesin') : `${Math.round(a.progress).toLocaleString('tr-TR')} / ${Math.round(a.target).toLocaleString('tr-TR')}`} label="İlerleme" />
      <div class="row row--between agency-offer__foot"><${Reward} r=${a.reward} />${a.failed ? html`<${Badge} tone="danger">Kaçtı</${Badge}>` : a.endOnly ? html`<${Badge} tone="muted" icon="clock">Sezon sonunda belli olur</${Badge}>` : null}</div>
    </${Card}>` : v.offered.length ? html`<${SectionTitle}>Yeni sezon, yeni hedef</${SectionTitle}>
      <p class="muted small">Sezon başında üç hedef önerilir; birini seç. Tamamlarsan nakit ve itibar ödülü gelir. Seçmezsen sezon hedefsiz geçer.</p>
      <${OfferCards} offered=${v.offered} />`
      : html`<${EmptyState} icon="target" title="Şu an aktif hedef yok" body="Yeni hedefler her sezonun Temmuz ayında önerilir." />`}

    <${SectionTitle}>Geçmiş hedefler</${SectionTitle}>
    ${v.history.length ? html`<ul class="agency-hist">${v.history.slice().reverse().map((h) => html`<li class=${h.result === 'done' ? 'is-done' : 'is-failed'}>
      <span class="agency-hist__ico"><${Icon} name=${h.result === 'done' ? 'check' : 'close'} size=${16} strokeWidth=${2.6} /></span>
      <div class="grow"><b>${h.title}</b><div class="muted small">Sezon ${h.season} · ${(TIER[h.tier] || {}).label || ''}</div></div>
      ${h.result === 'done' && h.reward ? html`<${Reward} r=${h.reward} />` : html`<${Badge} tone="danger">Kaçtı</${Badge}>`}
    </li>`)}</ul>` : html`<p class="muted small agency-note">Henüz tamamlanmış ya da kaçırılmış hedef yok.</p>`}
  </div>`;
}
