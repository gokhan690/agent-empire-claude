// Hub ("Gündem"): month headline, the season goal (one line), the guide (≤3 cards), one event card, offers, "AYI OYNAT".
import { html, cx, MONTH_NAMES, useEffect, useState, Card, Badge, Button, Icon, toast, audio, haptics, store, useStore, navigate, openOverlay } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';
import { openAgency } from './common.js';

function Headline({ h }) {
  return html`<${Card} chalk glow class="hub-head">
    <div class="row row--between hub-head__top">
      <div>
        <div class="eyebrow">Sezon ${h.season} / ${h.seasons}</div>
        <h1 class="hub-head__month t-display">${h.monthName}</h1>
      </div>
      <button type="button" class="hub-rank" onClick=${() => { audio.play('page'); openAgency(); }} aria-label=${`Ajans sıralaması ${h.rank}. sıra`}><${Icon} name="trophy" size=${14} /> ${h.rank}. sıra</button>
    </div>
    <div class="hub-track" role="img" aria-label=${`Sezonun ${h.month + 1}. ayı`}>
      ${MONTH_NAMES.map((m, i) => html`<i class=${cx(i < h.month && 'is-past', i === h.month && 'is-now')} title=${m}></i>`)}
    </div>
  </${Card}>`;
}

function Goal({ h }) {
  const g = h.goal;
  if (!g) return null;
  const done = g.status === 'done', failed = g.status === 'failed';
  return html`<div class=${cx('hub-goal', done && 'is-done', failed && 'is-failed')} data-testid="goal">
    <${Icon} name=${done ? 'check' : 'target'} size=${18} />
    <span class="hub-goal__t"><b>Hedef:</b> ${g.title}</span>
    <span class="hub-goal__p num">${done ? 'Tamam' : failed ? 'Kaçtı' : g.kind === 'rank' ? '' : `${g.progress >= 1e4 ? Math.round(g.progress / 1000) + 'K' : g.progress}/${g.target >= 1e4 ? Math.round(g.target / 1000) + 'K' : g.target}`}</span>
  </div>`;
}

const GUIDE_GO = { search: ['players', 'Oyuncular'], pitch: ['players', 'Oyuncular'], deal: ['market', 'Piyasa'] };
function Guide({ g }) {
  const [to, label] = GUIDE_GO[g.step] || ['hub', ''];
  return html`<${Card} class="hub-guide" data-testid="guide">
    <div class="row row--between"><span class="eyebrow gold">Rehber ${g.index}/${g.total}</span>
      <button type="button" class="hub-skip" onClick=${() => store.act('skipGuide', {})}>Atla</button></div>
    <h3 class="hub-guide__t t-display">${g.title}</h3>
    <p class="hub-guide__p">${g.text}</p>
    <${Button} size="sm" variant="gold" icon="arrowRight" onClick=${() => navigate(to)}>${label}</${Button}>
  </${Card}>`;
}

function EventCard({ card, h }) {
  const [res, setRes] = useState(null);
  const answer = (o) => {
    const r = store.act('answerInbox', { inboxId: card.id, optionId: o.id });
    if (!r.ok) return;
    audio.play(o.cost.cash ? 'coin' : 'confirm'); haptics.tap();
    setRes({ title: card.title, text: r.resultText });
  };
  if (res && !h.card) return html`<${Card} tone="lime" class="hub-event is-result" data-testid="event-result"><div class="eyebrow">${res.title}</div><p class="hub-event__p">${res.text}</p>
    <button type="button" class="hub-skip" onClick=${() => setRes(null)}>Tamam</button></${Card}>`;
  if (!card) return null;
  return html`<${Card} tone="gold" class="hub-event" data-testid="event">
    <div class="eyebrow">${card.title}</div>
    <p class="hub-event__p">${card.body}</p>
    <div class="hub-event__opts">${card.options.map((o) => html`<${Button} size="sm" variant=${o.cost.cash || o.cost.energy ? 'gold' : 'ghost'} energy=${o.cost.energy || undefined} cash=${o.cost.cash || undefined}
      disabled=${(o.cost.energy && o.cost.energy > h.energy) || (o.cost.cash && o.cost.cash > h.cash)} onClick=${() => answer(o)}>${o.label}</${Button}>`)}</div>
  </${Card}>`;
}

function Alerts({ h }) {
  const out = [];
  if (h.alert) out.push(html`<${Card} tone="danger" class="hub-neg" role="alert"><div class="row"><${Icon} name="alert" size=${22} /><div class="grow"><b>Kasa eksiye düştü</b>
    <div class="small">${h.alert}</div></div></div></${Card}>`);
  if (h.noClients) out.push(html`<${Card} tone="danger" class="hub-neg" role="alert"><div class="row"><${Icon} name="users" size=${22} /><div class="grow"><b>Hiç müşterin yok</b>
    <div class="small">Oyuncular sekmesinden yeni oyuncu bul ve imzala.</div></div></div></${Card}>`);
  if (h.loan) out.push(html`<div class="hub-loaninfo small muted"><${Icon} name="building" size=${14} /> Kredi: ayda${h.loan.monthly.toLocaleString('tr-TR')} € · ${h.loan.monthsLeft} ay kaldı</div>`);
  return out.length ? html`<div class="stack">${out}</div>` : null;
}

function AdvanceBar({ S, h }) {
  const [busy, setBusy] = useState(false);
  const run = () => { setBusy(true); audio.play('whoosh'); haptics.heavy(); try { store.advance(); } finally { setBusy(false); } };
  let btn;
  if (S.time.phase === 'over') btn = html`<${Button} size="lg" block variant="gold" icon="trophy" onClick=${() => openOverlay('Ending', {})}>KARİYER ÖZETİ</${Button}>`;
  else if (S.negotiation) btn = html`<${Button} size="lg" block variant="gold" icon="handshake" onClick=${() => openOverlay('Negotiation', {})}>MASAYA DÖN</${Button}>`;
  else btn = html`<${Button} size="lg" block icon="play" disabled=${!!h.advanceBlock} loading=${busy} onClick=${run} data-testid="advance">AYI OYNAT</${Button}>`;
  return html`<div class="hub-adv">${S.time.phase === 'plan' && !S.negotiation ? html`<div class="hub-adv__hint"><${Icon} name="bolt" size=${14} /> ${h.energy}/${h.energyMax} enerji</div>` : null}${btn}</div>`;
}

export default function Hub() {
  const S = useStore((s) => s.S);
  useEffect(() => { if (!store.S) openOverlay('Onboarding', {}); }, [S]);
  if (!S) return html`<div class="screen-pad"></div>`;
  const h = sel.hubSummary(S);
  return html`<div class="hub">
    <div class="hub-grid stack">
      <${Headline} h=${h} />
      <${Goal} h=${h} />
      <${Alerts} h=${h} />
      ${h.guide ? html`<${Guide} g=${h.guide} />` : null}
      <${EventCard} card=${h.card} h=${h} />
      ${h.offers ? html`<${Card} tone="lime" class="hub-offers" onClick=${() => navigate('market')}><div class="row row--between"><span><b class="num lime">${h.offers}</b> teklif masada seni bekliyor</span><${Icon} name="chevronRight" size=${18} /></div></${Card}>` : null}
    </div>
    <${AdvanceBar} S=${S} h=${h} />
  </div>`;
}
