import { html, useState, Card, Chip, Badge, Money, Button, SectionTitle, EmptyState, Icon, Crest, fmtMoney, MONTH_NAMES } from '../../ui-kit.js';
import { ClubTag, openPlayer, openClub, playerOf, clubOf } from './common.js';

const KIND = {
  transferYou: ['handshake', 'lime', 'İMZA'], signing: ['handshake', 'lime', 'İMZA'], transfer: ['swap', 'info', 'TRANSFER'], transferAI: ['swap', 'muted', 'TRANSFER'],
  transferRival: ['swap', 'rival', 'RAKİP AJANS'], rivalSign: ['eye', 'rival', 'RAKİP AJANS'], rival: ['eye', 'rival', 'RAKİP AJANS'], poach: ['alert', 'rival', 'KAPIDA'],
  dreamFulfilled: ['star', 'gold', 'HAYAL'], dream: ['star', 'gold', 'HAYAL'], promiseKept: ['check', 'lime', 'SÖZ TUTULDU'], promiseBroken: ['alert', 'danger', 'SÖZ BOZULDU'],
  champion: ['trophy', 'gold', 'ŞAMPİYON'], promoted: ['trendUp', 'lime', 'TERFİ'], relegated: ['arrowDown', 'danger', 'DÜŞTÜ'], award: ['star', 'gold', 'ÖDÜL'], topscorer: ['ball', 'gold', 'GOL KRALI'],
  injury: ['alert', 'danger', 'SAKATLIK'], bankruptcyWarning: ['alert', 'danger', 'KASA ALARMI'], wonderkidBreakout: ['flame', 'gold', 'PATLAMA'], deadlineDrama: ['clock', 'info', 'SON GÜN'],
  objectiveDone: ['target', 'lime', 'HEDEF'], objective: ['target', 'lime', 'HEDEF'], retire: ['whistle', 'muted', 'VEDA'], clientLeft: ['alert', 'danger', 'AYRILDI'], release: ['close', 'muted', 'AYRILIK'],
  repExpired: ['pen', 'muted', 'SÖZLEŞME'], client: ['users', 'lime', 'MÜŞTERİ'], deal: ['handshake', 'lime', 'ANLAŞMA'], genel: ['news', 'muted', 'HABER'],
};
const kindOf = (k) => KIND[k] || KIND.genel;
const AGENCY_KINDS = new Set(['objective', 'objectiveDone', 'bankruptcyWarning', 'deadlineDrama']);
const when = (n) => `${MONTH_NAMES[n.month] || ''} · Sezon ${n.season}`;

function Headline({ n, i }) {
  const [icon, tone, tag] = kindOf(n.kind);
  const pl = n.playerId && playerOf(n.playerId), cl = n.clubId && clubOf(n.clubId);
  const go = pl ? () => openPlayer(n.playerId) : cl ? () => openClub(n.clubId) : null;
  const mine = pl && pl.agentId === 'you';
  const body = html`<span class=${'agency-news__ico agency-news__ico--' + tone}><${Icon} name=${icon} size=${18} /></span>
    <span class="agency-news__main">
      <span class="agency-news__tag"><b class=${tone}>${tag}</b>${mine ? html`<${Badge} tone="lime">Müşterin</${Badge}>` : null}<em>${when(n)}</em></span>
      <span class="agency-news__text">${n.text}</span>
    </span>
    ${go ? html`<${Icon} name="chevronRight" size=${16} />` : null}`;
  return go ? html`<button type="button" class=${'agency-news__item is-tap' + (mine ? ' is-mine' : '')} onClick=${go}>${body}</button>`
    : html`<div class=${'agency-news__item' + (mine ? ' is-mine' : '')}>${body}</div>`;
}

export default function News({ S }) {
  const [mineOnly, setMine] = useState(true);
  const [limit, setLimit] = useState(20);
  const all = S.news || [];
  const list = mineOnly ? all.filter((n) => (n.playerId && playerOf(n.playerId) && playerOf(n.playerId).agentId === 'you') || AGENCY_KINDS.has(n.kind)) : all;
  const deals = (S.deals || []).slice(-8).reverse();
  return html`<div class="stack agency-sec">
    <${SectionTitle}>Son anlaşmaların</${SectionTitle}>
    ${deals.length ? html`<div class="agency-deals">${deals.map((d) => {
      const p = playerOf(d.playerId), to = clubOf(d.toClubId), from = clubOf(d.fromClubId);
      return html`<button type="button" class="agency-deal" onClick=${() => (p ? openPlayer(d.playerId) : openClub(d.toClubId))}>
        <div class="agency-deal__who"><b>${p ? p.name : 'Oyuncu'}</b><span class="muted small">${MONTH_NAMES[d.month]} · Sezon ${d.season}${d.kind === 'free' ? ' · bedelsiz' : d.kind === 'renewal' ? ' · yenileme' : ''}</span></div>
        <div class="agency-deal__move">${from ? html`<${Crest} colors=${from.colors} pattern=${from.crest} size=${20} />` : null}<${Icon} name="arrowRight" size=${14} />${to ? html`<${Crest} colors=${to.colors} pattern=${to.crest} size=${20} />` : null}</div>
        <div class="agency-deal__fee"><b class="num lime">+${fmtMoney(d.commission)}</b><span class="muted small">${d.fee ? 'Bedel ' + fmtMoney(d.fee) : 'komisyon'}</span></div>
      </button>`;
    })}</div>` : html`<p class="muted small agency-note">Henüz tamamlanmış bir anlaşman yok. İlk imzanın haberi burada olacak.</p>`}

    <${SectionTitle}>Kulis haberleri</${SectionTitle}>
    <div class="row row--wrap"><${Chip} active=${mineOnly} icon="users" onClick=${() => { setMine(true); setLimit(20); }}>Benim oyuncularım</${Chip}><${Chip} active=${!mineOnly} icon="news" onClick=${() => { setMine(false); setLimit(20); }}>Tümü</${Chip}></div>
    ${list.length ? html`<div class="agency-news">${list.slice(0, limit).map((n, i) => html`<${Headline} n=${n} i=${i} />`)}</div>
      ${list.length > limit ? html`<${Button} variant="ghost" block onClick=${() => setLimit(limit + 20)}>Daha fazla göster (${list.length - limit})</${Button}>` : null}`
      : html`<${EmptyState} icon="news" title=${mineOnly ? 'Senin oyuncularından haber yok' : 'Gazeteler sessiz'} body=${mineOnly ? 'Müşterilerin hakkında çıkan haberler burada toplanır. "Tümü" ile tüm dünyayı gör.' : 'Ay ilerledikçe manşetler burada birikecek.'} />`}
  </div>`;
}
