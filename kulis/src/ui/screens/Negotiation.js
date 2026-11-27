// The Masa — two sliders (wage, commission), a director's face with one short line, 3 patience pips and an honest "Kabul şansı".
// Reads the table through sel.negotiationView only (never the hidden ceiling).
import { html, useState, useEffect, useRef, Overlay, Sheet, Icon, Button, Badge, Avatar, Crest, PosChip, store, useStore, openOverlay, audio, haptics, cx } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';
import { Slider, niceStep } from './table/Slider.js';
import { DirectorFace } from './table/Face.js';
import { eur, faceOf, afterTable, useTyped } from './table/lib.js';

const HINT_TONE = { 'Yüksek': 'lime', Orta: 'gold', 'Düşük': 'danger' };

function Patience({ value, max, lost }) {
  return html`<div class="tpat" role="meter" aria-valuemin="0" aria-valuemax=${max} aria-valuenow=${value} aria-label="Direktörün sabrı">
    <span class="tpat__pips">${Array.from({ length: max }, (_, i) => {
      const on = i < value, fresh = !on && lost && lost.has(i);
      return html`<i key=${i + (on ? 'on' : fresh ? 'lost' : 'off')} class=${cx('tpat__pip', on && 'is-on', fresh && 'is-lost')}></i>`;
    })}</span>
  </div>`;
}

export default function Negotiation({ close }) {
  const st = useStore();
  const S = st.S;
  const live = S ? sel.negotiationView(S) : null;
  const snap = useRef(null);
  if (live) snap.current = live;
  const n = snap.current;

  const [pkg, setPkg] = useState(() => (live ? { wage: Math.max(live.minWage, live.fair.wage), fee: live.fair.fee } : null));
  const [prev, setPrev] = useState(null);
  const [view, setView] = useState(() => (live ? (live.lastTell ? { face: faceOf(live.lastTell.face), line: live.lastTell.line } : { face: 'neutral', line: live.openLine }) : { face: 'neutral', line: '' }));
  const [end, setEnd] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lost, setLost] = useState(null);
  const [shake, setShake] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const patRef = useRef(live ? live.patience : 0);
  const timer = useRef(null);

  useEffect(() => { if (!n) afterTable(); return () => clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!live) return;
    const pv = patRef.current;
    if (live.patience < pv) { const s = new Set(); for (let i = live.patience; i < pv; i++) s.add(i); setLost(s); audio.play('tick'); haptics.warn(); }
    patRef.current = live.patience;
  }, [live ? live.patience : -1]);
  useEffect(() => {
    if (!n || end || !pkg) return undefined;
    const t = setTimeout(() => { const r = store.preview('negPreview', { package: pkg }); if (r && r.ok) setPrev(r.preview); }, 100);
    return () => clearTimeout(t);
  }, [pkg, n ? n.id : '', !!end, live ? live.round : 0]);
  const [typed, rest, typing] = useTyped(view.line);

  if (!n || !pkg) return html`<${Overlay} label="Masa" onClose=${close}><div class="screen-pad"></div></${Overlay}>`;

  const club = S.clubs[n.clubId];
  const fromClub = n.fromClubId ? S.clubs[n.fromClubId] : null;
  const pl = S.players[n.playerId];
  const L = n.limits;
  const ended = !!end;
  const hint = prev && prev.hint;
  const set = (k, v) => setPkg((p) => ({ ...p, [k]: v }));
  const wageStep = niceStep(L.wage[1] - L.wage[0], 100), feeStep = niceStep(L.fee[1] - L.fee[0], 100);

  const finishDeal = (r) => {
    const dd = (r.events || []).find((e) => e.type === 'dealDone');
    setEnd({ type: 'accepted', deal: dd });
    setView({ face: 'smile', line: r.line || 'Anlaştık.' });
    audio.play('confirm'); haptics.success();
    timer.current = setTimeout(() => openOverlay('Ceremony', { deal: dd }), 1100);
  };
  const handle = (r) => {
    setBusy(false);
    if (r.outcome === 'accepted') return finishDeal(r);
    if (r.outcome === 'left') {
      setEnd({ type: 'left' });
      setView({ face: 'stand', line: r.line || 'Bu kadar yeter.' });
      audio.play('badnews'); haptics.heavy(); setShake((x) => x + 1);
      return undefined;
    }
    setView({ face: faceOf(r.tell.face), line: r.tell.line });
    audio.play('whoosh');
    return undefined;
  };
  const submit = () => {
    if (busy || ended) return;
    setBusy(true);
    const r = store.act('negPropose', { package: pkg });
    if (!r.ok) { setBusy(false); haptics.warn(); return; }
    handle(r);
  };
  const acceptCounter = () => { if (busy) return; setBusy(true); const r = store.act('negAcceptCounter'); if (!r.ok) { setBusy(false); return; } handle(r); };
  const workOn = () => { if (live && live.counter) { setPkg({ wage: live.counter.package.wage, fee: live.counter.package.fee }); audio.play('page'); } };
  const walk = () => { setConfirm(false); const r = store.act('negWalkAway'); if (r.ok) afterTable(); };
  const cd = 3;

  return html`<${Overlay} label="Pazarlık masası" tone=${end && end.type === 'left' ? 'danger' : undefined} onClose=${ended ? undefined : () => setConfirm(true)}>
    <div class=${cx('table', end && end.type === 'left' && 'is-left')} data-testid="table">
      <header class="table__top">
        <div class="eyebrow">Masa · Tur ${end && end.type === 'left' ? n.patienceMax : Math.min(n.patienceMax, Math.max(1, n.round + (ended ? 0 : 1)))}/${n.patienceMax}</div>
        <${Patience} value=${live ? live.patience : 0} max=${n.patienceMax} lost=${lost} />
        ${ended ? null : html`<button type="button" class="table__x" aria-label="Masadan kalk" onClick=${() => setConfirm(true)}><${Icon} name="close" size=${20} /></button>`}
      </header>

      <section class=${cx('tstage', shake ? `is-shake-${shake % 2}` : null, `is-${view.face}`)} aria-label="Direktör">
        <div class="tstage__lamp" aria-hidden="true"></div>
        <div class="tstage__main">
          <div class="tstage__face"><${DirectorFace} seed=${club.director.name} colors=${club.colors} face=${view.face} talking=${typing} leaving=${end && end.type === 'left'} size=${132} /></div>
          <div class="tstage__say">
            <div class=${cx('tbubble', typing && 'is-typing')} key=${view.line}><p class="tbubble__txt" data-testid="director-line">${typed}<span class="tbubble__rest">${rest}</span></p></div>
            <div class="tstage__plate"><${Crest} colors=${club.colors} pattern=${club.crest} size=${22} /><span><b>${club.director.name}</b> · ${club.name}</span></div>
          </div>
        </div>
      </section>

      <section class="tctx">
        <${Avatar} id=${pl.id} size=${44} />
        <div class="tctx__id"><b class="t-display">${pl.name}</b><span><${PosChip} pos=${pl.pos} /> ${pl.age} yaş</span></div>
        <div class="tctx__move">${fromClub && fromClub.id !== club.id ? html`<${Crest} colors=${fromClub.colors} pattern=${fromClub.crest} size=${30} /><${Icon} name="arrowRight" size=${16} />` : null}<${Crest} colors=${club.colors} pattern=${club.crest} size=${36} /></div>
      </section>

      ${end && end.type === 'left' ? html`<section class="tpanel is-danger" data-testid="table-left"><h3 class="t-display">Direktör masadan kalktı</h3>
        <p>${cd} ay boyunca ${pl.name} için bu kulüple masa kuramazsın. Kulüp güveni −10.</p></section>` : html`
      <div class=${cx('thint', `is-${HINT_TONE[hint] || 'idle'}`)} data-testid="hint" aria-live="polite"><span>Kabul şansı</span><b>${hint || '—'}</b></div>

      ${live && live.counter && !ended ? html`<section class="tcounter" aria-label="Onun teklifi" data-testid="counter">
        <div class="tcounter__txt"><span class="eyebrow">Onun teklifi</span>
          <div class="tcounter__grid"><div><span>Maaş</span><b class="num">${eur(live.counter.package.wage)}</b></div><div><span>Komisyonun</span><b class="num gold">${eur(live.counter.package.fee)}</b></div></div></div>
        <div class="tcounter__act"><${Button} variant="gold" size="sm" disabled=${busy} onClick=${acceptCounter} data-testid="accept-counter">Kabul et</${Button}>
          <${Button} variant="ghost" size="sm" disabled=${busy} onClick=${workOn}>Üzerine çalış</${Button}></div>
      </section>` : null}

      <section class="tbuild" aria-label="Teklif">
        <${Slider} label="Oyuncunun maaşı (aylık)" value=${pkg.wage} min=${L.wage[0]} max=${L.wage[1]} step=${wageStep} onChange=${(v) => set('wage', v)} format=${(v) => eur(v)}
          markers=${[{ value: n.minWage, label: 'Asgari', tone: 'info' }]}
          hint=${prev ? (prev.happy ? 'Oyuncu: memnun' : 'Oyuncu: razı') : null} />
        <${Slider} label="SENİN KOMİSYONUN" tone="gold" big value=${pkg.fee} min=${L.fee[0]} max=${L.fee[1]} step=${feeStep} onChange=${(v) => set('fee', v)} format=${(v) => eur(v)}
          markers=${[{ value: n.fair.fee, label: 'Adil', tone: 'gold' }]}
          hint=${prev && prev.greedy ? 'Çok yüksek: oyuncu hoşlanmaz' : null} />
        <p class="tbuild__note small muted">${n.years} yıllık sözleşme · imza primi ${eur(n.bonus)} · bonservis ${eur(n.transferFee)}</p>
      </section>`}

      <footer class="table__bar" role="region" aria-label="Eylemler">
        ${ended && end.type === 'accepted' ? html`<div class="table__barrow"><span class="table__barmsg">Anlaşma imzalanıyor…</span><${Button} variant="primary" onClick=${() => { clearTimeout(timer.current); openOverlay('Ceremony', { deal: end.deal }); }}>Devam</${Button}></div>`
          : ended ? html`<div class="table__barrow"><${Button} variant="ghost" block onClick=${afterTable}>Tamam</${Button}></div>`
          : html`<div class="table__barrow">
            <${Button} variant="ghost" onClick=${() => setConfirm(true)}>Masadan kalk</${Button}>
            <${Button} variant="primary" class="table__go" disabled=${busy} icon="handshake" onClick=${submit} data-testid="propose">Teklif et</${Button}>
          </div>`}
      </footer>
    </div>
    ${confirm ? html`<${Sheet} title="Masadan kalkılsın mı?" onClose=${() => setConfirm(false)} footer=${html`<div class="grid-2"><${Button} variant="ghost" onClick=${() => setConfirm(false)}>Devam et</${Button}><${Button} variant="danger" onClick=${walk}>Masadan kalk</${Button}></div>`}>
      <p>Cezası yok. Ama harcadığın enerji geri gelmez ve masa kapanır.</p>
    </${Sheet}>` : null}
  </${Overlay}>`;
}
