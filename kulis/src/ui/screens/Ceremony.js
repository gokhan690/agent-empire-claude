// Signing ceremony — pen signature on a contract card, tabloid headline, rolling commission / rep counters, fit notes.
import { html, useState, useEffect, useRef, Overlay, Icon, Button, Badge, Avatar, Crest, PosChip, store, audio, haptics, confetti, hash32, mulberry32, cx, reducedMotion, fmtMoney } from '../ui-kit.js';
import { eur, afterTable, useCount, KIND_LABEL } from './table/lib.js';

function sigPath(seed, w = 150) {
  const r = mulberry32(hash32('sig:' + seed));
  let x = 8, y = 36;
  let d = `M${x} ${y}`;
  const n = 6 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const nx = x + (w / n) * (0.75 + r() * 0.5);
    const c1y = 6 + r() * 20, c2y = 30 + r() * 26, ny = 18 + r() * 28;
    d += ` C${(x + (nx - x) * 0.25).toFixed(1)} ${c1y.toFixed(1)}, ${(x + (nx - x) * 0.7).toFixed(1)} ${c2y.toFixed(1)}, ${nx.toFixed(1)} ${ny.toFixed(1)}`;
    x = nx; y = ny;
  }
  d += ` M10 ${54 + r() * 4} Q${(w / 2).toFixed(0)} ${44 + r() * 6} ${(x + 8).toFixed(1)} ${52 + r() * 6}`;
  return d;
}
const up = (s) => String(s).toLocaleUpperCase('tr-TR');
const lastName = (n) => String(n).split(' ').slice(-1)[0];

/** Tabloid headline + deck, deterministic per deal. */
function headline(S, deal, p, to, from) {
  const pick = (a) => a[hash32(p.id + to.id + deal.kind) % a.length];
  const name = up(p.name), club = up(to.name), who = up(lastName(p.name));
  const fee = deal.fee > 0 ? `Bonservis ${fmtMoney(deal.fee)}` : 'Bonservis yok';
  if (deal.kind === 'renewal') return { h: pick([`${who} YUVASINDAN AYRILMIYOR`, `${who} İMZAYI ATTI: ${club} İLE DEVAM`, `ADRES BELLİ: ${who} ${club} İLE UZATTI`]), s: `${p.name}, ${to.name} ile ${deal.years} yıllık yeni sözleşme imzaladı.` };
  if (deal.preContract) return { h: pick([`GİZLİ ANLAŞMA: ${who} SEZON SONUNDA ${club} YOLCUSU`, `${name} KAPIYI ÇARPMADAN ÇIKIYOR`, `BOSMAN OPERASYONU: ${who} ${club} İLE ANLAŞTI`]), s: `${from ? from.name + ' öfkeli. ' : ''}${p.name} sezon sonunda ${to.name} forması giyecek.` };
  if (deal.kind === 'free') return { h: pick([`${who} BEDELSİZ KAPTI!`, `${club} BEDAVAYA ${who} İMZALATTI`, `SERBEST FUTBOLCU ${who} ARTIK ${club} FUTBOLCUSU`]), s: `${p.name}, ${to.name} ile ${deal.years} yıllık sözleşme imzaladı.` };
  return { h: pick([`${who} İMZAYI ATTI!`, `TRANSFER ÇOK İÇ: ${who} ${club} İLE ANLAŞTI`, `${name}: RESMEN ${club} FUTBOLCUSU`, `${S.meta.agentName ? up(S.meta.agentName) + ' İŞİ BİTİRDİ: ' : ''}${who} ${club} İÇİN İMZADA`]), s: `${from ? from.name + ' → ' : ''}${to.name} · ${fee} · ${deal.years} yıl` };
}

export default function Ceremony({ close, deal }) {
  const S = store.S;
  const d = deal || {};
  const p = S && S.players[d.playerId];
  const to = S && S.clubs[d.toClubId];
  const from = S && d.fromClubId ? S.clubs[d.fromClubId] : null;
  const [step, setStep] = useState(reducedMotion() ? 5 : 0);
  const done = useRef(false);
  useEffect(() => {
    if (!p || !to) return undefined;
    const T = [];
    const at = (ms, f) => T.push(setTimeout(f, ms));
    if (reducedMotion()) { audio.play('sign'); return undefined; }
    at(500, () => setStep(1));
    at(2100, () => { setStep(2); audio.play('sign'); haptics.success(); confetti({ y: window.innerHeight * 0.32, count: 150, colors: [...to.colors, '#F5C451', '#EEF4EF', '#3DDC84'] }); });
    at(2900, () => setStep(3));
    at(3500, () => setStep(4));
    at(4300, () => setStep(5));
    return () => T.forEach(clearTimeout);
  }, []);
  const skip = () => setStep(5);
  useEffect(() => { // keep the newest reveal in view
    if (step < 3) return undefined;
    const t = setTimeout(() => { try { const o = document.querySelector('.overlay'); if (o) o.scrollTo({ top: o.scrollHeight, behavior: 'smooth' }); } catch {} }, 120);
    return () => clearTimeout(t);
  }, [step]);
  const commission = useCount(d.commission || 0, { delay: 0, duration: 1100, on: step >= 4 });
  const rep = useCount(d.repGain || 0, { duration: 900, on: step >= 4 });
  const coinFired = useRef(false);
  useEffect(() => { if (step >= 4 && !coinFired.current && (d.commission || 0) > 0) { coinFired.current = true; audio.play('coin'); setTimeout(() => audio.play('coin'), 380); } }, [step]);
  if (!p || !to) return html`<${Overlay} label="İmza töreni" onClose=${close}><div class="screen-pad"><${Button} variant="ghost" onClick=${afterTable}>Devam</${Button}></div></${Overlay}>`;
  const hl = headline(S, d, p, to, from);
  const renewal = d.kind === 'renewal', pre = !!d.preContract, moved = !renewal && from && from.id !== to.id;
  const kindText = pre ? 'Ön sözleşme' : renewal ? 'Sözleşme uzatma' : d.kind === 'free' ? 'Bedelsiz transfer' : 'Transfer';
  const mins = d.expectedMinutes != null ? Math.round(d.expectedMinutes * 100) : null;
  const notes = (d.fit && d.fit.notes) || [];
  const finish = () => { if (!done.current) { done.current = true; afterTable(); } };
  return html`<${Overlay} label="İmza töreni" tone="gold" onClose=${finish}>
    <div class=${cx('cer', `is-step-${step}`)} onClick=${step < 5 ? skip : undefined}>
      <div class="cer__spot" aria-hidden="true"></div>
      <div class="cer__top"><span class="eyebrow gold">İmza töreni</span><h1 class="t-display cer__title">${pre ? 'Sezon sonunda katılacak' : renewal ? 'Sözleşme uzatıldı' : 'Anlaşma tamam'}</h1></div>

      <article class="cer-paper">
        <header class="cer-paper__head"><span>Futbolcu sözleşmesi</span><span>${kindText}</span></header>
        <div class="cer-paper__who"><${Avatar} id=${p.id} size=${64} /><div><b class="t-display">${p.name}</b><span><${PosChip} pos=${p.pos} /> ${p.age} yaş</span></div></div>
        <div class=${cx('cer-paper__move', !moved && 'is-solo')}>
          ${moved ? html`<div class="cer-paper__club"><${Crest} colors=${from.colors} pattern=${from.crest} size=${52} /><small>${pre ? 'Şimdi' : 'Eski'}</small><span>${from.name}</span></div>
            <div class="cer-paper__arrow"><${Icon} name="arrowRight" size=${30} strokeWidth=${2.6} /></div>` : null}
          <div class="cer-paper__club is-new"><${Crest} colors=${to.colors} pattern=${to.crest} size=${64} /><small>${pre ? 'Sezon sonunda' : renewal ? 'Devam' : 'Yeni'}</small><span>${to.name}</span></div>
        </div>
        <dl class="cer-paper__terms">
          <div><dt>Maaş</dt><dd class="num">${eur(d.wage)}<small>/ay</small></dd></div>
          <div><dt>Süre</dt><dd class="num">${d.years}<small> yıl</small></dd></div>
          <div><dt>İmza primi</dt><dd class="num">${eur(d.bonus || 0)}</dd></div>
          <div><dt>${d.kind === 'transfer' ? 'Bonservis' : 'Bonservis'}</dt><dd class="num">${d.kind === 'transfer' && d.fee > 0 ? eur(d.fee) : 'Yok'}</dd></div>
        </dl>
        ${d.clauses && (d.clauses.minutes || d.clauses.release) ? html`<p class="cer-paper__cl">${[d.clauses.minutes ? 'Forma garantisi' : null, d.clauses.release ? 'Serbest kalma maddesi' : null].filter(Boolean).join(' · ')}</p>` : null}
        <div class="cer-paper__sigs">
          <div class="cer-sig"><svg viewBox="0 0 170 66" class=${cx(step >= 1 && 'is-draw')} aria-hidden="true"><path pathLength="1" d=${sigPath(p.name)} /></svg><span>Oyuncu</span></div>
          <div class="cer-sig is-agent"><svg viewBox="0 0 170 66" class=${cx(step >= 1 && 'is-draw')} aria-hidden="true"><path pathLength="1" d=${sigPath(S.meta.agentName || 'ajan', 130)} /></svg><span>Menajer</span></div>
        </div>
        <div class=${cx('cer-seal', step >= 2 && 'is-on')} aria-hidden="true"><b>ONAYLANDI</b><span>${renewal ? 'UZATMA' : pre ? 'ÖN SÖZLEŞME' : 'TRANSFER'}</span></div>
      </article>

      ${step >= 3 ? html`<article class="cer-news" aria-label="Manşet">
        <div class="cer-news__mast"><b>GÜNLÜK KULİS</b><span>SPOR · SON DAKİKA</span></div>
        <h2 class="cer-news__h">${hl.h}</h2>
        <p class="cer-news__s">${hl.s}</p>
      </article>` : null}

      ${step >= 4 ? html`<section class="cer-gain" aria-label="Kazanç">
        <div class="cer-gain__big"><span class="eyebrow">Komisyonun</span><b class="num gold">${commission > 0 || d.commission ? fmtMoney(Math.round(commission)) : '€0'}</b><${Badge} tone="gold" icon="cash">Kasana yattı</${Badge}></div>
        <div class="cer-gain__rep"><span class="eyebrow">İtibar</span><b class="num lime">+${rep.toFixed(1).replace('.', ',')}</b></div>
      </section>` : null}

      ${step >= 5 ? html`<section class="cer-fit">
        ${mins != null ? html`<div class="cer-fit__min"><${Icon} name="ball" size=${20} /><div><span class="eyebrow">Yeni kulüpte</span><b class="num">Orada %${mins} oynar</b></div></div>` : null}
        ${notes.length ? html`<ul class="cer-fit__notes">${notes.map((t) => html`<li>${t}</li>`)}</ul>` : null}
        ${pre ? html`<p class="cer-fit__w"><${Icon} name="alert" size=${15} /> ${from ? from.name : 'Eski kulüp'} öfkeli: güven −20. Oyuncu sezon sonunda katılır.</p>` : null}
        ${d.leaned ? html`<p class="cer-fit__w"><${Icon} name="alert" size=${15} /> Oyuncuyu ikna ettin: bağlılık −8.</p>` : null}
        ${d.feeNoticed ? html`<p class="cer-fit__w"><${Icon} name="alert" size=${15} /> Komisyonunu fark etti: bağlılık −5.</p>` : null}
        ${d.fit && (d.fit.morale || d.fit.loyalty) ? html`<div class="cer-fit__d">${d.fit.morale ? html`<span>Moral <b class=${cx('num', d.fit.morale > 0 ? 'lime' : 'danger')}>${d.fit.morale > 0 ? '+' : '−'}${Math.abs(d.fit.morale)}</b></span>` : null}${d.fit.loyalty ? html`<span>Bağlılık <b class=${cx('num', d.fit.loyalty > 0 ? 'lime' : 'danger')}>${d.fit.loyalty > 0 ? '+' : '−'}${Math.abs(d.fit.loyalty)}</b></span>` : null}</div>` : null}
      </section>` : null}

      <footer class="cer__bar"><${Button} variant=${step >= 5 ? 'gold' : 'ghost'} size="lg" block onClick=${(e) => { e.stopPropagation(); finish(); }}>${S.time.phase === 'deadline' && S.deadline ? 'Son Gün’e dön' : 'Devam'}</${Button}></footer>
    </div>
  </${Overlay}>`;
}
