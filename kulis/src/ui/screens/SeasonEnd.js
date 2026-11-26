import { html, useState, useStore, useEffect, useMemo, Overlay, Button, Badge, Card, Money, Stat, Icon, Avatar, Crest, NumberTicker, store, audio, confetti, openOverlay, navigate, fmtSigned } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';
import { computeSeason } from './agency/seasonData.js';
import { ClubTag, openPlayer, clubOf } from './agency/common.js';
import { OfferCards, TIER, Reward } from './agency/Goal.js';

const Row = ({ i, children, class: c }) => html`<div class=${'season-in ' + (c || '')} style=${{ '--i': i }}>${children}</div>`;
const Head = ({ eyebrow, title, icon, tone }) => html`<header class=${'season-head' + (tone ? ' is-' + tone : '')}>
  <${Row} i=${0}>${icon ? html`<span class="season-head__ico"><${Icon} name=${icon} size=${28} /></span>` : null}</${Row}>
  <${Row} i=${1}><div class="eyebrow">${eyebrow}</div></${Row}>
  <${Row} i=${2}><h2 class="season-head__title t-display">${title}</h2></${Row}></header>`;

function Delta({ v, unit = '', inv }) {
  if (!v) return html`<span class="muted">değişmedi</span>`;
  const good = inv ? v < 0 : v > 0;
  return html`<span class=${good ? 'lime' : 'danger'}><${Icon} name=${v > 0 ? 'arrowUp' : 'arrowDown'} size=${13} strokeWidth=${2.6} />${Math.abs(v)}${unit}</span>`;
}

function Intro({ D, S }) {
  return html`<div class="season-intro">
    <${Row} i=${0}><span class="season-intro__ball"><${Icon} name="whistle" size=${44} /></span></${Row}>
    <${Row} i=${1}><div class="eyebrow">Son düdük çaldı</div></${Row}>
    <${Row} i=${2}><h1 class="season-intro__title t-display">Sezon ${D.season}<br />bitti</h1></${Row}>
    <${Row} i=${3}><p class="muted">${S.meta.agencyName} için bir yıl daha geride kaldı. Şampiyonlar, gol kralları, kasa ve sözler… sırayla bakalım.</p></${Row}>
  </div>`;
}

function Champions({ D }) {
  return html`<div class="season-step">
    <${Head} eyebrow="Ligler bitti" title="Şampiyonlar" icon="trophy" tone="gold" />
    ${D.myChamps.length ? html`<${Row} i=${3}><${Card} tone="gold" glow class="season-spot">
      <div class="eyebrow gold">Şampiyon müşterin</div>
      ${D.myChamps.map((c) => c.mine.map((m) => html`<button type="button" class="season-spot__row" onClick=${() => openPlayer(m.id)}><${Avatar} id=${m.id} size=${52} ring colors=${(clubOf(c.clubId) || {}).colors} /><div><b>${m.name}</b><span class="muted small"><${ClubTag} id=${c.clubId} size=${14} /> · ${c.league}</span></div><${Icon} name="trophy" size=${22} /></button>`))}
    </${Card}></${Row}>` : null}
    <div class="season-list">${D.champions.map((c, i) => html`<${Row} i=${4 + i} class=${'season-champ' + (c.mine.length ? ' is-mine' : '')}>
      <${Crest} colors=${(clubOf(c.clubId) || {}).colors} pattern=${(clubOf(c.clubId) || {}).crest} size=${34} />
      <div class="grow"><div class="season-champ__lg">${c.league}</div><button type="button" class="season-champ__club" onClick=${() => store.ui.openSheet('ClubSheet', { clubId: c.clubId })}>${(clubOf(c.clubId) || {}).name || '—'}</button></div>
      ${c.mine.length ? html`<${Badge} tone="gold" icon="star">Müşterin var</${Badge}>` : html`<${Icon} name="trophy" size=${18} />`}
    </${Row}>`)}</div>
  </div>`;
}

function Awards({ D }) {
  return html`<div class="season-step">
    <${Head} eyebrow="Golün adamları" title="Gol kralları" icon="ball" />
    <div class="season-list">${D.awards.length ? D.awards.map((a, i) => html`<${Row} i=${3 + i} class=${'season-award' + (a.mine ? ' is-mine' : '')}>
      <button type="button" class="season-award__btn" onClick=${() => openPlayer(a.playerId)}>
        <${Avatar} id=${a.playerId} size=${46} colors=${(clubOf(a.clubId) || {}).colors} />
        <div class="grow"><b>${a.name}</b><span class="muted small">${a.league} · <${ClubTag} id=${a.clubId} size=${13} /></span></div>
        <div class="season-award__g num">${a.goals}<small>gol</small></div></button>
      ${a.mine ? html`<${Badge} tone="lime">Müşterin</${Badge}>` : null}
    </${Row}>`) : html`<${Row} i=${3}><p class="muted">Bu sezon gol krallığı kaydı yok.</p></${Row}>`}</div>
  </div>`;
}

function Movement({ D }) {
  const col = (list, tone, icon, label) => html`<div class=${'season-move season-move--' + tone}>
    <div class="season-move__h"><${Icon} name=${icon} size=${18} /><b>${label}</b></div>
    ${list.length ? list.map((c) => html`<div class="season-move__club"><${ClubTag} id=${c.id} size=${22} />${c.mine.length ? html`<${Badge} tone="lime">${c.mine[0]}</${Badge}>` : null}</div>`) : html`<span class="muted small">Yok</span>`}</div>`;
  return html`<div class="season-step">
    <${Head} eyebrow="Süper Lig ve 1. Lig" title="Terfi ve düşme" icon="swap" />
    <${Row} i=${3}><div class="season-moves">${col(D.moves.promoted, 'up', 'trendUp', 'Süper Lig\'e çıkanlar')}${col(D.moves.relegated, 'down', 'arrowDown', '1. Lig\'e düşenler')}</div></${Row}>
  </div>`;
}

function Mine({ D, S }) {
  const m = D.me;
  const rankDelta = m.prevRank ? m.prevRank - m.rank : 0;
  return html`<div class="season-step">
    <${Head} eyebrow=${S.meta.agencyName} title="Senin sezonun" icon="building" tone=${m.rank === 1 ? 'gold' : ''} />
    <${Row} i=${3}><${Card} chalk tone=${m.rank === 1 ? 'gold' : undefined} class="season-rank">
      <div class="season-rank__n num">${m.rank}<small>. sıra</small></div>
      <div class="season-rank__t"><b>${m.rank === 1 ? 'Ajanslar arasında zirve!' : 'Ajans sıralaman'}</b>
        <span class="muted small">${m.prevRank ? html`Geçen sezon ${m.prevRank}. idin · <${Delta} v=${rankDelta} unit=" basamak" />` : 'İlk sezonun: yarış başladı.'}</span></div>
    </${Card}></${Row}>
    <div class="season-grid">
      <${Row} i=${4}><${Card}><${Stat} label="Kasa" icon="cash" value=${html`<${Money} value=${m.cash} count />`} hint=${html`<${Money} value=${m.cash - m.prevCash} sign colored /> bu sezon`} /></${Card}></${Row}>
      <${Row} i=${5}><${Card}><${Stat} label="İtibar" icon="star" tone="gold" value=${Math.round(m.rep)} hint=${html`${fmtSigned(Math.round((m.rep - m.prevRep) * 10) / 10)} bu sezon`} /></${Card}></${Row}>
      <${Row} i=${6}><${Card}><${Stat} label="Komisyon" icon="handshake" tone="lime" value=${html`<${Money} value=${m.commission} />`} hint="bu sezon kazanılan" /></${Card}></${Row}>
      <${Row} i=${7}><${Card}><${Stat} label="Transfer" icon="swap" value=${m.deals} hint=${m.deals ? html`<${Money} value=${m.dealFees} /> komisyon` : 'bu sezon anlaşma yok'} /></${Card}></${Row}>
    </div>
    ${m.best ? html`<${Row} i=${8}><button type="button" class="season-feat" onClick=${() => openPlayer(m.best.id)}><${Avatar} id=${m.best.id} size=${44} /><div class="grow"><span class="eyebrow">Sezonun en iyisi</span><b>${m.best.name}</b></div><div class="season-feat__v num">${m.best.rating.toFixed(1)}<small>ort. puan</small></div></button></${Row}>` : null}
    ${m.jump ? html`<${Row} i=${9}><button type="button" class="season-feat" onClick=${() => openPlayer(m.jump.id)}><${Avatar} id=${m.jump.id} size=${44} /><div class="grow"><span class="eyebrow">Son ayın en büyük sıçraması</span><b>${m.jump.name}</b></div><div class="season-feat__v num lime">+${m.jump.delta}<small>güç</small></div></button></${Row}>` : null}
  </div>`;
}

function Clients({ D }) {
  const sec = (title, list, tone, icon) => list.length ? html`<div class="season-cl"><div class=${'season-cl__h ' + tone}><${Icon} name=${icon} size=${16} /><b>${title}</b></div>
    ${list.map((c) => html`<div class="season-cl__row"><${Avatar} id=${c.id} size=${36} /><span>${c.name}${c.age ? html` <em class="muted">(${c.age} yaşında)</em>` : null}</span></div>`)}</div>` : null;
  return html`<div class="season-step">
    <${Head} eyebrow="Portföy" title="Müşterilerin" icon="users" />
    <${Row} i=${3}><div class="season-clients">
      ${sec('Sözleşmesi yenilenen', D.clients.renewed, 'lime', 'check')}
      ${sec('Futbola veda eden', D.clients.retired, 'muted', 'whistle')}
      ${sec('Yolları ayrılan', D.clients.lost, 'danger', 'alert')}
    </div></${Row}>
  </div>`;
}

function Promises({ D }) {
  const k = D.promises.kept.length, b = D.promises.broken.length;
  return html`<div class="season-step">
    <${Head} eyebrow="Verdiğin sözler" title="Söz borcun" icon="handshake" />
    <${Row} i=${3}><div class="season-vow"><div class="season-vow__k"><b class="num lime">${k}</b><span>tutulan</span></div><div class="season-vow__b"><b class=${'num ' + (b ? 'danger' : 'muted')}>${b}</b><span>bozulan</span></div></div></${Row}>
    <${Row} i=${4}><p class="muted center">${b === 0 && k > 0 ? 'Sözünün eri bir menajersin. Müşterilerin bunu unutmaz.' : b > k ? 'Bozulan sözler bağlılığı ve itibarı eritti. Bir dahaki sezon daha az söz, daha çok icraat.' : k + b === 0 ? 'Bu sezon sonuçlanan bir söz yok.' : 'Karışık bir karne. Sözler, bu işin gerçek para birimi.'}</p></${Row}>
    <div class="season-list">${[...D.promises.broken, ...D.promises.kept].slice(0, 5).map((q, i) => html`<${Row} i=${5 + i} class=${'season-vow-row ' + q.status}><${Icon} name=${q.status === 'kept' ? 'check' : 'close'} size=${16} strokeWidth=${2.6} /><span>${q.text}</span></${Row}>`)}</div>
  </div>`;
}

function Next({ D, S, goObj, onFinish }) {
  const hub = sel.hubSummary(S);
  const ov = sel.objectiveView(S);
  const ended = !!S.ending && S.time.phase === 'over';
  const left = hub.seasons >= 900 ? null : hub.seasons - hub.season + 1;
  return html`<div class="season-step">
    <${Head} eyebrow=${ended ? 'Kariyer tamamlandı' : 'Perde açılıyor'} title=${ended ? 'Final' : `Sezon ${hub.season}`} icon=${ended ? 'trophy' : 'calendar'} tone=${ended ? 'gold' : 'lime'} />
    ${ended ? html`<${Row} i=${3}><p class="center muted">Son sezon da bitti. Şimdi ajansının hikâyesinin nasıl sonlandığını görme zamanı.</p></${Row}>` : html`
      <${Row} i=${3}><div class="season-new num">${hub.season}<small>${left == null ? ' · sonsuz mod' : ` / ${hub.seasons}`}</small></div>
        <p class="center muted small">${left == null ? 'Kariyer süresiz sürüyor.' : left === 1 ? 'Kariyerin son sezonu başlıyor.' : `Kariyerin bitmesine ${left} sezon kaldı.`}</p></${Row}>
      ${S.objectives.active ? html`<${Row} i=${4}><${Card} tone="lime" eyebrow=${`Hedefin · ${(TIER[S.objectives.active.tier] || {}).label || ''}`} title=${S.objectives.active.title}><${Reward} r=${S.objectives.active.reward} /></${Card}></${Row}>`
        : ov.offered.length ? html`<${Row} i=${4}><div class="eyebrow center">Bu sezonun hedefini seç</div></${Row}><${Row} i=${5}><${OfferCards} offered=${ov.offered} /></${Row}>` : null}`}
  </div>`;
}

export default function SeasonEnd({ close, seasonEnd, report }) {
  const S = store.S;
  const D = useMemo(() => computeSeason(S, seasonEnd, report), []);
  const ended = !!S.ending && S.time.phase === 'over';
  const steps = useMemo(() => {
    const s = ['intro', 'champions'];
    if (D.awards.length) s.push('awards');
    if (D.moves.promoted.length || D.moves.relegated.length) s.push('moves');
    s.push('mine');
    if (D.clients.renewed.length || D.clients.retired.length || D.clients.lost.length) s.push('clients');
    if (D.promises.kept.length + D.promises.broken.length) s.push('promises');
    s.push('next');
    return s;
  }, []);
  const [i, setI] = useState(0);
  useStore((st) => st.rev);
  const id = steps[i], last = i === steps.length - 1;

  // sound + confetti per step
  useEffect(() => {
    if (id === 'champions' && D.myChamps.length) { audio.play('levelup'); setTimeout(() => confetti({ count: 150, colors: ['#F5C451', '#FFD97A', '#EEF4EF', '#3DDC84'] }), 250); }
    else if (id === 'mine' && D.me.rank === 1) { audio.play('levelup'); setTimeout(() => confetti({ count: 150, colors: ['#F5C451', '#FFD97A', '#EEF4EF'] }), 300); }
    else if (id !== 'intro') audio.play('page');
  }, [i]);

  const next = () => { if (!last) setI(i + 1); };
  const prev = () => { if (i > 0) setI(i - 1); };
  const finish = () => { if (ended) { close(); openOverlay('Ending', {}); } else close(); };
  useEffect(() => {
    const h = (e) => {
      if (e.target.closest && e.target.closest('button,a,input')) { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; }
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') prev();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  });
  const tap = (e) => { if (e.target.closest('button,a,.btn,.card--tap')) return; next(); };

  const body = { intro: Intro, champions: Champions, awards: Awards, moves: Movement, mine: Mine, clients: Clients, promises: Promises, next: Next }[id];
  return html`<${Overlay} label=${`Sezon ${D.season} değerlendirmesi`} tone=${D.myChamps.length || D.me.rank === 1 ? 'gold' : 'night'} class="season-ov">
    <div class="season-wrap">
      <div class="season-top">
        <div class="season-dots" role="progressbar" aria-valuemin="1" aria-valuemax=${steps.length} aria-valuenow=${i + 1} aria-label="Adım">${steps.map((s, k) => html`<i class=${k < i ? 'is-past' : k === i ? 'is-now' : ''}></i>`)}</div>
        ${!last ? html`<button type="button" class="season-skip" onClick=${() => setI(steps.length - 1)}>Atla</button>` : null}
      </div>
      <div class="season-body" onClick=${tap} key=${id}><${body} D=${D} S=${S} /></div>
      <div class="season-foot">
        ${i > 0 ? html`<button type="button" class="iconbtn season-back" aria-label="Geri" onClick=${prev}><${Icon} name="chevronLeft" /></button>` : html`<span class="season-back-pad"></span>`}
        ${last ? html`<${Button} size="lg" block variant="gold" class="season-next" onClick=${finish}>${ended ? 'Finale geç' : 'Yeni sezona başla'}</${Button}>`
          : html`<${Button} size="lg" block class="season-next" onClick=${next}>Devam</${Button}>`}
      </div>
      ${last && !ended && !S.objectives.active && S.objectives.offered.length ? html`<button type="button" class="season-link" onClick=${() => { close(); navigate('agency'); }}>Hedefi sonra Ajans sekmesinden seçeyim</button>` : null}
    </div>
  </${Overlay}>`;
}
