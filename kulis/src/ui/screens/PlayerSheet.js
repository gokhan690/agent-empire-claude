import { html, useState, useStore, store, cx, Sheet, Avatar, PosChip, Badge, Meter, PotentialBand, Button, Icon, SectionTitle, Money, MONTH_NAMES,
  openSheet, openOverlay, audio, haptics, toast } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';
import { TRAITS, KIND_LABEL, pct, moodTone, moodWord, minutesWord, clubInfo, bandFor, moodReasons, dueText, monthsLeft, monthsText, heatMonths, ClubTag } from './players/common.js';
import { useRecruit, RecruitBody, RecruitFooter, SignedMoment } from './players/Recruit.js';
import { usePitch, PitchBody, PitchFooter } from './players/ClubPicker.js';

const ACT_ICON = { visitClient: 'handshake', mediaPush: 'news', releaseClient: 'close', watchPlayer: 'eye', recruit: 'pen', toggleShortlist: 'star', pitch: 'swap' };

/** One view-model for clients, prospects and plain players (only fields API.md §9 allows). */
function buildVM(S, id) {
  const p = S.players[id];
  if (!p) return null;
  const cv = sel.clientView(S, id);
  const row = cv ? null : sel.prospectList(S, {}).find((x) => x.id === id) || null;
  const club = clubInfo(S, p.clubId);
  const lg = club ? S.leagues[club.leagueId] : null;
  const src = cv || row || {};
  const known = cv ? cv.know : p.know;
  return {
    id, p, cv, row, club, lg, name: p.name, age: p.age, nat: p.nat, pos: p.pos, ca: p.ca, form: p.form,
    value: p.value, wage: cv ? cv.wage : p.wage, contractEnd: p.contractEnd, hype: p.hype, injured: p.injured,
    band: cv ? cv.band : row ? row.band : bandFor(S, p), know: known ?? 0,
    traitLabel: cv ? cv.traitLabel : row ? row.traitLabel : null, trait: cv ? cv.trait : row ? row.trait : null,
    dream: cv ? (cv.dream && cv.dream.known ? cv.dream : null) : row ? row.dream : null,
    st: p.st, career: cv ? cv.career : null, src,
  };
}

function Stat3({ label, children, tone }) { return html`<div class=${cx('psheet-stat', tone && `psheet-stat--${tone}`)}><span>${label}</span><b class="num">${children}</b></div>`; }

function Header({ vm }) {
  const { cv, row, club, lg } = vm;
  const open = () => club && openSheet('ClubSheet', { clubId: club.id });
  const free = !vm.p.clubId;
  const left = vm.contractEnd - 0;
  return html`<section class="psheet-head">
    <div class="psheet-head__top">
      <${Avatar} id=${vm.id} size=${76} colors=${club && club.colors} ring=${!!cv} />
      <div class="psheet-head__id">
        <h2 class="psheet-head__name">${vm.name}</h2>
        <div class="psheet-head__meta"><${PosChip} pos=${vm.pos} /><span>${vm.age} yaş</span><span>${vm.nat}</span></div>
        <${ClubTag} club=${club} onClick=${club ? open : null} size=${16} />
        ${lg ? html`<div class="muted small">${lg.name} · ${lg.country}</div>` : null}
      </div>
      <div class="psheet-head__ca"><b class="num">${vm.ca}</b><small>GÜÇ</small></div>
    </div>
    <div class="psheet-badges">
      ${cv ? html`<${Badge} tone="lime" icon="check">Müvekkilin</${Badge}>` : null}
      ${vm.injured > 0 ? html`<${Badge} tone="danger" icon="alert">Sakat · ${vm.injured} ay</${Badge}>` : null}
      ${free ? html`<${Badge} tone="gold" icon="swap">Kulüpsüz</${Badge}>` : null}
      ${cv && cv.flags.expiring && !free ? html`<${Badge} tone="gold" icon="clock">Sözleşme bitiyor</${Badge}>` : null}
      ${cv && cv.preContract ? html`<${Badge} tone="info" icon="pen">Ön sözleşme</${Badge}>` : null}
      ${row && row.rival ? html`<${Badge} tone="rival" icon="shield">Rakip: ${row.rival.agency}</${Badge}>` : null}
      ${row && row.shortlisted ? html`<${Badge} tone="gold" icon="star">Takipte</${Badge}>` : null}
    </div>
    <div class="psheet-stats">
      <${Stat3} label="Değer" tone="gold"><${Money} value=${vm.value} /></${Stat3}>
      <${Stat3} label="Maaş / ay"><${Money} value=${vm.wage} /></${Stat3}>
      <${Stat3} label="Sözleşme">${vm.contractEnd}. sezon</${Stat3}>
      <${Stat3} label="Form" tone=${vm.form > 2 ? 'lime' : vm.form < -2 ? 'danger' : null}>${vm.form > 0 ? '+' : ''}${vm.form}</${Stat3}>
    </div>
  </section>`;
}

function Talent({ vm }) {
  const { band, know } = vm;
  const wide = band.hi - band.lo;
  return html`<section class="psheet-sec">
    <${SectionTitle}>Yetenek</${SectionTitle}>
    <div class="psheet-card">
      <${PotentialBand} ca=${vm.ca} lo=${band.lo} hi=${band.hi} know=${know} />
      <div class="psheet-know"><${Meter} value=${know} tone="info" size="sm" label="Bildiğin" valueText=${'%' + Math.round(know)} /></div>
      <p class="psheet-note">
        <b>Bildiğin: %${Math.round(know)}</b> — izledikçe daralır. Gerçek tavan bu aralığın <i>içinde</i>, ama ortada olmak zorunda değil.
        ${wide >= 12 ? ' Aralık hâlâ geniş: büyük bir sürpriz de büyük bir hayal kırıklığı da olabilir.' : wide <= 4 ? ' Neredeyse kesin biliyorsun.' : ''}
      </p>
    </div>
  </section>`;
}

function Character({ vm }) {
  const t = vm.trait && TRAITS[vm.trait];
  return html`<section class="psheet-sec">
    <${SectionTitle}>Karakter</${SectionTitle}>
    <div class="grid-2 psheet-char">
      <div class=${cx('psheet-card', !t && 'is-hidden')}>
        <div class="eyebrow">Huy</div>
        ${t ? html`<b class="psheet-char__v">${t[0]}</b><p class="muted small">${t[1]}</p>`
          : html`<b class="psheet-char__v muted"><${Icon} name="lock" size=${16} /> Henüz bilinmiyor</b><p class="muted small">Bilgin %60'a çıkınca açılır — oyuncuyu İzle.</p>`}
      </div>
      <div class=${cx('psheet-card', !vm.dream && 'is-hidden')}>
        <div class="eyebrow">Hayal</div>
        ${vm.dream ? html`<b class="psheet-char__v">${vm.dream.label || 'Hayal'}</b><p class="muted small">${vm.dream.text || ''}${vm.dream.done ? ' (gerçekleşti)' : ''}</p>`
          : html`<b class="psheet-char__v muted"><${Icon} name="lock" size=${16} /> Henüz bilinmiyor</b><p class="muted small">${vm.cv ? 'Ziyaret edince anlatır.' : "Bilgin %85'e çıkınca açılır."}</p>`}
      </div>
    </div>
  </section>`;
}

function Mood({ S, vm }) {
  const { cv } = vm;
  const reasons = moodReasons(S, cv);
  const bad = reasons.filter((r) => r.tone === 'bad'), good = reasons.filter((r) => r.tone === 'good');
  return html`<section class="psheet-sec">
    <${SectionTitle}>Moral ve bağlılık</${SectionTitle}>
    <div class="psheet-card">
      <div class="grid-2">
        <${Meter} label="Moral" value=${cv.morale} tone=${moodTone(cv.morale)} valueText=${cv.moraleWord || moodWord(cv.morale)} />
        <${Meter} label="Bağlılık" value=${cv.loyalty} tone=${moodTone(cv.loyalty)} valueText=${cv.loyaltyWord || moodWord(cv.loyalty)} />
      </div>
      ${cv.loyalty < 35 ? html`<div class="psheet-alert"><${Icon} name="flame" size=${16} /> Bağlılığı 35'in altında: rakip ajanslar onu kapabilir. Ziyaret et ya da söz tut.</div>` : null}
      <ul class="psheet-reasons">${[...bad, ...good].map((r) => html`<li class=${r.tone}><${Icon} name=${r.tone === 'bad' ? 'arrowDown' : 'arrowUp'} size=${13} strokeWidth=${2.6} />${r.text}</li>`)}</ul>
    </div>
  </section>`;
}

function Promises({ S, vm }) {
  const open = vm.cv.promises.filter((p) => p.status === 'open');
  const hist = (S.promises || []).filter((p) => p.playerId === vm.id && p.status !== 'open').slice(-6).reverse();
  return html`<section class="psheet-sec">
    <${SectionTitle} right=${open.length ? `${open.length} açık` : null}>Verdiğin sözler</${SectionTitle}>
    ${!open.length && !hist.length ? html`<div class="psheet-empty">Henüz söz yok. İmza sırasında söz vermek puanı artırır ama bağlayıcıdır.</div>` : null}
    ${open.map((p) => {
      const ml = monthsLeft(S, p), pr = p.progress || { value: 0, target: 1, text: '' };
      const ratio = pr.target ? Math.min(1, pr.value / pr.target) : 0;
      return html`<div class=${cx('psheet-prom', ml <= 1 && 'is-soon')}>
        <div class="psheet-prom__top"><${Icon} name="handshake" size=${16} /><span class="psheet-prom__text">${p.text}</span></div>
        <${Meter} value=${ratio * 100} size="sm" tone=${ratio >= 1 ? 'lime' : ml <= 2 ? 'gold' : 'info'} />
        <div class="psheet-prom__foot"><span>${pr.text}</span><span class=${ml <= 1 ? 'danger' : ml <= 3 ? 'gold' : 'muted'}>${dueText(p)} · ${monthsText(ml)}</span></div>
      </div>`;
    })}
    ${hist.length ? html`<div class="psheet-hist">${hist.map((p) => html`<div class=${cx('psheet-hist__row', p.status)}><${Icon} name=${p.status === 'kept' ? 'check' : 'close'} size=${14} strokeWidth=${2.6} /><span>${p.text}</span><b>${p.status === 'kept' ? 'Tutuldu' : 'Bozuldu'}</b></div>`)}</div>` : null}
  </section>`;
}

function Suitors({ S, vm, close }) {
  const list = sel.interestList(S, vm.id).slice().sort((a, b) => b.level - a.level);
  const sit = (i) => {
    const r = store.act('openNegotiation', { interestId: i.id });
    if (r && r.ok) { store.ui.closeAllSheets(); openOverlay('Negotiation', {}); }
  };
  return html`<section class="psheet-sec">
    <${SectionTitle} right=${list.length ? `${list.length} kulüp` : null}>Talipler</${SectionTitle}>
    ${!list.length ? html`<div class="psheet-empty">Şu an ilgilenen kulüp yok. Kulüplere öner, yemeğe çık, medyaya çıkar — ilgi böyle doğar.</div>` : null}
    ${list.map((i) => {
      const club = clubInfo(S, i.clubId);
      return html`<div class=${cx('psheet-suit', i.negotiable && 'is-open')}>
        <div class="psheet-suit__top">
          <${ClubTag} club=${club} onClick=${() => openSheet('ClubSheet', { clubId: i.clubId })} size=${20} />
          <${Badge} tone=${i.kind === 'transfer' ? 'info' : 'gold'}>${KIND_LABEL[i.kind] || i.kind}</${Badge}>
        </div>
        <${Meter} value=${i.level} threshold=${60} thresholdLabel="Masa" size="sm" tone=${i.level >= 60 ? 'lime' : 'gold'} label="İlgi" valueText=${'%' + i.level} />
        <div class="psheet-suit__fit">
          <span class=${cx('psheet-fit', i.fitSat < 40 ? 'is-bad' : i.fitSat >= 55 ? 'is-good' : '')}>${i.fitWord}</span>
          <span class="muted">Beklenen süre ${pct(i.expectedMinutes)}</span>
          ${i.cooldown ? html`<span class="danger">Soğuma ${i.cooldown} ay</span>` : null}
        </div>
        ${i.negotiable ? html`<${Button} block variant="gold" icon="handshake" energy=${1} onClick=${() => sit(i)}>Masaya otur</${Button}>` : html`<div class="psheet-suit__why"><${Icon} name="lock" size=${13} /> ${i.reason}</div>`}
      </div>`;
    })}
  </section>`;
}

function Contract({ vm }) {
  const { cv } = vm;
  return html`<section class="psheet-sec">
    <${SectionTitle}>Temsil sözleşmesi</${SectionTitle}>
    <div class="psheet-card psheet-contract">
      <div><span>Komisyon</span><b class="num">%${cv.rep.commissionPct}</b></div>
      <div><span>Bitiş</span><b class="num">${cv.rep.endSeason}. sezon</b></div>
      <div><span>Kulüp sözleşmesi</span><b class="num">${cv.contractEnd}. sezon</b></div>
    </div>
    <p class="muted small">Temsil sözleşmesi bitince bağlılığı 55 ve üstündeyse otomatik yenilenir; değilse karşına bir karar çıkar.</p>
  </section>`;
}

function Season({ vm }) {
  const st = vm.st, avg = st.apps ? Math.round((st.ratingSum / st.apps) * 10) / 10 : 0;
  const last = (st.last || []).slice(-8);
  return html`<section class="psheet-sec">
    <${SectionTitle}>Sezon</${SectionTitle}>
    <div class="psheet-card">
      <div class="psheet-season">
        <div><b class="num">${st.apps}</b><span>Maç</span></div><div><b class="num">${st.goals}</b><span>Gol</span></div>
        <div><b class="num">${st.assists}</b><span>Asist</span></div><div><b class="num">${avg ? avg.toFixed(1).replace('.', ',') : '—'}</b><span>Puan</span></div>
      </div>
      ${last.length ? html`<div class="psheet-last"><span class="eyebrow">Son maçlar</span><div>${last.map((r) => html`<i class=${cx('num', r >= 7.5 ? 'hi' : r < 6 ? 'lo' : '')}>${Number(r).toFixed(1).replace('.', ',')}</i>`)}</div></div>` : html`<p class="muted small">Bu sezon henüz maç yok.</p>`}
      ${vm.career && vm.career.length ? html`<div class="psheet-career"><span class="eyebrow">Kariyer</span>${vm.career.slice().reverse().map((c) => html`<div class="psheet-career__row"><b class="num">S${c.season}</b><span>${c.clubId && vm.p ? (clubName(c.clubId)) : ''}</span><em>${c.apps} maç · ${c.goals} gol</em><i class="num">${c.avg ? c.avg.toFixed(1).replace('.', ',') : '—'}</i></div>`)}</div>` : null}
    </div>
  </section>`;
}
let _S = null;
const clubName = (id) => (_S && _S.clubs[id] ? _S.clubs[id].name : '—');

function Heat({ vm }) {
  const r = vm.row;
  if (!r) return null;
  const ml = heatMonths(r.heat, r.heatPerMonth);
  return html`<section class="psheet-sec">
    <${SectionTitle}>Rakipler</${SectionTitle}>
    <div class="psheet-card">
      <${Meter} value=${r.heat} tone=${ml <= 2 ? 'danger' : ml <= 5 ? 'gold' : 'info'} label="Rakip ısısı" valueText=${'%' + Math.round(r.heat)} size="md" />
      <p class="psheet-note">${r.rival ? `${r.rival.agency} zaten temsil ediyor.` : r.heat <= 0 ? 'Rakip ajanslar henüz fark etmedi.' : `Rakip ajanslar ısınıyor — yaklaşık ${ml} ay sonra biri kapabilir.`} Isı ayda ~${Math.round(r.heatPerMonth)} puan artıyor.</p>
    </div>
  </section>`;
}

function ActionBar({ S, vm, onRecruit, onPitch, onRelease, onQuote }) {
  const acts = sel.availableActions(S, { playerId: vm.id }).filter((a) => a.id !== 'releaseClient');
  const hasRecruit = acts.find((a) => a.id === 'recruit');
  const items = acts.filter((a) => a.id !== 'recruit');
  if (vm.cv) items.splice(items.findIndex((a) => a.id === 'mediaPush') + 1 || items.length, 0, { id: 'pitch', label: 'Kulübe öner', cost: { energy: 1, cash: 0 }, ok: S.agency.energy >= 1, reason: S.agency.energy >= 1 ? null : 'Enerjin yok' });
  const run = (a) => {
    if (a.id === 'pitch') return onPitch();
    const r = store.act(a.id, a.payload);
    if (!r || r.ok === false) return;
    const ev = (r.events || [])[0] || {};
    if (a.id === 'visitClient') { audio.play('confirm'); haptics.success(); onQuote(r.line || 'Görüşmen iyi geçti.'); toast.success('Moral ve bağlılık arttı', { icon: 'heart' }); }
    else if (a.id === 'mediaPush') { audio.play('coin'); toast.success(`Basın çalışması: şöhret +${ev.hype ?? 15}`, { icon: 'news' }); }
    else if (a.id === 'watchPlayer') {
      audio.play(ev.traitRevealed ? 'levelup' : 'confirm');
      toast.success(`Bilgin %${Math.round(ev.know)} oldu${ev.traitRevealed ? ' — huyunu öğrendin' : ''}`, { icon: 'eye' });
    } else if (a.id === 'toggleShortlist') toast.info(ev.on ? 'Takip listene eklendi' : 'Takipten çıkarıldı', { icon: 'star' });
  };
  return html`<section class="psheet-sec">
    <${SectionTitle}>Hamleler</${SectionTitle}>
    ${hasRecruit ? html`<div class="psheet-act psheet-act--main"><${Button} variant="gold" size="lg" block icon="pen" energy=${1} disabled=${!hasRecruit.ok} onClick=${onRecruit}>İmza teklifi</${Button}>
      ${hasRecruit.ok ? html`<small class="muted">İkna puanın: <b class="num">${hasRecruit.score}</b> / eşik <b class="num">${hasRecruit.threshold}</b></small>` : html`<small class="danger">${hasRecruit.reason}</small>`}</div>` : null}
    <div class="psheet-acts">
      ${items.map((a) => html`<div class="psheet-act">
        <${Button} variant="ghost" block energy=${a.cost && a.cost.energy ? a.cost.energy : undefined} cash=${a.cost && a.cost.cash ? a.cost.cash : undefined} disabled=${!a.ok}
          onClick=${() => run(a)}>${a.id === 'toggleShortlist' ? (vm.row && vm.row.shortlisted ? 'Takipten çık' : 'Listeye al') : a.id === 'watchPlayer' ? 'İzle' : a.id === 'mediaPush' ? 'Medyaya çık' : a.label}</${Button}>
        ${!a.ok && a.reason ? html`<small class="muted">${a.reason}</small>` : null}
      </div>`)}
    </div>
    ${vm.cv ? html`<button type="button" class="psheet-release" onClick=${onRelease}>Yolları ayır…</button>` : null}
  </section>`;
}

export default function PlayerSheet({ close, playerId, recruit }) {
  const S = useStore((s) => s.S);
  _S = S;
  const [mode, setMode] = useState(recruit ? 'recruit' : 'main');
  const [quote, setQuote] = useState(null);
  const [signed, setSigned] = useState(null);
  const [confirmRel, setConfirmRel] = useState(false);
  const vm = S && buildVM(S, playerId);
  const rec = useRecruit(playerId, mode === 'recruit', (ev) => { setSigned({ ev, chosen: rec.chosen, pv: rec.pv, vm }); setMode('signed'); });
  const pitch = usePitch(S || { players: {}, leagues: {}, clubs: {} }, playerId, mode === 'pitch', () => setMode('main'));
  if (!vm) return html`<${Sheet} title="Oyuncu" onClose=${close}><div class="psheet-empty">Oyuncu bulunamadı.</div></${Sheet}>`;

  const release = () => { const r = store.act('releaseClient', { playerId }); if (r && r.ok) { audio.play('badnews'); toast.info(`${vm.name} ile yollar ayrıldı`); close(); } };

  let body, footer, title = vm.name;
  if (mode === 'recruit') { title = 'İmza teklifi'; body = html`<${RecruitBody} rec=${rec} vm=${vm} />`; footer = html`<${RecruitFooter} rec=${rec} onBack=${() => setMode('main')} />`; }
  else if (mode === 'pitch') { title = 'Kulübe öner'; body = html`<${PitchBody} S=${S} pitch=${pitch} vm=${vm} />`; footer = html`<${PitchFooter} S=${S} pitch=${pitch} onBack=${() => setMode('main')} />`; }
  else if (mode === 'signed' && signed) { title = 'Yeni müvekkil'; body = html`<${SignedMoment} ev=${signed.ev} vm=${signed.vm} chosen=${signed.chosen} pv=${signed.pv} onOpen=${() => setMode('main')} />`; }
  else {
    body = html`<div class="psheet">
      <${Header} vm=${vm} />
      ${quote ? html`<blockquote class="psheet-quote"><${Icon} name="phone" size=${18} /><p>“${quote}”</p><footer>— ${vm.name}</footer></blockquote>` : null}
      <${ActionBar} S=${S} vm=${vm} onRecruit=${() => setMode('recruit')} onPitch=${() => setMode('pitch')} onRelease=${() => setConfirmRel(true)} onQuote=${setQuote} />
      ${confirmRel ? html`<div class="psheet-confirm"><b>${vm.name} ile yolları ayırmak istediğine emin misin?</b><p class="muted small">Geri alınamaz; verdiğin sözler boşa düşer.</p>
        <div class="row"><${Button} variant="ghost" onClick=${() => setConfirmRel(false)}>Vazgeç</${Button}><${Button} variant="danger" class="grow" onClick=${release}>Evet, ayrıl</${Button}></div></div>` : null}
      ${vm.cv ? html`<${Mood} S=${S} vm=${vm} /><${Promises} S=${S} vm=${vm} /><${Suitors} S=${S} vm=${vm} close=${close} />` : html`<${Talent} vm=${vm} /><${Heat} vm=${vm} />`}
      ${vm.cv ? html`<${Talent} vm=${vm} />` : null}
      <${Character} vm=${vm} />
      ${vm.cv ? html`<${Contract} vm=${vm} />` : null}
      <${Season} vm=${vm} />
    </div>`;
  }
  return html`<${Sheet} title=${title} tall onClose=${close} footer=${footer} class="psheet-sheet">${body}</${Sheet}>`;
}
