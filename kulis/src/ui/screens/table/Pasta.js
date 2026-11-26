// The "pasta" (pie): wage / bonus / YOUR fee / clause cost as one stacked bar, with the unseen ceiling hatched on the right.
import { html, cx, Icon, Meter } from '../../ui-kit.js';
import { BAL } from '../../../engine/constants.js';
import { eur } from './lib.js';

export const pkgParts = (pkg) => {
  const C = BAL.neg.clause, c = pkg.clauses || {};
  const wage = pkg.wage * 12 * pkg.years, bonus = pkg.bonus, fee = pkg.fee;
  const base = wage + bonus + fee;
  const clause = Math.round(base * ((c.minutes ? C.minutes : 0) + (c.release ? C.release : 0)));
  return { wage, bonus, fee, clause, base, cost: base + clause };
};

export function Pasta({ pkg, fair, counter, lastCost, band, prev }) {
  const P = pkgParts(pkg);
  const fairCost = pkgParts(fair).cost;
  const scale = Math.max(P.cost, counter ? counter.cost : 0, band ? band.hi : 0, lastCost || 0, fairCost * 1.3) * 1.06;
  const scaleW = Math.max(scale, P.cost / 0.78);
  const w = (v) => Math.max(0, (v / scaleW) * 100) + '%';
  const left = (v) => Math.min(99.5, (v / scaleW) * 100) + '%';
  const seg = [
    { k: 'wage', label: 'Oyuncu maaşı', v: P.wage, cls: 'is-wage' },
    { k: 'bonus', label: 'İmza primi', v: P.bonus, cls: 'is-bonus' },
    { k: 'fee', label: 'Senin komisyonun', v: P.fee, cls: 'is-fee' },
    { k: 'clause', label: 'Maddeler', v: P.clause, cls: 'is-clause' },
  ];
  const share = prev ? prev.feeSharePct : P.cost ? Math.round((P.fee / P.cost) * 1000) / 10 : 0;
  return html`<div class="tpasta">
    <div class="tpasta__top">
      <div><div class="eyebrow">Kulübe toplam maliyet</div><div class="tpasta__cost num">${eur(P.cost)}</div></div>
      <div class="tpasta__fx">${prev && prev.transferFee ? html`<span class="muted small">+ bonservis ${eur(prev.transferFee)} (kulüpler arası)</span>` : null}</div>
    </div>
    <div class="tpasta__bar" role="img" aria-label=${`Paket maliyeti ${eur(P.cost)}`}>
      <div class="tpasta__segs">
        ${seg.map((s) => html`<i class=${cx('tpasta__seg', s.cls)} style=${{ width: w(s.v) }} title=${`${s.label}: ${eur(s.v)}`}></i>`)}
      </div>
      <div class="tpasta__unseen" style=${{ left: w(P.cost) }}><span>tavan ?</span></div>
      ${band ? html`<div class="tpasta__band" style=${{ left: left(band.lo), width: Math.max(2, ((band.hi - band.lo) / scaleW) * 100) + '%' }}><span>ipucu</span></div>` : null}
      ${counter ? html`<div class="tpasta__tick is-counter" style=${{ left: left(counter.cost) }}><em>onun teklifi</em></div>` : null}
      ${lastCost ? html`<div class="tpasta__tick is-last" style=${{ left: left(lastCost) }}><em>son teklifin</em></div>` : null}
    </div>
    <div class="tpasta__legend">
      ${seg.filter((s) => s.v > 0 || s.k !== 'clause').map((s) => html`<div class=${cx('tpasta__lg', s.cls)}><i></i><span>${s.label}</span><b class="num">${eur(s.v)}</b></div>`)}
    </div>
    <p class="tpasta__note"><${Icon} name="info" size=${14} /> Üç yönlü gerilim: oyuncunun maaşı, senin komisyonun ve direktörün görünmeyen tavanı aynı pastadan pay alır. Komisyonun büyürse maaşa yer kalmaz, ikisi birden büyürse tavanı aşarsın.</p>
  </div>`;
}

const ZONE = (v) => (v >= 50 ? 'lime' : v >= 40 ? 'gold' : 'danger');
/** Client satisfaction gauge: 0..100 with the 40 (İkna et) and 50 (İmza) thresholds and the reason chips. */
export function Satisfaction({ prev, word }) {
  const v = prev ? Math.round(prev.satisfaction) : 0;
  const z = ZONE(v);
  const parts = prev ? prev.satisfactionParts : [];
  const sorted = [...parts].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return html`<div class=${cx('tsat', `is-${z}`)}>
    <div class="tsat__head"><span class="eyebrow">Oyuncu memnuniyeti</span><span class="tsat__word">${word}</span><b class="tsat__val num">${v}</b></div>
    <div class="tsat__track" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${v} aria-label="Oyuncu memnuniyeti">
      <i class="tsat__zone is-bad" style=${{ width: '40%' }}></i><i class="tsat__zone is-lean" style=${{ left: '40%', width: '10%' }}></i><i class="tsat__zone is-ok" style=${{ left: '50%', width: '50%' }}></i>
      <div class="tsat__fill" style=${{ width: v + '%' }}></div>
      <span class="tsat__mark" style=${{ left: '50%' }}><em>50 · imza</em></span>
      <span class="tsat__mark is-soft" style=${{ left: '40%' }}></span>
    </div>
    <div class="tsat__zones"><span style=${{ width: '40%' }}>Reddeder</span><span style=${{ width: '10%' }} class="is-lean">İkna et</span><span style=${{ width: '50%' }}>Razı</span></div>
    <div class="tsat__parts">${sorted.map((p) => html`<span class=${cx('tsat__part', p.value > 0 ? 'is-pos' : p.value < 0 ? 'is-neg' : '')}>${p.label} <b class="num">${p.value > 0 ? '+' : p.value < 0 ? '−' : ''}${Math.abs(p.value)}</b></span>`)}</div>
  </div>`;
}

export function FeeShare({ prev, threshold }) {
  const s = prev ? prev.feeSharePct : 0, warn = prev && prev.feeWarning;
  const th = Math.round(threshold * 1000) / 10;
  return html`<div class=${cx('tfee', warn && 'is-warn')}>
    <${Meter} value=${s} max=${Math.max(25, th * 2)} threshold=${th} thresholdLabel=${`%${th} fark eder`} tone=${warn ? 'danger' : 'gold'} label="Komisyon payı" valueText=${`%${s.toLocaleString('tr-TR')}`} size="sm" />
    ${warn ? html`<div class="tfee__warn"><${Icon} name="alert" size=${16} /><span>Oyuncu komisyonunu fark eder: <b>bağlılık −5</b>. Payı %${th} altında tut ya da bedeli kabul et.</span></div>` : null}
  </div>`;
}
