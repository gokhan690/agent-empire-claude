// Hub ("Gündem"): headline, objective, alerts, inbox, quick actions, client strip, sticky "AYI OYNAT".
import { html, cx, fmtMoney, MONTH_NAMES, useEffect, useState, useRef, Card, Badge, Button, Meter, SectionTitle, EmptyState, Avatar, Icon, Sheet, toast, audio, haptics, store, useStore, navigate, openOverlay, openSheet } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';
import { BAL } from '../../engine/constants.js';
import InboxCard from './hub/InboxCard.js';

const TIER = { safe: ['Güvenli', 'lime'], balanced: ['Dengeli', 'info'], bold: ['Cesur', 'gold'] };
const rewardText = (r) => [r && r.cash ? fmtMoney(r.cash) : null, r && r.rep ? `+${r.rep} itibar` : null].filter(Boolean).join(' · ');
const MONEY_KINDS = new Set(['commission', 'cash', 'portfolio']);
const ALERT_ICON = { loyalty: 'heart', injury: 'alert', contract: 'clock', repContract: 'pen' };

function Headline({ h }) {
  const tail = h.deadlineMonth ? 'Ay sonunda SON GÜN var' : null;
  return html`<${Card} chalk glow class="hub-head">
    <div class="row row--between hub-head__top">
      <div>
        <div class="eyebrow">Sezon ${h.season} / ${h.seasons}</div>
        <h1 class="hub-head__month t-display">${h.monthName}</h1>
      </div>
      <div class="hub-head__chips">
        <${Badge} tone=${h.window ? 'lime' : 'muted'} icon=${h.window ? 'swap' : 'lock'}>Transfer dönemi ${h.window ? 'açık' : 'kapalı'}</${Badge}>
        <button type="button" class="hub-rank" onClick=${() => { audio.play('page'); navigate('agency'); }} aria-label=${`Ajans sıralaması ${h.rank}. sıra`}><${Icon} name="trophy" size=${14} /> ${h.rank}. sıra</button>
      </div>
    </div>
    <div class="hub-track" role="img" aria-label=${`Sezonun ${h.month + 1}. ayı`}>
      ${MONTH_NAMES.map((m, i) => html`<i class=${cx(i < h.month && 'is-past', i === h.month && 'is-now', (i === 1 || i === 6) && 'is-dl')} title=${m}></i>`)}
    </div>
    ${tail ? html`<div class="hub-deadline"><${Icon} name="bolt" size=${16} /><span><b>${tail}.</b> Panik aramaları ve açık teklifler için hazırlıklı ol.</span></div>` : null}
  </${Card}>`;
}

function ObjectiveOffers({ h }) {
  const off = h.objectivesOffered || [];
  if (h.objective || !off.length) return null;
  return html`<div class="hub-obj stack">
    <${SectionTitle}>Sezon hedefini seç</${SectionTitle}>
    <p class="small muted">Bir hedefe dokun. Sezon sonunda ödül alırsın; zor hedef daha çok kazandırır. Seçmeden de oynayabilirsin.</p>
    <div class="hub-obj__list">${off.map((o) => {
      const [tl, tone] = TIER[o.tier] || ['Hedef', 'muted'];
      return html`<${Card} class="hub-offer" onClick=${() => store.act('chooseObjective', { objectiveId: o.id })} aria-label=${`${tl} hedef: ${o.title}. Seç`}>
        <div class="row row--between"><${Badge} tone=${tone}>${tl}</${Badge}><span class="gold num">${rewardText(o.reward)}</span></div>
        <h4 class="hub-offer__t">${o.title}</h4><p class="small muted">${o.text}</p>
        <span class="hub-offer__pick"><${Icon} name="target" size=${15} /> Bu hedefi seç</span></${Card}>`;
    })}</div>
  </div>`;
}

function Objective({ h }) {
  const o = h.objective && sel.objectiveView(store.S).active;
  if (!o) return null;
  const pct = Math.round((o.pct || 0) * 100);
  return html`<${Card} tone=${o.failed ? 'danger' : 'gold'} class="hub-obj-active">
    <div class="row row--between"><span class="eyebrow">Sezon hedefi</span>${o.failed ? html`<${Badge} tone="danger" icon="alert">Kaçtı</${Badge}>` : html`<span class="gold num small">Ödül ${rewardText(o.reward)}</span>`}</div>
    <h4 class="hub-offer__t">${o.title}</h4>
    <${Meter} label=${o.endOnly ? 'Sezon sonunda değerlendirilir' : 'İlerleme'} value=${pct} tone=${o.failed ? 'danger' : 'gold'} size="sm" valueText=${o.endOnly ? (o.kind === 'rank' ? (pct >= 100 ? 'Hedefte' : 'Peşindesin') : `${pct}%`) : MONEY_KINDS.has(o.kind) ? `${fmtMoney(o.progress)} / ${fmtMoney(o.target)}` : `${o.progress} / ${o.target}`} hint=${o.text} />
  </${Card}>`;
}

function Banners({ h, S }) {
  const loanAlert = h.alerts.some((a) => a.kind === 'loan');
  const L = BAL.econ.loan;
  const monthly = L ? Math.ceil(L.amount * (1 + L.rate) / L.months) : 0;
  const neg = h.cash < 0 || h.negMonths > 0;
  const rest = h.alerts.filter((a) => a.kind !== 'loan' && a.kind !== 'danger');
  const takeLoan = () => { const r = store.act('takeLoan', {}); if (r.ok) { audio.play('coin'); haptics.success(); toast.money(`Kredi hesabına yattı: ${fmtMoney(L.amount)}`); } };
  return html`<div class="stack hub-banners">
    ${neg ? html`<${Card} tone="danger" class="hub-neg" role="alert">
      <div class="row"><span class="hub-neg__ico"><${Icon} name="alert" size=${24} /></span>
        <div class="grow"><div class="t-display hub-neg__t">Kasa eksiye düştü</div>
          <div class="small">3 ay üst üste eksi kapatırsan <b>iflas</b> edersin. Komisyon getir veya masraf kıs.</div></div></div>
      <div class="hub-neg__pips" aria-label=${`${h.negMonths} / 3 ay`}>${[0, 1, 2].map((i) => html`<i class=${cx(i < h.negMonths && 'is-on')}></i>`)}<span class="num">${h.negMonths}/3 ay</span></div>
    </${Card}>` : null}
    ${loanAlert ? html`<${Card} tone="gold" glow class="hub-loan">
      <div class="row"><span class="hub-neg__ico hub-loan__ico"><${Icon} name="building" size=${24} /></span>
        <div class="grow"><div class="t-display hub-neg__t">Banka kredi teklif ediyor</div>
          <div class="small">${fmtMoney(L.amount)} bugün hesabında; ${L.months} ay boyunca ayda ${fmtMoney(monthly)} taksit.</div></div></div>
      <${Button} variant="gold" block icon="cash" onClick=${takeLoan}>Krediyi Al</${Button}>
      <div class="small muted">Kabul etmezsen teklif kartını Gündem'den kapatabilirsin; teklif bir daha gelmez.</div>
    </${Card}>` : null}
    ${h.loan ? html`<div class="hub-loaninfo small muted"><${Icon} name="building" size=${14} /> Kredi: ayda ${fmtMoney(h.loan.monthly)} · ${h.loan.monthsLeft} ay kaldı</div>` : null}
    ${rest.length ? html`<div class="hub-alerts">${rest.map((a) => html`<button type="button" class=${cx('hub-alert', `hub-alert--${a.kind}`)} onClick=${() => a.playerId && openSheet('PlayerSheet', { playerId: a.playerId })}>
      <${Icon} name=${ALERT_ICON[a.kind] || 'alert'} size=${18} /><span>${a.text}</span>${a.playerId ? html`<${Icon} name="chevronRight" size=${16} />` : null}</button>`)}</div>` : null}
  </div>`;
}

function Tile({ icon, title, sub, onClick, energy, cash, count, tone, off }) {
  return html`<button type="button" class=${cx('hub-tile', tone && `hub-tile--${tone}`, off && 'is-dim')} onClick=${() => { audio.play('page'); onClick(); }}>
    <span class="hub-tile__ico"><${Icon} name=${icon} size=${22} />${count ? html`<em>${count}</em>` : null}</span>
    <span class="hub-tile__txt"><b>${title}</b><span>${sub}</span></span>
    <span class="hub-tile__cost">${energy ? html`<${Badge} tone="lime" icon="bolt">${energy}</${Badge}>` : null}${cash ? html`<${Badge} tone="gold">${fmtMoney(cash)}</${Badge}>` : null}</span>
  </button>`;
}

function QuickActions({ S, h }) {
  const acts = sel.availableActions(S, {});
  const trips = acts.filter((a) => a.id === 'scoutTrip');
  const cheap = trips.filter((a) => a.ok).sort((a, b) => a.cost.cash - b.cost.cash)[0];
  const upg = acts.filter((a) => a.id === 'buyUpgrade' && a.ok).sort((a, b) => a.cost.cash - b.cost.cash)[0];
  const visitable = sel.clientList(S).filter((c) => { const a = sel.availableActions(S, { playerId: c.id }).find((x) => x.id === 'visitClient'); return a && a.ok; });
  return html`<div class="stack">
    <${SectionTitle}>Bu ay ne yapabilirim?</${SectionTitle}>
    ${h.energy <= 0 ? html`<div class="small muted hub-noenergy"><${Icon} name="bolt" size=${14} /> Enerjin bitti; kalanlar bedava işler. Ayı oynatabilirsin.</div>` : null}
    <div class="hub-tiles">
      <${Tile} icon="heart" title="Oyuncularını ziyaret et" sub=${visitable.length ? `${visitable.length} müşteri bekliyor · moral +10, bağlılık +8` : sel.clientList(S).length ? 'Bu ay hepsini ziyaret ettin' : 'Henüz müşterin yok'} energy=${visitable.length ? 1 : 0} off=${!visitable.length} onClick=${() => navigate('players')} />
      <${Tile} icon="eye" title="Keşfe çık" sub=${cheap ? `${cheap.label.replace('Gözlem gezisi: ', '')} · 3 yeni aday` : (trips[0] && trips[0].reason) || 'Şimdilik keşfe çıkamazsın'} energy=${cheap ? 1 : 0} cash=${cheap ? cheap.cost.cash : 0} off=${!cheap} onClick=${() => navigate('scout')} />
      <${Tile} icon="swap" title="Teklifler" tone=${h.openInterests ? 'lime' : undefined} count=${h.openInterests} sub=${h.openInterests ? `${h.openInterests} kulüp masaya hazır` : 'Hazır teklif yok · kulüplere oyuncunu öner'} off=${!h.openInterests} onClick=${() => navigate('market')} />
      <${Tile} icon="building" title="Ofisi büyüt" sub=${upg ? `Yükseltme alabilirsin · ${fmtMoney(upg.cost.cash)}` : 'Yükseltme için para biriktir'} off=${!upg} onClick=${() => navigate('agency')} />
    </div>
  </div>`;
}

function Clients({ S }) {
  const rows = sel.clientList(S);
  if (!rows.length) return html`<${Card} tone="danger" class="hub-noclients" role="alert">
    <div class="t-display hub-neg__t">Hiç müşterin kalmadı</div>
    <p class="small">${S.time.season >= 2 ? 'Sezon sonunda hâlâ müşterin yoksa kariyerin biter.' : 'Müşterisiz komisyon da gelmez.'} Keşfe çık, oyuncuyu izle, imza teklifi ver.</p>
    <${Button} block icon="eye" onClick=${() => navigate('scout')}>Keşfe git</${Button}>
  </${Card}>`;
  const warn = (c) => (c.loyalty < 35 || c.morale < 35 ? 'danger' : c.loyalty < 50 || c.morale < 45 ? 'gold' : null);
  return html`<div class="stack">
    <${SectionTitle} right=${html`<span class="muted small">${rows.length} müşteri</span>`}>Müşterilerin</${SectionTitle}>
    <div class="hub-clients">${rows.map((c) => { const w = warn(c); return html`<button type="button" class="hub-client" onClick=${() => { audio.play('click'); openSheet('PlayerSheet', { playerId: c.id }); }}
      aria-label=${`${c.name}, güç ${c.ca}${w ? ', dikkat' : ''}`}>
      <span class="hub-client__av"><${Avatar} id=${c.id} size=${56} colors=${S.clubs[c.clubId] && S.clubs[c.clubId].colors} />
        ${w ? html`<i class=${cx('hub-dot', `hub-dot--${w}`)}></i>` : null}${c.injured > 0 ? html`<em class="hub-inj"><${Icon} name="alert" size=${12} /></em>` : null}</span>
      <b class="hub-client__n">${c.name.split(' ').slice(-1)[0]}</b>
      <span class="hub-client__ca num">${c.ca}</span>
    </button>`; })}</div>
  </div>`;
}

function useInbox(S) {
  const [done, setDone] = useState({});
  const sorted = [...(S ? S.inbox : [])].sort((a, b) => (b.must - a.must) || (!!b.pinned - !!a.pinned) || (a.expiresIn - b.expiresIn));
  const items = sorted.map((card) => ({ card }));
  Object.values(done).sort((a, b) => a.idx - b.idx).forEach((d) => items.splice(Math.min(d.idx, items.length), 0, { card: d.card, res: d.res }));
  const answer = (card, o) => {
    const idx = items.findIndex((x) => x.card.id === card.id);
    const r = store.act('answerInbox', { inboxId: card.id, optionId: o.id });
    if (!r || !r.ok) return;
    const fired = !!r.riskFired;
    const gain = (o.preview || []).some((e) => e.key === 'cash' && e.value > 0);
    if (fired) { audio.play('badnews'); haptics.warn(); } else if (gain) { audio.play('coin'); haptics.success(); } else { audio.play('confirm'); haptics.tap(); }
    const res = { optLabel: o.label, text: r.resultText, riskFired: fired, hadRisk: !!o.risk, riskText: o.risk && o.risk.text,
      fxList: fired ? o.riskPreview : o.preview, fxText: fired ? o.riskSummary : o.summary };
    setDone((d) => ({ ...d, [card.id]: { card, res, idx: Math.max(0, idx) } }));
  };
  const gone = (id) => setDone((d) => { const n = { ...d }; delete n[id]; return n; });
  return { items, answer, gone };
}

function AdvanceBar({ S, h }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const phase = S.time.phase;
  const label = h.deadlineMonth ? 'SON GÜNE GİR' : 'AYI OYNAT';
  const acts = h.energy > 0 ? sel.availableActions(S, {}) : [];
  const visitable = h.energy > 0 ? sel.clientList(S).filter((c) => { const a = sel.availableActions(S, { playerId: c.id }).find((x) => x.id === 'visitClient'); return a && a.ok; }).length : 0;
  const tips = [];
  if (visitable) tips.push({ t: `${visitable} müşteriyi ziyaret edebilirsin`, to: 'players' });
  if (h.openInterests) tips.push({ t: `${h.openInterests} teklif masaya hazır`, to: 'market' });
  if (acts.some((a) => a.id === 'scoutTrip' && a.ok)) tips.push({ t: 'Keşif gezisine çıkabilirsin', to: 'scout' });

  const run = () => { setConfirm(null); setBusy(true); audio.play('whoosh'); haptics.heavy(); try { store.advance(); } finally { setBusy(false); } };
  const press = () => { if (h.energy > 0 && tips.length) setConfirm(true); else run(); };

  let btn, note = null;
  if (phase === 'over') btn = html`<${Button} size="lg" block variant="gold" icon="trophy" onClick=${() => openOverlay('Ending', {})}>KARİYER ÖZETİ</${Button}>`;
  else if (phase === 'deadline') btn = html`<${Button} size="lg" block variant="gold" icon="bolt" onClick=${() => openOverlay('Deadline', {})}>SON GÜNE DÖN</${Button}>`;
  else if (S.negotiation) btn = html`<${Button} size="lg" block variant="gold" icon="handshake" onClick=${() => openOverlay('Negotiation', {})}>MASAYA DÖN</${Button}>`;
  else {
    btn = html`<${Button} size="lg" block variant=${h.deadlineMonth ? 'gold' : 'primary'} icon=${h.deadlineMonth ? 'bolt' : 'play'} disabled=${!!h.advanceBlock} loading=${busy} onClick=${press}>${label}</${Button}>`;
    if (h.advanceBlock) note = html`<div class="hub-adv__why"><${Icon} name="lock" size=${14} /> ${h.advanceBlock}</div>`;
    else if (h.energy > 0) note = html`<div class="hub-adv__hint"><${Icon} name="bolt" size=${14} /> ${h.energy} enerjin kaldı</div>`;
  }
  return html`<div class="hub-adv">${note}${btn}</div>
    ${confirm ? html`<${Sheet} title="Enerjin kaldı" onClose=${() => setConfirm(null)} footer=${html`<div class="stack"><${Button} block icon="play" variant=${h.deadlineMonth ? 'gold' : 'primary'} onClick=${run}>Yine de oynat</${Button}><${Button} block variant="ghost" onClick=${() => setConfirm(null)}>Geri dön</${Button}></div>`}>
      <div class="stack"><p class="hub-confirm__lead"><b class="lime num">${h.energy}</b> enerjin kaldı. Enerji aya devredilmez; yine de oynatmak istiyor musun?</p>
        ${tips.map((t) => html`<button type="button" class="hub-alert" onClick=${() => { setConfirm(null); navigate(t.to); }}><${Icon} name="arrowRight" size=${16} /><span>${t.t}</span><${Icon} name="chevronRight" size=${16} /></button>`)}</div>
    </${Sheet}>` : null}`;
}

export default function Hub() {
  const S = useStore((s) => s.S);
  useEffect(() => { if (!store.S) openOverlay('Onboarding', {}); }, [S]);
  useEffect(() => store.onEvents((evs) => {
    for (const e of evs) if (e.type === 'objectiveChosen') { audio.play('confirm'); toast.success('Sezon hedefin seçildi'); }
  }), []);
  const inbox = useInbox(S);
  if (!S) return html`<div class="screen-pad"></div>`;
  const h = sel.hubSummary(S);
  const must = h.must;
  return html`<div class="hub">
    <div class="hub-grid">
      <div class="hub-top stack"><${Headline} h=${h} /><${Banners} h=${h} S=${S} /><${Objective} h=${h} /></div>
      <div class="hub-inbox stack">
        <${SectionTitle} right=${must ? html`<${Badge} tone="danger" icon="alert">${must} zorunlu</${Badge}>` : html`<span class="muted small">${inbox.items.length} kart</span>`}>Gündem</${SectionTitle}>
        ${inbox.items.length ? inbox.items.map((x) => html`<${InboxCard} key=${x.card.id} card=${x.card} res=${x.res} onAnswer=${inbox.answer} onGone=${inbox.gone} />`)
          : html`<${Card}><${EmptyState} icon="inbox" title="Gündem boş" body="Bu ay yanıt bekleyen bir şey yok. Enerjini keşfe veya müşteri ziyaretine harca." /></${Card}>`}
        <${ObjectiveOffers} h=${h} />
      </div>
      <div class="hub-side stack"><${QuickActions} S=${S} h=${h} /><${Clients} S=${S} /></div>
    </div>
    <${AdvanceBar} S=${S} h=${h} />
  </div>`;
}
