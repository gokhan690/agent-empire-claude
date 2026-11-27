import { html, useState, useEffect, useRef, Overlay, Button, Card, Badge, Icon, Avatar, Crest, NumberTicker, Money, store, audio, confetti, toast, useStore, fmtInt, fmtMoney } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';
import { downloadText, openPlayer, useGrow } from './common.js';

const MOOD = {
  efsane: { tone: 'gold', icon: 'trophy', eyebrow: 'Efsane', accent: 'gold', rank: 'Sen bir efsanesin' },
  buyuk: { tone: 'gold', icon: 'star', eyebrow: 'Büyük menajer', accent: 'gold', rank: '' },
  saygin: { tone: 'night', icon: 'handshake', eyebrow: 'Saygın bir kariyer', accent: 'lime', rank: '' },
  siradan: { tone: 'night', icon: 'whistle', eyebrow: 'Sıradan bir kariyer', accent: 'muted', rank: '' },
  iflas: { tone: 'danger', icon: 'lock', eyebrow: 'Kapılar kapandı', accent: 'danger', rank: '' },
  yalniz: { tone: 'danger', icon: 'users', eyebrow: 'Ofis sessiz', accent: 'danger', rank: '' },
};
const TONE = { good: { icon: 'check', label: 'Hayatı güzel' }, neutral: { icon: 'whistle', label: 'Hayatına devam' }, bitter: { icon: 'alert', label: 'Acı bir son' } };
const ordinal = (n) => n + '.';

/** Fades a block in when it scrolls into view (inside the overlay's own scroller). */
function Reveal({ children, class: cls, delay = 0 }) {
  const ref = useRef();
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!('IntersectionObserver' in window)) { setOn(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setOn(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return html`<div ref=${ref} class=${'ending-reveal ' + (on ? 'is-in ' : '') + (cls || '')} style=${{ transitionDelay: delay + 'ms' }}>${children}</div>`;
}

function Podium({ rows }) {
  const grown = useGrow(500);
  const order = [rows[1], rows[0], rows[2]].filter(Boolean);
  const rest = rows.slice(3);
  const max = Math.max(1, ...rows.map((r) => r.score));
  return html`<div class="ending-podium">
    <div class="ending-podium__stage">${order.map((r) => html`<div class=${'ending-pod ending-pod--' + r.rank + (r.isYou ? ' is-you' : '')} style=${{ '--rc': r.color }}>
      <div class="ending-pod__who"><span class="ending-pod__name">${r.name}</span>${r.isYou ? html`<${Badge} tone="lime">Sen</${Badge}>` : null}</div>
      <div class=${'ending-pod__block' + (grown ? ' is-up' : '')}><b class="num">${r.rank}</b><span class="num">${fmtMoney(r.score)}</span></div>
    </div>`)}</div>
    ${rest.map((r) => html`<div class=${'ending-pod-rest' + (r.isYou ? ' is-you' : '')} style=${{ '--rc': r.color }}><b class="num">${r.rank}</b><span class="grow">${r.name}${r.isYou ? html` <${Badge} tone="lime">Sen</${Badge}>` : ''}</span><span class="num muted">${fmtMoney(r.score)}</span></div>`)}
  </div>`;
}

export default function Ending({ close }) {
  const S = useStore((s) => s.S);
  const E = S && S.ending;
  const [confirm, setConfirm] = useState(false);
  const kind = E ? E.kind : 'siradan';
  const mood = MOOD[kind] || MOOD.siradan;
  const dark = kind === 'iflas' || kind === 'yalniz';
  const rows = S ? sel.rankingView(S) : [];
  useEffect(() => {
    if (!E) return;
    if (kind === 'efsane' || kind === 'buyuk') { audio.play('levelup'); setTimeout(() => confetti({ count: kind === 'efsane' ? 220 : 120, colors: ['#F5C451', '#FFD97A', '#EEF4EF', '#3DDC84'], power: 13 }), 500); if (kind === 'efsane') setTimeout(() => confetti({ x: window.innerWidth * 0.2, count: 90 }), 1300); }
    else if (dark) audio.play('badnews');
    else audio.play('page');
  }, []);
  if (!E) return html`<${Overlay} label="Kariyer sonu" onClose=${close}><div class="screen-pad center"><p class="muted">Henüz bir final yok.</p><${Button} variant="ghost" onClick=${close}>Kapat</${Button}></div></${Overlay}>`;

  const canEndless = !dark && !S.meta.endless && !E.continued;
  const go = () => { const r = store.act('continueEndless', {}); if (r.ok) { audio.play('levelup'); toast.success('Sonsuz mod başladı. Kariyerin süresiz sürüyor.', { sfx: false }); close(); } };
  const reset = () => { if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 4000); return; } store.reset(); };
  const exp = () => { const ok = downloadText(`kulis-${(S.meta.agencyName || 'kariyer').toLowerCase().replace(/[^a-z0-9ğüşıöç]+/gi, '-')}.json`, store.exportJSON()); toast[ok ? 'success' : 'error'](ok ? 'Kariyer dosyası indirildi' : 'Dışa aktarılamadı', { sfx: false }); };
  const me = rows.find((r) => r.isYou);

  return html`<${Overlay} label="Kariyer sonu" tone=${mood.tone} class=${'ending-ov ending-ov--' + kind}>
    <div class=${'ending-wrap' + (dark ? ' is-dark' : '')}>
      <section class="ending-hero">
        <div class=${'ending-hero__ico is-' + mood.accent}><${Icon} name=${mood.icon} size=${38} /></div>
        <div class="eyebrow ending-hero__eyebrow">${mood.eyebrow}</div>
        <h1 class=${'ending-hero__title t-display is-' + mood.accent}>${E.title}</h1>
        <p class="ending-hero__text">${E.text}</p>
        <div class="ending-hero__cue" aria-hidden="true"><${Icon} name="chevronDown" size=${22} /></div>
      </section>

      <${Reveal}><section class="ending-block">
        <div class="eyebrow">Beş ajans, bir sıralama</div>
        <h2 class="ending-h t-display">${me ? `${ordinal(me.rank)} sırada bitirdin` : 'Final sıralaması'}</h2>
        <${Podium} rows=${rows} />
      </section></${Reveal}>

      <${Reveal}><section class="ending-block ending-legacy">
        <div class="eyebrow">Miras puanı</div>
        <div class=${'ending-legacy__n num is-' + mood.accent}><${NumberTicker} value=${E.legacy} duration=${2200} format=${(n) => fmtInt(n)} /></div>
        <p class="muted small">Komisyon, transferler, şampiyonluklar ve sıralaman tek bir sayıda toplanır.</p>
      </section></${Reveal}>

      <${Reveal}><section class="ending-block">
        <div class="eyebrow">Kariyer defteri</div>
        <div class="ending-stats">${E.stats.map((s) => html`<div class="ending-stat"><span>${s.label}</span><b class="num">${s.value}</b></div>`)}</div>
      </section></${Reveal}>

      ${E.epilogues.length ? html`<section class="ending-block ending-epi">
        <${Reveal}><div class="eyebrow">Peki şimdi nerdeler?</div><h2 class="ending-h t-display">Müşterilerin</h2></${Reveal}>
        <div class="ending-epi__list">${E.epilogues.map((e, i) => html`<${Reveal} class=${'ending-card ending-card--' + e.tone}>
          <button type="button" class="ending-card__in" onClick=${() => openPlayer(e.playerId)}>
            <${Avatar} id=${e.playerId} size=${56} ring=${!dark} />
            <div class="ending-card__body"><div class="ending-card__top"><b>${e.name}</b><span class=${'ending-card__tone is-' + e.tone}><${Icon} name=${(TONE[e.tone] || TONE.neutral).icon} size=${13} />${(TONE[e.tone] || TONE.neutral).label}</span></div>
              <p>${e.text}</p></div>
          </button></${Reveal}>`)}</div>
      </section>` : null}

      <${Reveal}><section class="ending-actions">
        <p class="center muted small">${dark ? 'Her kariyer böyle bitmez. Bir dahaki sefere daha dikkatli.' : 'Hikâye burada bitmek zorunda değil.'}</p>
        ${canEndless ? html`<${Button} size="lg" block variant=${dark ? 'ghost' : 'gold'} onClick=${go}>Sonsuz modda devam et</${Button}>` : html`<p class="center muted small ending-locked"><${Icon} name="lock" size=${14} /> ${dark ? 'Bu sondan sonra sonsuz moda geçilemez.' : 'Sonsuz mod zaten açık.'}</p>`}
        <${Button} size="lg" block variant=${confirm ? 'danger' : dark ? 'primary' : 'ghost'} onClick=${reset}>${confirm ? 'Emin misin? Kayıt silinecek, tekrar dokun' : 'Yeni kariyer'}</${Button}>
        <${Button} variant="ghost" block icon="download" onClick=${exp}>Kariyeri dışa aktar</${Button}>
        <button type="button" class="ending-close" onClick=${close}>Ajansı incele</button>
      </section></${Reveal}>
    </div>
  </${Overlay}>`;
}
