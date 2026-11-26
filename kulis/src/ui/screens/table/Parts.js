// Presentational pieces of the Masa: stage (director), koz hand, counter card, round log.
import { html, cx, Icon, Button, Badge, Crest, PipMeter, audio } from '../../ui-kit.js';
import { DirectorFace } from './Face.js';
import { eur, TELL_WORDS, KOZ_ICON, useTyped } from './lib.js';

const TELL_TONE = ['lime', 'lime', 'gold', 'danger', 'danger'];

export function Patience({ value, max, lost }) {
  return html`<div class="tpat" role="meter" aria-valuemin="0" aria-valuemax=${max} aria-valuenow=${value} aria-label="Direktörün sabrı">
    <span class="tpat__lbl">Sabır</span>
    <span class="tpat__pips">${Array.from({ length: Math.max(max, value) }, (_, i) => {
      const on = i < value, fresh = !on && lost && lost.has(i);
      return html`<i key=${i + (on ? 'on' : fresh ? 'lost' : 'off')} class=${cx('tpat__pip', on && 'is-on', fresh && 'is-lost')}></i>`;
    })}</span>
  </div>`;
}

/** Director scene: face, speech bubble with the tell, gap thermometer, patience. */
export function Stage({ director, club, face, line, sub, level, leaving, shake, stamp, patience, patienceMax, lost, round, standing }) {
  const [shown, rest, typing] = useTyped(line);
  return html`<section class=${cx('tstage', shake ? `is-shake-${shake % 2}` : null, leaving && 'is-leaving', `is-${face}`)} aria-label="Direktör">
    <div class="tstage__lamp" aria-hidden="true"></div>
    <div class="tstage__main">
      <div class="tstage__who">
        <div class="tstage__face"><${DirectorFace} seed=${director.name} colors=${club.colors} face=${face} talking=${typing} leaving=${leaving} /></div>
        <div class="tstage__plate"><${Crest} colors=${club.colors} pattern=${club.crest} size=${26} /><div><b>${director.name}</b><span>Direktör · ${club.name}</span></div></div>
      </div>
      <div class="tstage__say">
        <div class=${cx('tbubble', typing && 'is-typing')} key=${line}>
          <p class="tbubble__txt">${shown}<span class="tbubble__rest">${rest}</span></p>
          ${sub ? html`<p class="tbubble__sub">${sub}</p>` : null}
        </div>
        ${level != null ? html`<div class="tgap" aria-label=${`Sınırına uzaklık: ${TELL_WORDS[level]}`}>
          <span class="tgap__lbl">Onun sınırına uzaklık</span>
          <span class="tgap__bars">${[0, 1, 2, 3, 4].map((i) => html`<i class=${cx('tgap__bar', i <= level && `is-${TELL_TONE[level]}`)}></i>`)}</span>
          <b class=${cx('tgap__word', `is-${TELL_TONE[level]}`)}>${TELL_WORDS[level]}</b>
        </div>` : html`<div class="tgap is-idle"><span class="tgap__lbl">Henüz bir teklif yapmadın. İlk tur onun tepkisini ölçmek içindir.</span></div>`}
      </div>
    </div>
    <div class="tstage__foot"><${Patience} value=${patience} max=${patienceMax} lost=${lost} /><span class="tstage__round num">TUR ${Math.max(1, round + (leaving ? 0 : 1))}</span></div>
    ${stamp ? html`<div class=${cx('tstamp', `is-${stamp.tone}`)} key=${stamp.key} role="status"><b>${stamp.title}</b>${stamp.text ? html`<span>${stamp.text}</span>` : null}</div>` : null}
  </section>`;
}

export function Hand({ hand, sel, onPick, disabled }) {
  if (!hand || !hand.length) return html`<p class="muted small">Elinde koz yok.</p>`;
  return html`<div class="thand" role="group" aria-label="Koz kartları">
    ${hand.map((k) => {
      const on = sel === k.id, bluff = k.id === 'blof';
      return html`<button type="button" key=${k.id} class=${cx('tkoz', on && 'is-on', k.used && 'is-used', bluff && 'is-bluff')} disabled=${k.used || disabled} aria-pressed=${on ? 'true' : 'false'}
        onClick=${() => { audio.play(on ? 'click' : 'whoosh'); onPick(on ? null : k.id); }}>
        <span class="tkoz__ico"><${Icon} name=${KOZ_ICON[k.id] || 'star'} size=${18} /></span>
        <span class="tkoz__name">${k.label}</span>
        <span class="tkoz__txt">${k.text}</span>
        <span class="tkoz__fx">${k.effect}</span>
        ${k.risk != null ? html`<span class="tkoz__risk">Yakalanma riski <b class="num">%${k.risk}</b></span>` : null}
        ${k.used ? html`<span class="tkoz__used">Oynandı</span>` : on ? html`<span class="tkoz__sel"><${Icon} name="check" size=${14} /> Bu tur</span>` : null}
      </button>`;
    })}
  </div>`;
}

const delta = (a, b, fmt = eur) => {
  const d = Math.round(b - a);
  return d === 0 ? null : html`<small class=${cx('tcounter__d', d < 0 ? 'is-down' : 'is-up')}>${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}</small>`;
};
export function Counter({ counter, mine, word, onAccept, onWork, busy }) {
  const c = counter.package, m = mine || c;
  const bad = !counter.clientOk && !counter.clientLean;
  const items = [
    ['Maaş', eur(c.wage) + '/ay', delta(m.wage, c.wage)],
    ['Süre', c.years + ' yıl', c.years !== m.years ? delta(m.years, c.years, (v) => v + ' yıl') : null],
    ['İmza primi', eur(c.bonus), delta(m.bonus, c.bonus)],
    ['Komisyonun', eur(c.fee), delta(m.fee, c.fee)],
  ];
  return html`<section class="tcounter" aria-label="Onun teklifi">
    <header><span class="eyebrow">Onun teklifi</span><${Badge} tone=${counter.clientOk ? 'lime' : counter.clientLean ? 'gold' : 'danger'}>Oyuncu: ${word}</${Badge}></header>
    <div class="tcounter__grid">${items.map(([k, v, d]) => html`<div><span>${k}</span><b class="num">${v}</b>${d}</div>`)}</div>
    ${c.clauses && (c.clauses.minutes || c.clauses.release) ? html`<p class="tcounter__cl small muted">${[c.clauses.minutes ? 'Forma garantisi' : null, c.clauses.release ? 'Serbest kalma maddesi' : null].filter(Boolean).join(' · ')}</p>` : null}
    <div class="tcounter__cost"><span>Kulübe maliyet</span><b class="num">${eur(counter.cost)}</b></div>
    <p class="tcounter__txt small">${bad ? 'Oyuncu bu paketi kabul etmez; sadece üzerine çalışabilirsin.' : counter.clientLean ? 'Oyuncu tereddüt eder; kabul edersen onu ikna etmen gerekir (bağlılık −8).' : 'Oyuncu bu paketle razı. Tek bir dokunuşla bağlayabilirsin.'}</p>
    <div class="tcounter__act">
      <${Button} variant="gold" size="sm" disabled=${busy || bad} onClick=${onAccept}>Kabul et</${Button}>
      <${Button} variant="ghost" size="sm" disabled=${busy} onClick=${onWork}>Bunun üzerine çalış</${Button}>
    </div>
  </section>`;
}

export function RoundLog({ log, hand, open, onToggle }) {
  const rows = (log || []).filter((l) => l.outcome !== 'accepted');
  if (!rows.length) return null;
  const kozName = (id) => { const k = (hand || []).find((h) => h.id === id); return k ? k.label : id; };
  return html`<section class="tlog">
    <button type="button" class="tlog__tog" aria-expanded=${open ? 'true' : 'false'} onClick=${onToggle}><span class="eyebrow">Tur günlüğü (${rows.length})</span><${Icon} name=${open ? 'chevronUp' : 'chevronDown'} size=${18} /></button>
    ${open ? html`<ol class="tlog__list">${[...rows].reverse().map((l) => html`<li><b class="num">Tur ${l.round}</b><span class="num">${eur(l.cost)}</span>
      ${l.koz ? html`<${Badge} tone="info" icon="star">${kozName(l.koz)}</${Badge}>` : null}
      ${l.tell != null ? html`<em class=${cx('tlog__tell', `is-${TELL_TONE[l.tell]}`)}>${TELL_WORDS[l.tell]}</em>` : l.outcome === 'counterAccepted' ? html`<em class="tlog__tell is-lime">Karşı teklif kabul</em>` : l.outcome === 'left' ? html`<em class="tlog__tell is-danger">Masadan kalktı</em>` : null}</li>`)}</ol>` : null}
  </section>`;
}
