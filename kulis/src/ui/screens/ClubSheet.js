import { html, useState, useStore, store, cx, Sheet, Crest, PosChip, Badge, Meter, Button, Icon, SectionTitle, Avatar, openSheet, audio, haptics, toast, fmtMoney } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';
import { PERSONAS, needWord, trustWord, clubInfo } from './players/common.js';

function Trust({ cv }) {
  const t = cv.trust;
  return html`<section class="club-sec">
    <${SectionTitle}>Güven</${SectionTitle}>
    <div class="club-card">
      <${Meter} value=${t} threshold=${60} thresholdLabel="Dostluk" label=${trustWord(t)} valueText=${String(Math.round(t))} tone=${t >= 60 ? 'lime' : 'gold'} />
      <ul class="club-unlocks">
        <li class=${t >= 60 ? 'is-on' : ''}><${Icon} name=${t >= 60 ? 'check' : 'lock'} size=${14} /><span><b>Dostluk kozu</b> (güven ≥ 60): masada tavan aralığını görürsün ve sabır +1 kazanırsın. Kurnaz direktörün mimikleri de dürüstleşir.</span></li>
      </ul>
      <p class="muted small">Yemek, başarılı transferler ve tutulan sözler güveni artırır; masadan öfkeyle kalkan direktör güveni düşürür.</p>
    </div>
  </section>`;
}

function Lunch({ S, cv, fresh, setFresh }) {
  const L = cv.lunch;
  const go = () => {
    const r = store.act('clubLunch', { clubId: cv.id });
    if (!r || r.ok === false) return;
    audio.play('coin'); haptics.success();
    const ev = (r.events || [])[0] || {};
    toast.success(`Yemek güzel geçti: güven +${ev.gain ?? L.gain}`, { icon: 'handshake' });
    setFresh(true);
  };
  const budget = cv.budgetHint;
  return html`<section class="club-sec">
    <${SectionTitle}>Direktör</${SectionTitle}>
    <div class=${cx('club-card club-dir', fresh && 'is-fresh')}>
      <div class="club-dir__head"><${Avatar} id=${'dir:' + cv.id} size=${48} colors=${cv.colors} /><div class="grow"><b class="club-dir__name">${cv.director.name}</b><div class="muted small">Sportif direktör</div></div>
        ${cv.lunchKnown && cv.director.personaLabel ? html`<${Badge} tone="info">${cv.director.personaLabel}</${Badge}>` : null}</div>
      ${cv.lunchKnown ? html`<div class="club-reveal">
        ${cv.director.persona ? html`<p class="club-persona">${PERSONAS[cv.director.persona] || ''}</p>` : null}
        <div class="club-facts">
          <div><span>Bütçe tahmini</span><b class="num gold">${budget ? `${fmtMoney(budget.lo)} – ${fmtMoney(budget.hi)}` : '—'}</b></div>
          <div><span>İhtiyaçlar</span>${cv.needs && cv.needs.length ? html`<div class="club-needs">${cv.needs.map((n) => html`<span class=${cx('club-need', 'lv' + n.level)}><${PosChip} pos=${n.pos} />${needWord(n.level)}</span>`)}</div>` : html`<b class="muted">Kadro dengeli</b>`}</div>
        </div>
        <p class="muted small">Bu bilgiler Temmuz'da sıfırlanır; her sezon yeniden yemeğe çıkman gerekir.</p>
      </div>` : html`<div class="club-locked"><${Icon} name="lock" size=${22} /><div><b>Yemek yemeden bilemezsin.</b><p class="muted small">İhtiyaçlar, direktörün kişiliği ve bütçe tahmini yemekte ortaya çıkar.</p></div></div>`}
      <${Button} block variant=${cv.lunchKnown ? 'ghost' : 'primary'} icon="handshake" energy=${1} cash=${L.cash} onClick=${go}>${cv.lunchKnown ? 'Tekrar yemeğe çık' : 'Yemeğe çık'} · güven +${L.gain}</${Button}>
    </div>
  </section>`;
}

function Mine({ S, cv }) {
  if (!cv.yourClients.length) return null;
  return html`<section class="club-sec"><${SectionTitle} right=${cv.yourClients.length}>Müvekkillerin</${SectionTitle}>
    ${cv.yourClients.map((id) => { const p = S.players[id]; return html`<button type="button" class="club-row club-row--mine" onClick=${() => openSheet('PlayerSheet', { playerId: id })}>
      <${Avatar} id=${id} size=${40} colors=${cv.colors} ring /><span class="club-row__main"><b>${p.name}</b><em>${p.age} yaş · Güç ${p.ca}</em></span><${PosChip} pos=${p.pos} /><${Icon} name="chevronRight" size=${16} /></button>`; })}
  </section>`;
}

function Squad({ cv }) {
  const [all, setAll] = useState(false);
  const rows = cv.squad.slice().sort((a, b) => b.ca - a.ca);
  const show = all ? rows : rows.slice(0, 11);
  return html`<section class="club-sec"><${SectionTitle} right=${`${rows.length} oyuncu`}>Kadro</${SectionTitle}>
    <div class="club-squad">${show.map((p) => html`<button type="button" class=${cx('club-prow', p.mine && 'is-mine')} onClick=${() => openSheet('PlayerSheet', { playerId: p.id })}>
      <${PosChip} pos=${p.pos} /><span class="club-prow__name">${p.name}${p.injured > 0 ? html` <${Badge} tone="danger">Sakat</${Badge}>` : null}${p.mine ? html` <${Badge} tone="lime">Senin</${Badge}>` : null}</span><em class="num">${p.age}</em><b class="num">${p.ca}</b></button>`)}</div>
    ${rows.length > 11 ? html`<${Button} variant="ghost" block onClick=${() => setAll(!all)}>${all ? 'Daha az göster' : `Tümünü göster (${rows.length})`}</${Button}>` : null}
  </section>`;
}

function MiniTable({ S, cv }) {
  const t = sel.tableSorted(S, cv.leagueId);
  const i = t.findIndex((r) => r.clubId === cv.id);
  const from = Math.max(0, Math.min(t.length - 5, i - 2));
  const rows = t.slice(from, from + 5);
  return html`<section class="club-sec"><${SectionTitle}>${cv.leagueName}</${SectionTitle}>
    <div class="club-table" role="table"><div class="club-table__h" role="row"><span></span><span></span><span>Takım</span><span>O</span><span>AV</span><span>P</span></div>
      ${rows.map((r, k) => { const c = S.clubs[r.clubId]; return html`<div class=${cx('club-table__r', r.clubId === cv.id && 'is-me')} role="row">
        <b class="num">${from + k + 1}</b><${Crest} colors=${c.colors} pattern=${c.crest} size=${14} /><span class="club-table__n">${c.name}</span><span class="num">${r.p}</span><span class="num">${r.gd > 0 ? '+' : ''}${r.gd}</span><b class="num">${r.pts}</b></div>`; })}
    </div>
  </section>`;
}

export default function ClubSheet({ close, clubId }) {
  const S = useStore((s) => s.S);
  const [fresh, setFresh] = useState(false);
  const cv = S && S.clubs[clubId] ? sel.clubView(S, clubId) : null;
  if (!cv) return html`<${Sheet} title="Kulüp" onClose=${close}><div class="psheet-empty">Kulüp bulunamadı.</div></${Sheet}>`;
  const pos = cv.position;
  const ints = (cv.interests || []);
  return html`<${Sheet} title=${cv.short} tall onClose=${close} class="club-sheet">
    <div class="club">
      <section class="club-head" style=${{ '--k1': cv.colors[0], '--k2': cv.colors[1] }}>
        <${Crest} colors=${cv.colors} pattern=${cv.crest} size=${64} />
        <div class="grow">
          <h2 class="club-head__name">${cv.name}</h2>
          <div class="muted">${cv.leagueName} · <b class="lime num">${pos}. sıra</b> · <span class="num">${cv.table.pts} puan</span></div>
          <div class="club-head__tags"><${Badge} tone="muted" icon="building">Tesis ${cv.facilities}</${Badge}><${Badge} tone="muted" icon="users">Genç güveni ${cv.youthTrust}</${Badge}>${cv.champions ? html`<${Badge} tone="gold" icon="trophy">${cv.champions} şampiyonluk</${Badge}>` : null}</div>
        </div>
      </section>
      <${Trust} cv=${cv} />
      <${Lunch} S=${S} cv=${cv} fresh=${fresh} setFresh=${setFresh} />
      <${Mine} S=${S} cv=${cv} />
      ${ints.length ? html`<section class="club-sec"><${SectionTitle}>İlgi</${SectionTitle}>${ints.map((i) => html`<div class="club-int"><span>${S.players[i.playerId] ? S.players[i.playerId].name : ''}</span><${Meter} value=${i.level} size="sm" threshold=${60} tone=${i.level >= 60 ? 'lime' : 'gold'} /></div>`)}</section>` : null}
      <${MiniTable} S=${S} cv=${cv} />
      <${Squad} cv=${cv} />
    </div>
  </${Sheet}>`;
}
