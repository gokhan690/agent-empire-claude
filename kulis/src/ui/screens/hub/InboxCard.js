// Inbox (Gündem) card: shows every option's honest consequences BEFORE choosing, then a result state.
import { html, cx, fmtMoney, openSheet, useEffect, useState, Card, Badge, Avatar, Crest, Icon, Button, audio, haptics, store, navigate } from '../../ui-kit.js';
import * as sel from '../../../engine/selectors.js';

const KIND = { sakatlik: 'Sakatlık', form: 'Form', dakika: 'Dakika', sahne: 'Sahne', aile: 'Aile', medya: 'Medya', kulup: 'Kulüp', maas: 'Maaş', transfer: 'Transfer', rakip: 'Rakip', sponsor: 'Sponsor', ajans: 'Ajans', para: 'Para', kesif: 'Keşif', banka: 'Banka', rehber: 'Rehber' };
const GUIDE = {
  tut_visit: ['players', 'Oyuncunu aç', 'sheet'], tut_scout: ['scout', 'Keşfe git'], tut_market: ['market', 'Piyasaya git'],
  tut_interest: ['market', 'Teklifleri aç'], tut_promises: ['players', 'Oyunculara git'], tut_ranking: ['agency', 'Ajansa git'],
};
const TONE = { rakip: 'rival', banka: 'gold', para: 'gold', sponsor: 'gold' };

const fmtVal = (k, v) => {
  if (k === 'cash') return fmtMoney(v, { sign: true });
  if (k === 'commission') return (v > 0 ? '+' : '−') + '%' + Math.abs(v);
  if (k === 'interest') return String(Math.round(v));
  return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v));
};
const chipTone = (k, v) => (k === 'interest' || k === 'commission' ? 'info' : v > 0 ? 'lime' : v < 0 ? 'danger' : 'muted');

/** Consequence chips (preview[]) with the plain-text summary as fallback. */
function Effects({ list, text, label, tone }) {
  if (!(list && list.length) && !text) return null;
  return html`<div class=${cx('hub-fx', tone && `hub-fx--${tone}`)}>
    ${label ? html`<span class="hub-fx__lbl">${label}</span>` : null}
    ${list && list.length ? list.map((e) => html`<${Badge} tone=${chipTone(e.key, e.value)}>${e.label} ${fmtVal(e.key, e.value)}</${Badge}>`) : html`<span class="hub-fx__txt">${text}</span>`}
  </div>`;
}

function Option({ o, S, onPick, disabled }) {
  const aff = sel.canAfford(S, o.cost);
  const why = !aff ? ((o.cost.energy || 0) > S.agency.energy ? 'Enerjin yok' : 'Yeterli paran yok') : null;
  return html`<button type="button" class=${cx('opt hub-opt', (!aff || disabled) && 'is-off', o.risk && 'hub-opt--risk')} aria-disabled=${!aff || disabled ? 'true' : undefined}
    onClick=${() => { if (aff && !disabled) onPick(o); else if (!aff) { audio.play('error'); haptics.warn(); } }}>
    <span class="hub-opt__main">
      <span class="opt__label">${o.label}</span>
      ${o.hint ? html`<span class="opt__hint">${o.hint}</span>` : null}
      <${Effects} list=${o.preview} text=${o.summary} />
      ${o.risk ? html`<span class="hub-opt__risk"><${Badge} tone="danger" icon="dice">Risk %${o.risk.pct}</${Badge}><span>${o.risk.text}</span></span>` : null}
      ${o.risk && (o.riskPreview || o.riskSummary) ? html`<${Effects} list=${o.riskPreview} text=${o.riskSummary} label="Ters giderse" tone="risk" />` : null}
      ${why ? html`<span class="hub-opt__why">${why}</span>` : null}
    </span>
    <span class="opt__cost">
      ${o.cost.energy ? html`<${Badge} tone="lime" icon="bolt">${o.cost.energy}</${Badge}>` : null}
      ${o.cost.cash ? html`<${Badge} tone="gold">${fmtMoney(o.cost.cash)}</${Badge}>` : null}
    </span>
  </button>`;
}

function Who({ card, S }) {
  const club = card.clubId && S.clubs[card.clubId];
  if (card.playerId && S.players[card.playerId]) return html`<${Avatar} id=${card.playerId} size=${44} colors=${club && club.colors} />`;
  if (club) return html`<${Crest} colors=${club.colors} pattern=${club.crest} size=${40} />`;
  return html`<span class="hub-from-ico"><${Icon} name=${card.kind === 'rehber' ? 'info' : card.kind === 'banka' ? 'building' : 'news'} size=${22} /></span>`;
}

const expiryText = (n) => (n >= 99 ? null : n <= 1 ? 'Bu ay son' : `${n} ay kaldı`);

/** One card. `res` (when set) is the result state after answering; `onGone` is called once the leave-animation ended. */
export default function InboxCard({ card, res, onAnswer, onGone }) {
  const S = store.S;
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!res) return;
    const t = setTimeout(() => setLeaving(true), res.riskFired ? 6500 : 4500);
    return () => clearTimeout(t);
  }, [res]);
  useEffect(() => { if (!leaving) return; const t = setTimeout(() => onGone(card.id), 420); return () => clearTimeout(t); }, [leaving]);

  const guide = card.key && card.key.startsWith('tut_');
  const tone = res ? (res.riskFired ? 'danger' : 'lime') : card.must ? 'must' : guide ? undefined : TONE[card.kind];
  const exp = expiryText(card.expiresIn);
  const def = !res && !card.must && card.expiresIn <= 2 && card.expiresIn < 99 && card.options.find((o) => o.id === card.defaultOption);
  const g = guide && GUIDE[card.key];
  const done = () => setLeaving(true);

  return html`<${Card} tone=${tone} chalk class=${cx('inbox hub-card', guide && 'hub-card--guide', res && 'is-result', leaving && 'is-leaving', card.must && 'hub-card--must')}>
    <div class="inbox__from">
      <${Who} card=${card} S=${S} />
      <div class="grow">
        <div class="eyebrow">${guide ? 'Rehber' : KIND[card.kind] || 'Gündem'} · ${card.from}</div>
        ${card.must && !res ? html`<div class="small danger hub-must"><${Icon} name="alert" size=${13} /> Yanıt şart</div>` : guide ? html`<div class="small muted">Köşedeki ipucu</div>` : null}
      </div>
      ${res ? html`<${Badge} tone=${res.riskFired ? 'danger' : 'lime'} icon=${res.riskFired ? 'alert' : 'check'}>${res.riskFired ? 'Ters gitti' : 'Yanıtlandı'}</${Badge}>`
        : exp ? html`<${Badge} tone=${card.expiresIn <= 1 ? 'danger' : 'gold'} icon="clock">${exp}</${Badge}>` : guide ? html`<${Badge} tone="info" icon="info">Rehber</${Badge}>` : null}
    </div>
    <h3 class="inbox__title">${card.title}</h3>
    ${res ? html`<div class="hub-result" role="status">
        <div class="hub-result__pick"><${Icon} name="arrowRight" size=${14} /> ${res.optLabel}</div>
        ${res.text ? html`<p class="hub-result__text">${res.text}</p>` : html`<p class="hub-result__text muted">Not aldım.</p>`}
        ${res.riskFired ? html`<div class="small danger"><b>Risk gerçekleşti.</b> ${res.riskText || ''}</div>` : res.hadRisk ? html`<div class="small lime">Risk atlatıldı.</div>` : null}
        <${Effects} list=${res.fxList} text=${res.fxText} />
        <${Button} variant="ghost" size="sm" onClick=${done}>Tamam</${Button}>
      </div>`
    : html`<p class="inbox__body">${card.body}</p>
      ${g ? html`<${Button} variant="gold" size="sm" icon="arrowRight" onClick=${() => { if (g[2] === 'sheet' && card.playerId && S.players[card.playerId]) openSheet('PlayerSheet', { playerId: card.playerId }); else navigate(g[0]); }}>${g[1]}</${Button}>` : null}
      <div class="inbox__opts">${card.options.map((o) => html`<${Option} o=${o} S=${S} onPick=${(opt) => onAnswer(card, opt)} />`)}</div>
      ${def ? html`<div class="small muted hub-def"><${Icon} name="clock" size=${13} /> Yanıtlamazsan: ${def.label}</div>` : null}`}
  </${Card}>`;
}
