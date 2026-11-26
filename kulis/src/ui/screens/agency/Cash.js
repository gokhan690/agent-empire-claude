import { html, useState, Card, Button, Badge, Money, Meter, PipMeter, SectionTitle, Stat, Icon, fmtMoney, store, audio, confetti } from '../../ui-kit.js';
import * as sel from '../../../engine/selectors.js';
import { BAL } from '../../../engine/constants.js';
import { burstFrom, useGrow } from './common.js';

function Chart({ rows, selIdx, onPick }) {
  const grown = useGrow(80);
  const W = 340, H = 150, T = 14, B = 22, L = 4, R = 4;
  const n = rows.length;
  const nets = rows.map((r) => r.net);
  const max = Math.max(0, ...nets), min = Math.min(0, ...nets);
  const span = max - min || 1;
  const y0 = T + (max / span) * (H - T - B);
  const slot = (W - L - R) / Math.max(n, 12);
  const bw = Math.max(5, Math.min(20, slot * 0.68));
  return html`<svg class="agency-chart" viewBox=${`0 0 ${W} ${H}`} role="img" aria-label="Aylık net kasa değişimi">
    <line x1=${L} x2=${W - R} y1=${y0} y2=${y0} class="agency-chart__zero" />
    ${rows.map((r, i) => {
      const x = L + slot * i + (slot - bw) / 2;
      const h = Math.max(2, (Math.abs(r.net) / span) * (H - T - B));
      const y = r.net >= 0 ? y0 - h : y0;
      const sel_ = i === selIdx;
      return html`<g class=${'agency-chart__bar' + (r.net >= 0 ? ' is-pos' : ' is-neg') + (sel_ ? ' is-sel' : '')} onClick=${() => onPick(i)}>
        <rect x=${x - (slot - bw) / 2} y=${T - 6} width=${slot} height=${H - T - B + 12} class="agency-chart__hit" />
        <rect x=${x} y=${grown ? y : y0} width=${bw} height=${grown ? h : 0} rx="2.5" class="agency-chart__rect" style=${{ transitionDelay: i * 25 + 'ms' }} />
        ${sel_ ? html`<text x=${x + bw / 2} y=${H - 6} text-anchor="middle" class="agency-chart__lbl">${r.label.split(' ')[0]}</text>` : null}
      </g>`;
    })}
  </svg>`;
}

function Detail({ row }) {
  if (!row) return null;
  const inc = row.items.filter((i) => i.amt > 0), out = row.items.filter((i) => i.amt < 0);
  return html`<div class="agency-detail">
    <div class="row row--between"><b class="t-display">${row.label}</b><span class="num"><${Money} value=${row.net} sign colored /></span></div>
    ${row.items.length === 0 ? html`<p class="muted small">Bu ay kayıtlı hareket yok.</p>` : html`<ul class="agency-items">
      ${[...inc, ...out].map((it) => html`<li><span>${it.label}</span><b class="num"><${Money} value=${it.amt} sign colored /></b></li>`)}</ul>`}
    <div class="agency-detail__cash muted small">Ay sonu kasası <b class="num"><${Money} value=${row.cash} /></b></div>
  </div>`;
}

export default function Cash({ S, hub }) {
  const rows = sel.financeSeries(S).slice(-24);
  const [idx, setIdx] = useState(null);
  const cur = idx == null || idx >= rows.length ? rows.length - 1 : idx;
  const A = S.agency, loan = A.loan, st = A.stats;
  const loanTx = loan ? loan.monthly : 0;
  const est = hub.monthlyCommission - hub.upkeep - loanTx;
  const takeLoan = (e) => { const el = e.currentTarget; const r = store.act('takeLoan', {}); if (r.ok) { audio.play('coin'); burstFrom(el, confetti, { count: 40 }); } };
  const neg = hub.negMonths, maxNeg = BAL.econ.negMonthsBankrupt;
  const offer = A.loanOffered && !loan;
  return html`<div class="stack agency-sec">
    <${Card} chalk tone=${A.cash < 0 ? 'danger' : undefined} class="agency-cashhead">
      <div class="eyebrow">Kasa</div>
      <div class=${'agency-cashhead__big num' + (A.cash < 0 ? ' danger' : '')}><${Money} value=${A.cash} count /></div>
      <div class="agency-cashhead__est ${est >= 0 ? 'lime' : 'danger'}"><${Icon} name=${est >= 0 ? 'trendUp' : 'arrowDown'} size=${15} />Tahmini aylık net <b class="num"><${Money} value=${est} sign /></b></div>
    </${Card}>

    <${SectionTitle} right=${rows.length ? 'Son ' + rows.length + ' ay' : null}>Aylık net</${SectionTitle}>
    <${Card}>
      ${rows.length ? html`<${Chart} rows=${rows} selIdx=${cur} onPick=${(i) => { audio.play('tick'); setIdx(i); }} />
        <div class="agency-chart__nav">
          <button type="button" class="iconbtn" aria-label="Önceki ay" disabled=${cur <= 0} onClick=${() => setIdx(Math.max(0, cur - 1))}><${Icon} name="chevronLeft" /></button>
          <span class="muted small">Bir aya dokun, kalemlerini gör</span>
          <button type="button" class="iconbtn" aria-label="Sonraki ay" disabled=${cur >= rows.length - 1} onClick=${() => setIdx(Math.min(rows.length - 1, cur + 1))}><${Icon} name="chevronRight" /></button>
        </div>
        <${Detail} row=${rows[cur]} />` : html`<p class="muted small agency-note">İlk ayı oynattığında kasa hareketleri burada grafik olur.</p>`}
    </${Card}>

    <${SectionTitle}>Bu ay</${SectionTitle}>
    <div class="grid-2">
      <${Card}><${Stat} label="Komisyon geliri" icon="cash" tone="lime" value=${html`<${Money} value=${hub.monthlyCommission} />`} hint="Müşteri maaşlarından aylık pay" /></${Card}>
      <${Card}><${Stat} label="Sabit gider" icon="building" tone="danger" value=${html`<${Money} value=${hub.upkeep} />`} hint=${loanTx ? `+ kredi taksiti ${fmtMoney(loanTx)}` : 'Ofis + yükseltmeler'} /></${Card}>
    </div>

    <${Card} tone=${offer ? 'gold' : loan ? undefined : undefined} eyebrow="Banka" title=${loan ? 'Aktif kredi' : offer ? 'Kredi teklifi var' : 'Kredi'}>
      ${loan ? html`<div class="agency-loan"><div><span class="muted small">Kalan</span><b class="num">${loan.monthsLeft} ay</b></div><div><span class="muted small">Aylık taksit</span><b class="num"><${Money} value=${loan.monthly} /></b></div><div><span class="muted small">Çekilen</span><b class="num"><${Money} value=${loan.principal} /></b></div></div>`
        : offer ? html`<p class="small">Banka sana ${fmtMoney(BAL.econ.loan.amount)} kredi veriyor: ${BAL.econ.loan.months} ay boyunca aylık ${fmtMoney(Math.ceil(BAL.econ.loan.amount * (1 + BAL.econ.loan.rate) / BAL.econ.loan.months))}. Tek seferlik can simidi.</p>
          <${Button} variant="gold" block onClick=${takeLoan}>Krediyi al</${Button}>`
        : html`<p class="muted small">Kasa eksiye düşerse banka bir defaya mahsus kredi teklif eder. Şu an teklif yok.</p>`}
    </${Card}>

    <${Card} tone=${neg > 0 ? 'danger' : undefined} eyebrow="İflas riski" title=${neg === 0 ? 'Güvendesin' : `${neg}. eksi ay`}>
      <${Meter} value=${neg} max=${maxNeg} tone=${neg === 0 ? 'lime' : neg >= maxNeg - 1 ? 'danger' : 'gold'} valueText=${`${neg} / ${maxNeg}`} label="Üst üste eksi kasa ayı" />
      <p class="muted small">${maxNeg} ay üst üste kasa eksideyse ajansın iflas eder ve kariyer biter. Kasa artıya dönünce sayaç sıfırlanır.</p>
    </${Card}>

    <${SectionTitle}>Kariyer toplamı</${SectionTitle}>
    <div class="grid-3 agency-totals">
      <${Card}><${Stat} label="Transfer" value=${st.deals} /></${Card}>
      <${Card}><${Stat} label="Komisyon" value=${html`<${Money} value=${st.commission} />`} /></${Card}>
      <${Card}><${Stat} label="Hayal" tone="gold" value=${st.dreams} /></${Card}>
      <${Card}><${Stat} label="Tutulan söz" tone="lime" value=${st.promisesKept} /></${Card}>
      <${Card}><${Stat} label="Bozulan söz" tone=${st.promisesBroken ? 'danger' : undefined} value=${st.promisesBroken} /></${Card}>
      <${Card}><${Stat} label="Yakalanan blöf" value=${st.bluffsCaught || 0} /></${Card}>
    </div>
  </div>`;
}
