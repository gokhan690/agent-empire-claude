// The Masa — negotiation overlay (centerpiece). Reads the table through sel.negotiationView only (never the hidden ceiling).
import { html, useState, useEffect, useRef, useMemo, Overlay, Sheet, Icon, Button, Badge, Avatar, Crest, PosChip, SectionTitle, store, useStore, openOverlay, audio, haptics, cx } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';
import { BAL } from '../../engine/constants.js';
import { Slider, niceStep } from './table/Slider.js';
import { Pasta, Satisfaction, FeeShare, pkgParts } from './table/Pasta.js';
import { Stage, Hand, Counter, RoundLog } from './table/Parts.js';
import { eur, KIND_LABEL, faceOf, afterTable, tipsSeen, tipSeen } from './table/lib.js';

const TIPS = [
  { id: 'tell', icon: 'eye', title: 'Tell nedir?', text: 'Direktörün yüzü ve sözü, teklifinin onun gizli sınırına ne kadar uzak olduğunu söyler. Gülümsüyorsa çok yakınsın; ayağa kalkıyorsa çok uzaksın. Sınır hiçbir zaman açıkça görünmez.' },
  { id: 'creep', icon: 'trendUp', title: 'Karşı teklifler yukarı kayar', text: 'Her turda direktörün karşı teklifi biraz daha cömert olur. Ama her ret sabrından götürür; sabır bitince masadan kalkar.' },
  { id: 'pie', icon: 'cash', title: 'Komisyonun aynı pastadan çıkar', text: 'Maaş, prim ve senin komisyonun aynı tavanı paylaşır. Komisyon payın %12’yi aşarsa oyuncu fark eder ve bağlılığı düşer.' },
];
const OPENING = {
  transfer: 'Buyur, dinliyorum. Rakamlarını masaya koy.',
  free: 'Bedelsiz bir fırsat bu. Ama bedavaya da gelmez.',
  renewal: 'Yuvamızdan ayrılmasını istemeyiz. Konuşalım.',
};
const clonePkg = (p) => ({ wage: p.wage, years: p.years, bonus: p.bonus, fee: p.fee, clauses: { minutes: !!(p.clauses && p.clauses.minutes), release: !!(p.clauses && p.clauses.release) } });
const initialView = (n) => {
  if (!n) return { face: 'neutral', line: '', level: null };
  if (n.lastTell) return { face: faceOf(n.lastTell.face), line: n.lastTell.line, level: n.lastTell.level };
  return { face: 'neutral', line: n.deadline ? 'Saat daralıyor. Çabuk olalım.' : OPENING[n.kind] || OPENING.transfer, level: null };
};

export default function Negotiation({ close }) {
  const st = useStore();
  const S = st.S;
  const live = S ? sel.negotiationView(S) : null;
  const snap = useRef(null);
  if (live) snap.current = live;
  const n = snap.current;

  const [pkg, setPkg] = useState(() => (live ? clonePkg(live.package || live.fair) : null));
  const [koz, setKoz] = useState(null);
  const [prev, setPrev] = useState(null);
  const [view, setView] = useState(() => initialView(live));
  const [end, setEnd] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lost, setLost] = useState(null);
  const [shake, setShake] = useState(0);
  const [stamp, setStamp] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [refusal, setRefusal] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [editHes, setEditHes] = useState(false);
  const [seen, setSeen] = useState(() => tipsSeen());
  const [flash, setFlash] = useState(0);
  const patRef = useRef(live ? live.patience : 0);
  const timer = useRef(null);
  const builderRef = useRef(null);
  const rootRef = useRef(null);
  const toTop = () => { try { const o = rootRef.current && rootRef.current.closest('.overlay'); if (o) o.scrollTo({ top: 0, behavior: 'smooth' }); } catch {} };
  const pkgRef = useRef(pkg); pkgRef.current = pkg;

  useEffect(() => { if (!n) afterTable(); return () => clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!live) return;
    const pv = patRef.current;
    if (live.patience < pv) { const s = new Set(); for (let i = live.patience; i < pv; i++) s.add(i); setLost(s); audio.play('tick'); haptics.warn(); }
    patRef.current = live.patience;
  }, [live ? live.patience : -1]);
  useEffect(() => { if (!live || !live.pending) setEditHes(false); }, [live ? !!live.pending : false]);
  useEffect(() => {
    if (!n || end || !pkg) return undefined;
    const t = setTimeout(() => { const r = store.act('negPreview', { package: pkg, koz }); if (r && r.ok) setPrev(r.preview); }, 140);
    return () => clearTimeout(t);
  }, [pkg, koz, n ? n.id : '', !!end]);

  if (!n || !pkg) return html`<${Overlay} label="Masa" onClose=${close}><div class="screen-pad"></div></${Overlay}>`;

  const club = S.clubs[n.clubId];
  const fromClub = n.fromClubId ? S.clubs[n.fromClubId] : null;
  const pl = S.players[n.playerId];
  const cv = sel.clientView(S, n.playerId);
  const P = pkgParts(pkg);
  const L = n.limits;
  const th = n.feeThreshold;
  const set = (k, v) => { setPkg((p) => ({ ...p, [k]: v })); setRefusal(null); };
  const setClause = (k) => { setPkg((p) => ({ ...p, clauses: { ...p.clauses, [k]: !p.clauses[k] } })); setRefusal(null); audio.play('click'); };
  const pending = live && live.pending && !editHes ? live.pending : null;
  const ended = !!end;
  const lastCost = (n.log || []).filter((l) => l.outcome === 'refused').slice(-1)[0];
  const sat = prev ? prev.satisfaction : 0;
  const word = sel.satWord(sat);
  const clientNo = prev && !prev.clientOk && !prev.clientLean;
  const rate = 1 + (pkg.clauses.minutes ? BAL.neg.clause.minutes : 0) + (pkg.clauses.release ? BAL.neg.clause.release : 0);
  const warnFee = Math.round((th * rate * (pkg.wage * 12 * pkg.years + pkg.bonus)) / (1 - th * rate));
  const wageStep = niceStep(L.wage[1] - L.wage[0], 100), bonusStep = niceStep(L.bonus[1] - L.bonus[0], 500), feeStep = niceStep(L.fee[1] - L.fee[0], 500);
  const tip = !ended && TIPS.find((t) => !seen.includes(t.id) && (t.id === 'tell' || (t.id === 'creep' && n.round >= 1 && seen.includes('tell')) || (t.id === 'pie' && seen.includes('tell') && (seen.includes('creep') || n.round === 0))));

  // ------------------------------------------------------------ actions
  const finishDeal = (r) => {
    const evs = r.events || [];
    const dd = evs.find((e) => e.type === 'dealDone');
    const deal = { ...(dd || { type: 'dealDone', playerId: n.playerId, fromClubId: n.fromClubId, toClubId: n.clubId, fee: n.transferFee, commission: pkg.fee, wage: pkg.wage, years: pkg.years, kind: n.kind, bonus: pkg.bonus, clauses: pkg.clauses }),
      feeNoticed: evs.some((e) => e.type === 'feeNoticed'), leaned: evs.some((e) => e.type === 'leaned') };
    setEnd({ type: 'accepted', deal });
    setView({ face: 'smile', line: r.line || 'Anlaştık. Kalemi uzat.', level: 0 });
    setStamp({ tone: 'lime', title: 'ANLAŞTIK', key: Math.random() });
    audio.play('confirm'); haptics.success();
    timer.current = setTimeout(() => openOverlay('Ceremony', { deal }), 1400);
  };
  const handle = (r) => {
    setBusy(false); toTop();
    const kr = r.koz;
    if (kr) {
      if (kr.caught) { setStamp({ tone: 'danger', title: 'BLÖF YAKALANDI', text: (kr.line ? kr.line + ' ' : '') + 'Güven −15, itibar −2, sabır −2.', key: Math.random(), big: true }); audio.play('badnews'); haptics.heavy(); setShake((x) => x + 1); }
      else setStamp({ tone: 'info', title: kr.label.toUpperCase(), text: kr.id === 'blof' ? 'Blöf tuttu: direktör inandı.' : 'Koz oynandı.', key: Math.random() });
    }
    setKoz(null);
    if (r.outcome === 'accepted') return finishDeal(r);
    if (r.outcome === 'hesitates') {
      setView({ face: 'smile', line: r.line || 'Kulüp olarak tamamız. Oyuncuya sor.', level: 0 }); setRefusal(null);
      setStamp({ tone: 'gold', title: 'KULÜP EVET DEDİ', text: 'Şimdi oyuncunun gönlünü almalısın.', key: Math.random() });
      return undefined;
    }
    if (r.outcome === 'left') {
      setEnd({ type: 'left', events: r.events || [], koz: kr || null, trust: (r.events || []).map((e) => e.trust).filter((x) => x != null).pop() });
      setView({ face: 'stand', line: r.line || 'Bu kadar yeter.', level: 4, sub: r.tell ? r.tell.line : null });
      setStamp({ tone: 'danger', title: 'MASADAN KALKTI', key: Math.random() });
      audio.play('badnews'); haptics.heavy(); setShake((x) => x + 1);
      setTimeout(() => setLeaving(true), 900);
      return undefined;
    }
    // countered
    const t = r.tell;
    setView({ face: faceOf(t.face), line: t.line, sub: r.line, level: t.level });
    setRefusal(null);
    if (r.insult) { setStamp({ tone: 'danger', title: 'HAKARET!', text: 'Teklifin tavanın çok üstünde: sabır −2.', key: Math.random() }); setShake((x) => x + 1); haptics.heavy(); audio.play('error'); }
    else if (!kr || !kr.caught) audio.play('whoosh');
    return undefined;
  };
  const submit = () => {
    if (busy || ended) return;
    if (clientNo) { setRefusal({ parts: prev.satisfactionParts, satisfaction: prev.satisfaction }); haptics.warn(); audio.play('error'); setStamp(null); return; }
    setBusy(true);
    const r = store.act('negPropose', { package: pkg, koz });
    if (!r.ok) { setBusy(false); setRefusal({ error: r.error, parts: prev ? prev.satisfactionParts : [], satisfaction: prev ? prev.satisfaction : null }); haptics.warn(); return; }
    handle(r);
  };
  const acceptCounter = () => { if (busy) return; setBusy(true); const r = store.act('negAcceptCounter'); if (!r.ok) { setBusy(false); return; } handle(r); };
  const lean = () => { if (busy) return; setBusy(true); const r = store.act('negLeanOnClient'); if (!r.ok) { setBusy(false); return; } toTop(); finishDeal(r); };
  const workOn = () => {
    if (!live || !live.counter) return;
    setPkg(clonePkg(live.counter.package)); setRefusal(null); setFlash((x) => x + 1); audio.play('page');
    if (builderRef.current) builderRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const walk = () => { setConfirm(false); const r = store.act('negWalkAway'); if (r.ok) afterTable(); };
  const dismissTip = (id) => { tipSeen(id); setSeen(tipsSeen()); };
  const leftInfo = end && end.type === 'left' ? end : null;
  const cd = (BAL.neg.leave && BAL.neg.leave.cooldown) || 3;

  // ------------------------------------------------------------ render
  return html`<${Overlay} label="Pazarlık masası" tone=${leftInfo ? 'danger' : undefined} onClose=${ended ? undefined : () => setConfirm(true)}>
    <div class=${cx('table', leftInfo && 'is-left')} ref=${rootRef}>
      <header class="table__top">
        <div><div class="eyebrow">Masa · ${n.kindLabel}</div></div>
        ${n.deadline ? html`<${Badge} tone="danger" icon="clock">Son Gün</${Badge}>` : null}
        ${ended ? null : html`<button type="button" class="table__x" aria-label="Masadan kalk" onClick=${() => setConfirm(true)}><${Icon} name="close" size=${20} /></button>`}
      </header>

      <${Stage} director=${club.director} club=${club} face=${view.face} line=${view.line} sub=${view.sub} level=${view.level} leaving=${leaving} shake=${shake}
        stamp=${stamp} patience=${live ? live.patience : 0} patienceMax=${n.patienceMax} lost=${lost} round=${n.round} />

      <div class="table__grid">
        <div class="table__col">
          <section class="tctx">
            <div class="tctx__row">
              <${Avatar} id=${pl.id} size=${52} />
              <div class="tctx__id"><b class="t-display">${pl.name}</b><span><${PosChip} pos=${pl.pos} /> ${pl.age} yaş${cv ? ' · ' + cv.traitLabel : ''}</span></div>
              <div class="tctx__move" aria-label="Kulüp değişikliği">
                ${fromClub && fromClub.id !== club.id ? html`<${Crest} colors=${fromClub.colors} pattern=${fromClub.crest} size=${34} /><${Icon} name="arrowRight" size=${18} />` : null}
                <${Crest} colors=${club.colors} pattern=${club.crest} size=${40} />
              </div>
            </div>
            <div class="tctx__facts">
              <${Badge} tone=${n.kind === 'renewal' ? 'info' : n.kind === 'free' ? 'lime' : 'gold'}>${KIND_LABEL[n.kind]}</${Badge}>
              ${n.kind === 'transfer' ? html`<span class="tctx__fee"><${Icon} name="swap" size=${14} /> Bonservis: <b class="num">${eur(n.transferFee)}</b> — kulüpler anlaştı</span>`
                : n.kind === 'free' ? html`<span class="tctx__fee">Bonservis yok: pasta oyuncunun ve senin.</span>` : html`<span class="tctx__fee">Mevcut kulüple uzatma: bonservis yok.</span>`}
              ${cv && cv.dream && !cv.dream.done ? html`<span class="tctx__dream"><${Icon} name="star" size=${13} /> Hayali: ${cv.dream.label}</span>` : null}
            </div>
          </section>

          ${leftInfo ? html`<section class="tpanel is-danger tpanel--left">
            <h3 class="t-display">Direktör masadan kalktı</h3>
            <ul class="tpanel__list">
              <li>${club.name} direktörü ${leftInfo.koz && leftInfo.koz.caught ? 'blöfünü yakaladı ve ' : ''}sinirle kalktı.</li>
              <li>Kulüp güveni <b class="danger">−10</b>${leftInfo.koz && leftInfo.koz.caught ? ' (blöf: ek −15)' : ''}${leftInfo.trust != null ? ` — şimdi ${Math.round(leftInfo.trust)}` : ''}.</li>
              <li>${cd} ay boyunca ${pl.name} için bu kulüpte masa kuramazsın.</li>
              ${leftInfo.koz && leftInfo.koz.caught ? html`<li>İtibar <b class="danger">−2</b>.</li>` : null}
            </ul>
          </section>` : null}

          ${live && live.counter && !pending && !ended ? html`<${Counter} counter=${live.counter} mine=${live.package} word=${sel.satWord(live.counter.satisfaction)} busy=${busy} onAccept=${acceptCounter} onWork=${workOn} />` : null}

          ${pending ? html`<section class="tpanel is-gold" aria-live="polite">
            <h3 class="t-display">Oyuncu tereddüt ediyor</h3>
            <p>Kulüp teklifini kabul etti, ama ${pl.name} paketten emin değil (memnuniyet <b class="num">${Math.round(pending.satisfaction)}</b>, imza için 50 gerekir).</p>
            <div class="tpanel__act">
              <${Button} variant="gold" block disabled=${busy} onClick=${lean}>İkna et (bağlılık −8)</${Button}>
              <${Button} variant="ghost" block onClick=${() => { setPkg(clonePkg(pending.package)); setEditHes(true); }}>Paketi değiştir</${Button}>
            </div>
          </section>` : null}

          ${refusal ? html`<section class="tpanel is-danger" role="alert">
            <h3 class="t-display">${pl.name} bunu kabul etmez</h3>
            <p>${refusal.satisfaction != null ? `Memnuniyet ${Math.round(refusal.satisfaction)}; en az 40 gerekir. ` : ''}${refusal.error && !/memnuniyet/.test(refusal.error) ? refusal.error : 'Şunlar canını sıkıyor:'}</p>
            <ul class="tpanel__parts">${(refusal.parts || []).filter((p) => p.value < 0).map((p) => html`<li><span>${p.label}</span><b class="num danger">−${Math.abs(p.value)}</b></li>`)}</ul>
            <p class="small muted">Maaşı ya da imza primini artır; dakika garantisi forma şansını yükseltir.</p>
          </section>` : null}

          ${tip ? html`<aside class="ttip" key=${tip.id}><span class="ttip__ico"><${Icon} name=${tip.icon} size=${20} /></span><div><b>${tip.title}</b><p>${tip.text}</p></div>
            <button type="button" class="ttip__ok" onClick=${() => dismissTip(tip.id)}>Anladım</button></aside>` : null}

          <section class=${cx('tbuild', flash && 'is-flash')} key=${'b' + flash} ref=${builderRef} aria-label="Paket">
            <${SectionTitle}>Paketin</${SectionTitle}>
            <${Slider} label="Oyuncu maaşı (aylık)" value=${pkg.wage} min=${L.wage[0]} max=${L.wage[1]} step=${wageStep} onChange=${(v) => set('wage', v)} format=${(v) => eur(v)}
              markers=${[{ value: n.demandWage, label: 'İstediği', tone: 'info' }, { value: n.fair.wage, label: 'Adil', tone: 'lime' }]}
              hint=${cv ? `Şimdiki maaşı ${eur(cv.wage)}; ${club.name} için istediği ${eur(n.demandWage)}.` : null} />
            <div class="tyears" role="group" aria-label="Süre">
              <span class="tslider__label">Süre</span>
              <div class="tyears__row">${[1, 2, 3, 4, 5].map((y) => html`<button type="button" key=${y} class=${cx('tyears__btn', pkg.years === y && 'is-on')} aria-pressed=${pkg.years === y ? 'true' : 'false'} onClick=${() => { set('years', y); audio.play('click'); }}><b class="num">${y}</b><span>yıl</span></button>`)}</div>
            </div>
            <${Slider} label="İmza primi (oyuncuya)" tone="lime" value=${pkg.bonus} min=${L.bonus[0]} max=${L.bonus[1]} step=${bonusStep} onChange=${(v) => set('bonus', v)} format=${(v) => eur(v)}
              markers=${[{ value: n.fair.bonus, label: 'Adil', tone: 'lime' }]} />
            <${Slider} label="SENİN KOMİSYONUN" tone="gold" big value=${pkg.fee} min=${L.fee[0]} max=${L.fee[1]} step=${feeStep} onChange=${(v) => set('fee', v)} format=${(v) => eur(v)}
              markers=${[{ value: n.fair.fee, label: 'Adil', tone: 'gold' }, { value: warnFee, label: 'Fark eder', tone: 'danger' }]} />
            <div class="tclauses">
              <button type="button" class=${cx('tclause', pkg.clauses.minutes && 'is-on')} role="switch" aria-checked=${pkg.clauses.minutes ? 'true' : 'false'} onClick=${() => setClause('minutes')}>
                <span class="tclause__sw"><i></i></span><span class="tclause__t"><b>Forma garantisi</b><small>Oyuncu daha çok oynar · maliyet +%${Math.round(BAL.neg.clause.minutes * 100)}</small></span></button>
              <button type="button" class=${cx('tclause', pkg.clauses.release && 'is-on')} role="switch" aria-checked=${pkg.clauses.release ? 'true' : 'false'} onClick=${() => setClause('release')}>
                <span class="tclause__sw"><i></i></span><span class="tclause__t"><b>Serbest kalma maddesi</b><small>Oyuncuya güven verir · maliyet +%${Math.round(BAL.neg.clause.release * 100)}</small></span></button>
            </div>
          </section>
        </div>

        <div class="table__col">
          <section class="tsum card" aria-label="Özet">
            <${SectionTitle}>Pasta</${SectionTitle}>
            <${Pasta} pkg=${pkg} fair=${n.fair} counter=${live ? live.counter : null} lastCost=${lastCost ? lastCost.cost : 0} band=${n.ceilingBand} prev=${prev} />
            <${Satisfaction} prev=${prev} word=${word} />
            ${prev && prev.expectedMinutes != null ? html`<p class="tsum__min small muted"><${Icon} name="ball" size=${13} /> Orada tahmini forma süresi: <b class="num">%${Math.round(prev.expectedMinutes * 100)}</b></p>` : null}
            <${FeeShare} prev=${prev} threshold=${th} />
          </section>

          <section class="thandwrap">
            <${SectionTitle} right=${koz ? '1 / 1' : '0 / 1'}>Koz kartların</${SectionTitle}>
            ${n.ceilingBand ? html`<div class="tband"><${Icon} name="eye" size=${16} /> Direktörün tavanı yaklaşık <b class="num">${eur(n.ceilingBand.lo)} – ${eur(n.ceilingBand.hi)}</b> arasında${n.ceilingBand.source === 'dostluk' ? ' (eski dostluk)' : ''}.</div>` : null}
            <${Hand} hand=${n.hand} sel=${koz} onPick=${setKoz} disabled=${ended} />
            <p class="small muted">Her tur en fazla bir koz oynanır. Blöfün riski gerçektir: yakalanırsan sabır −2, güven −15, itibar −2.</p>
          </section>

          <${RoundLog} log=${n.log} hand=${n.hand} open=${logOpen} onToggle=${() => setLogOpen((x) => !x)} />
        </div>
      </div>

      <footer class="table__bar" role="region" aria-label="Eylemler">
        ${ended && end.type === 'accepted' ? html`<div class="table__barrow"><span class="table__barmsg">Anlaşma imzalanıyor…</span><${Button} variant="primary" onClick=${() => { clearTimeout(timer.current); openOverlay('Ceremony', { deal: end.deal }); }}>Devam</${Button}></div>`
          : ended ? html`<div class="table__barrow"><${Button} variant="ghost" block onClick=${afterTable}>Tamam</${Button}></div>`
          : html`<div class="table__barsum"><span>Maliyet <b class="num gold">${eur(prev ? prev.cost : P.cost)}</b></span><span class=${cx('table__barsat', sat >= 50 ? 'is-ok' : sat >= 40 ? 'is-lean' : 'is-bad')}>Oyuncu: <b>${word}</b> <b class="num">${Math.round(sat)}</b></span></div>
          <div class="table__barrow">
            <${Button} variant="ghost" onClick=${() => setConfirm(true)}>Masadan kalk</${Button}>
            ${pending ? html`<${Button} variant="gold" class="table__go" disabled=${busy} onClick=${lean}>İkna et</${Button}>`
              : html`<${Button} variant="primary" class="table__go" disabled=${busy} icon="handshake" onClick=${submit}>${koz ? 'Teklif et + Koz' : 'Teklif et'}</${Button}>`}
          </div>`}
      </footer>
    </div>
    ${confirm ? html`<${Sheet} title="Masadan kalkılsın mı?" onClose=${() => setConfirm(false)} footer=${html`<div class="grid-2"><${Button} variant="ghost" onClick=${() => setConfirm(false)}>Devam et</${Button}><${Button} variant="danger" onClick=${walk}>Masadan kalk</${Button}></div>`}>
      <p>Cezası yok: direktörle ilişkin bozulmaz. Ama harcadığın enerji geri gelmez ve masa kapanır.</p>
    </${Sheet}>` : null}
  </${Overlay}>`;
}
