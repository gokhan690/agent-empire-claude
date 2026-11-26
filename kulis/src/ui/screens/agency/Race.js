import { html, Card, Badge, Money, NumberTicker, SectionTitle, Icon, fmtInt, fmtMoney } from '../../ui-kit.js';
import * as sel from '../../../engine/selectors.js';
import { useGrow } from './common.js';

function Sparkline({ S, hub }) {
  const hist = S.history || [];
  const pts = hist.map((h) => ({ x: h.season, y: h.rank, done: true }));
  pts.push({ x: hub.season, y: hub.rank, done: false });
  const W = 320, H = 118, L = 26, R = 14, T = 12, B = 22;
  const n = pts.length;
  const X = (i) => (n === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const Y = (rank) => T + ((rank - 1) / 4) * (H - T - B);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
  return html`<svg class="agency-spark" viewBox=${`0 0 ${W} ${H}`} role="img" aria-label="Sezon sonlarındaki sıralaman">
    ${[1, 2, 3, 4, 5].map((r) => html`<g><line x1=${L} x2=${W - R} y1=${Y(r)} y2=${Y(r)} class=${r === 1 ? 'agency-spark__top' : 'agency-spark__grid'} />
      <text x=${L - 8} y=${Y(r) + 4} text-anchor="end" class="agency-spark__lbl">${r}.</text></g>`)}
    ${n > 1 ? html`<path d=${path} class="agency-spark__line" pathLength="1" />` : null}
    ${pts.map((p, i) => html`<g>
      <circle cx=${X(i)} cy=${Y(p.y)} r=${p.done ? 5 : 5.5} class=${p.done ? (p.y === 1 ? 'agency-spark__dot is-gold' : 'agency-spark__dot') : 'agency-spark__dot is-now'} />
      <text x=${X(i)} y=${H - 6} text-anchor="middle" class="agency-spark__lbl">${p.done ? 'S' + p.x : 'Şimdi'}</text></g>`)}
  </svg>`;
}

export default function Race({ S, hub }) {
  const rows = sel.rankingView(S);
  const grown = useGrow();
  const me = rows.find((r) => r.isYou);
  const max = Math.max(1, ...rows.map((r) => r.score));
  const above = me && me.rank > 1 ? rows[me.rank - 2] : null;
  const below = me && me.rank < rows.length ? rows[me.rank] : null;
  const left = hub.seasons >= 900 ? null : Math.max(0, hub.seasons - hub.season + 1);
  const gap = above ? above.score - me.score : 0;
  return html`<div class="stack agency-sec">
    <${Card} chalk glow=${me && me.rank === 1} tone=${me && me.rank === 1 ? 'gold' : undefined} class="agency-hero">
      <div class="agency-hero__rank num">${me ? me.rank : '–'}<small>. sıra</small></div>
      <div class="agency-hero__text">
        ${me && me.rank === 1
          ? html`<b class="gold">Zirvedesin!</b><span>${below ? html`2. sıradaki ${below.name} ile fark ${html`<${Money} value=${me.score - below.score} />`}.` : ''}</span>`
          : html`<b>1. sıraya <${Money} value=${gap} /> uzaktasın</b><span>${above ? html`Önünde ${above.name} var.` : ''}</span>`}
        <span class="agency-hero__left"><${Icon} name="calendar" size=${14} />${left == null ? 'Sonsuz mod: kariyer süresiz sürüyor.' : left === 1 ? 'Kariyerin bitmesine son sezon.' : `Kariyerin bitmesine ${left} sezon.`}</span>
      </div>
    </${Card}>

    <${SectionTitle}>Ajans yarışı</${SectionTitle}>
    <ol class="agency-ladder">
      ${rows.map((r, i) => html`<li class=${'agency-rival' + (r.isYou ? ' is-you' : '')} style=${{ '--rc': r.color }}>
        <div class="agency-rival__rank num">${r.rank}</div>
        <div class="agency-rival__body">
          <div class="agency-rival__top">
            <span class="agency-rival__name">${r.name}${r.isYou ? html` <${Badge} tone="lime">Sen</${Badge}>` : null}</span>
            <span class="agency-rival__score num"><${NumberTicker} value=${r.score} format=${(n) => fmtMoney(n)} duration=${900} /></span>
          </div>
          <div class="agency-rival__meta">${r.isYou ? r.owner : html`${r.owner} · <em>${r.personaLabel}</em>`}<span>${r.clients} müşteri · itibar ${r.rep}</span></div>
          <div class="agency-bar"><i style=${{ width: grown ? Math.max(3, (r.score / max) * 100) + '%' : '0%', transitionDelay: i * 90 + 'ms' }}></i></div>
        </div>
      </li>`)}
    </ol>

    <${SectionTitle}>Sıralaman sezon sezon</${SectionTitle}>
    <${Card}>
      ${(S.history || []).length ? html`<${Sparkline} S=${S} hub=${hub} />` : html`<p class="muted small agency-note">İlk sezon bitince sıralama geçmişin burada çizilecek. Şimdilik ${hub.rank}. sıradasın.</p>`}
    </${Card}>
    <p class="muted small agency-note">Puan; kasanın yarısı, müşteri portföyünün gücü ve itibardan oluşur. Rakipler her ay kendi hamlelerini yapar.</p>
  </div>`;
}
