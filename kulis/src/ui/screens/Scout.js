import { html, useState, useEffect, useRef, useStore, store, cx, Avatar, Crest, PosChip, Badge, Chip, Meter, PotentialBand, Tabs, Button, Icon, SectionTitle, EmptyState, Card,
  openSheet, navigate, audio, haptics, toast, fmtMoney } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';
import { FOCUS, Stars, heatMonths, clubInfo, bandFor } from './players/common.js';

let lastTab = 'trip';

/* ---------- shared prospect bits ---------- */
function HeatBar({ r }) {
  if (r.rival) return html`<div class="scout-heat is-rival"><${Icon} name="shield" size=${14} /><span>${r.rival.agency} temsil ediyor</span></div>`;
  const ml = heatMonths(r.heat, r.heatPerMonth);
  const tone = r.heat >= 100 ? 'danger' : ml <= 2 ? 'danger' : ml <= 5 ? 'gold' : 'info';
  const txt = r.heat <= 0 ? 'Rakipler henüz bakmıyor' : ml <= 1 ? 'Bu ay rakip kapabilir!' : `~${ml} ay sonra rakip kapar`;
  return html`<div class=${cx('scout-heat', 'is-' + tone)}>
    <${Icon} name="flame" size=${15} /><div class="grow"><${Meter} value=${r.heat} size="sm" tone=${tone} label="Isı" /></div><span class="scout-heat__txt">${txt}</span></div>`;
}
const signHint = (r) => (r.canSign ? html`<${Badge} tone="lime" icon="check">İmzalanabilir</${Badge}>` : r.gap <= 15 ? html`<${Badge} tone="gold" icon="pen">${r.gap} puan eksik</${Badge}>` : html`<${Badge} tone="muted" icon="lock">${r.gap} puan eksik</${Badge}>`);

/* ---------- trip reveal ---------- */
function FlipCard({ r, delay, S }) {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => { setUp(true); audio.play(r.ca >= 70 || r.band.hi >= 85 ? 'levelup' : 'tick'); haptics.tap(); }, delay);
    return () => clearTimeout(t);
  }, []);
  const club = r.clubId ? clubInfo(S, r.clubId) : null;
  return html`<div class=${cx('scout-flip', up && 'is-up')}>
    <div class="scout-flip__in">
      <div class="scout-flip__back" aria-hidden="true"><span>?</span></div>
      <button type="button" class="scout-flip__front" tabindex=${up ? 0 : -1} onClick=${() => openSheet('PlayerSheet', { playerId: r.id })}>
        <div class="scout-flip__top"><${Avatar} id=${r.id} size=${52} colors=${club && club.colors} />
          <div class="grow"><b class="scout-flip__name">${r.name}</b><div class="scout-flip__meta"><${PosChip} pos=${r.pos} /><span>${r.age} yaş</span></div></div>
          <div class="scout-ca"><b class="num">${r.ca}</b><small>GÜÇ</small></div></div>
        <${PotentialBand} ca=${r.ca} lo=${r.band.lo} hi=${r.band.hi} compact />
        <div class="scout-flip__club">${club ? html`<${Crest} colors=${club.colors} pattern=${club.crest} size=${13} /><span>${club.name}</span>` : html`<span>Kulüpsüz</span>`}</div>
        <div class="scout-flip__foot"><span class="scout-flip__heat"><${Icon} name="flame" size=${13} />${Math.round(r.heat)}</span>${signHint(r)}</div>
      </button>
    </div>
  </div>`;
}
function Reveal({ S, ids, onClose }) {
  const all = sel.prospectList(S, {});
  const rows = ids.map((id) => all.find((x) => x.id === id) || basicRow(S, id)).filter(Boolean);
  return html`<section class="scout-reveal">
    <div class="scout-reveal__head"><div><div class="eyebrow gold">Gezi raporu</div><h3 class="t-display">${rows.length} yeni yetenek</h3></div>
      <button type="button" class="iconbtn" aria-label="Raporu kapat" onClick=${onClose}><${Icon} name="close" size=${20} /></button></div>
    <div class="scout-reveal__grid">${rows.map((r, i) => html`<${FlipCard} key=${r.id} r=${r} S=${S} delay=${500 + i * 650} />`)}</div>
    <p class="muted small">Hepsi Radarım'a eklendi. Isısı en yüksek olanı önce izle; rakipler de bakıyor.</p>
  </section>`;
}
function basicRow(S, id) {
  const p = S.players[id]; if (!p) return null;
  return { id, name: p.name, age: p.age, pos: p.pos, ca: p.ca, clubId: p.clubId, band: bandFor(S, p), heat: p.heat || 0, heatPerMonth: 0, canSign: false, gap: 0, rival: null };
}

/* ---------- trip planner ---------- */
function Trip({ S }) {
  const [focus, setFocus] = useState('u21');
  const [lg, setLg] = useState(null);
  const [pv, setPv] = useState({});
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState(null);
  const acts = sel.availableActions(S, {}).filter((a) => a.id === 'scoutTrip');
  const leagueIds = acts.map((a) => a.payload.leagueId);
  const key = leagueIds.join() + focus;
  useEffect(() => {
    const out = {};
    for (const id of leagueIds) { const r = store.act('tripPreview', { leagueId: id, focus }); out[id] = r && r.ok ? r.preview : null; }
    setPv(out);
  }, [key]);
  const sel1 = acts.find((a) => a.payload.leagueId === lg);
  const go = () => {
    if (!sel1 || busy) return;
    setBusy(true); audio.play('whoosh');
    const r = store.act('scoutTrip', { leagueId: lg, focus });
    setBusy(false);
    if (!r || r.ok === false) return;
    haptics.success();
    setFound({ ids: r.prospects || [], k: Math.random() });
    setTimeout(() => { const el = document.querySelector('.scout-reveal'); el && el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
  };
  return html`<div class="scout-trip">
    ${found ? html`<${Reveal} key=${found.k} S=${S} ids=${found.ids} onClose=${() => setFound(null)} />` : null}
    <section>
      <${SectionTitle}>1 · Odak seç</${SectionTitle}>
      <div class="scout-focus">${Object.entries(FOCUS).map(([id, [n, d]]) => html`<button type="button" class=${cx('scout-focus__o', focus === id && 'is-on')} aria-pressed=${focus === id ? 'true' : 'false'} onClick=${() => { audio.play('click'); setFocus(id); }}><b>${n}</b><span>${d}</span></button>`)}</div>
    </section>
    <section>
      <${SectionTitle} right=${html`<span class="scout-energy"><${Icon} name="bolt" size=${13} /> ${S.agency.energy}/${S.agency.energyMax}</span>`}>2 · Lig seç</${SectionTitle}>
      <div class="scout-leagues">${acts.map((a) => {
        const l = S.leagues[a.payload.leagueId], p = pv[l.id], on = lg === l.id;
        return html`<button type="button" class=${cx('scout-lg', on && 'is-on', !a.ok && 'is-off')} aria-pressed=${on ? 'true' : 'false'} onClick=${() => { audio.play('click'); setLg(l.id); }}>
          <div class="scout-lg__top"><b>${l.name}</b><${Stars} n=${l.prestige} /></div>
          <div class="scout-lg__country muted">${l.country}</div>
          <div class="scout-lg__row"><span class="gold num">${fmtMoney(a.cost.cash)}</span><span class="muted">yol masrafı</span></div>
          <div class="scout-lg__row"><span class="lime num">${p ? p.available : '…'}</span><span class="muted">uygun oyuncu</span></div>
          ${p && p.startKnow != null ? html`<div class="scout-lg__know muted"><${Icon} name="eye" size=${12} /> ${a.count} oyuncu · başlangıç bilgisi %${p.startKnow}</div>` : null}
          ${!a.ok && a.reason ? html`<div class="scout-lg__why danger">${a.reason}</div>` : null}
        </button>`;
      })}</div>
    </section>
    <div class="scout-cta">
      <${Button} variant="gold" size="lg" block icon="search" energy=${1} cash=${sel1 ? sel1.cost.cash : undefined} disabled=${!sel1 || !sel1.ok} loading=${busy} onClick=${go}>${sel1 ? `${S.leagues[lg].name}: geziye çık` : 'Bir lig seç'}</${Button}>
      ${sel1 && !sel1.ok ? html`<div class="danger small scout-cta__why">${sel1.reason}</div>` : null}
    </div>
    <${Card} class="scout-teach" chalk>
      <div class="eyebrow">Keşif ne işe yarar?</div>
      <ul>
        <li><b>Gezi</b> yeni oyuncuları Radarına ekler.</li>
        <li><b>İzle</b> potansiyel bandını daraltır; sürpriz bir yıldızı erken yakalarsın.</li>
        <li><b>Isı</b> rakip ajansların ilgisidir. %100'de oyuncuyu kapar.</li>
        <li>İtibarın yettiğinde <b>imza teklifi</b> ver; sözlerin farkı kapatabilir.</li>
      </ul>
    </${Card}>
  </div>`;
}

/* ---------- radar ---------- */
const SORTS = [['acil', 'Acil'], ['guc', 'Güç'], ['imza', 'İmzaya yakın']];

function RadarRow({ S, r }) {
  const club = r.clubName ? S.clubs[S.players[r.id].clubId] : null;
  const toggle = (e) => { e.stopPropagation(); const x = store.act('toggleShortlist', { playerId: r.id }); if (x && x.ok) { audio.play('click'); haptics.tap(); } };
  const watch = (e) => {
    e.stopPropagation();
    const x = store.act('watchPlayer', { playerId: r.id });
    if (x && x.ok) { const ev = (x.events || [])[0] || {}; audio.play(ev.traitRevealed ? 'levelup' : 'confirm'); toast.success(`${r.name}: bilgin %${Math.round(ev.know)}${ev.traitRevealed ? ' — huyu ortaya çıktı' : ''}`, { icon: 'eye' }); }
  };
  const canWatch = S.agency.energy >= 1;
  const ml = heatMonths(r.heat, r.heatPerMonth);
  return html`<div class=${cx('scout-row', !r.rival && ml <= 2 && 'is-urgent', r.rival && 'is-rival')} role="button" tabindex="0" onClick=${() => openSheet('PlayerSheet', { playerId: r.id })}
    onKeyDown=${(e) => { if (e.key === 'Enter') openSheet('PlayerSheet', { playerId: r.id }); }}>
    <div class="scout-row__top">
      <${Avatar} id=${r.id} size=${52} colors=${club && club.colors} />
      <div class="scout-row__id"><b class="scout-row__name">${r.name}</b>
        <div class="scout-row__meta"><${PosChip} pos=${r.pos} /><span>${r.age} yaş</span>${r.rival ? html`<${Badge} tone="rival" icon="shield">Rakip ajanslı</${Badge}>` : null}</div>
        <div class="scout-row__club">${club ? html`<${Crest} colors=${club.colors} pattern=${club.crest} size=${12} />` : null}<span>${r.clubName || 'Kulüpsüz'} · ${r.leagueName || ''}</span></div></div>
      <button type="button" class=${cx('scout-star', r.shortlisted && 'is-on')} aria-label=${r.shortlisted ? 'Takipten çıkar' : 'Takibe al'} aria-pressed=${r.shortlisted ? 'true' : 'false'} onClick=${toggle}><${Icon} name="star" size=${22} fill=${r.shortlisted} /></button>
    </div>
    <div class="scout-row__band"><div class="grow"><${PotentialBand} ca=${r.ca} lo=${r.band.lo} hi=${r.band.hi} compact /></div>
      <div class="scout-ca scout-ca--sm"><b class="num">${r.ca}</b><small>GÜÇ</small></div></div>
    <div class="scout-row__know"><span><${Icon} name="eye" size=${12} /> Bilgi %${Math.round(r.know)}</span><span class="muted">${r.band.hi - r.band.lo >= 12 ? 'Tavan belirsiz' : `Tavan ${r.band.lo}–${r.band.hi}`}</span></div>
    <${HeatBar} r=${r} />
    <div class="scout-row__foot">${signHint(r)}
      <${Button} size="sm" variant="ghost" icon="eye" energy=${1} disabled=${!canWatch} onClick=${watch}>İzle</${Button}></div>
  </div>`;
}

function Radar({ S, goTrip }) {
  const [filter, setFilter] = useState('short');
  const [sort, setSort] = useState('acil');
  const [limit, setLimit] = useState(24);
  const all = sel.prospectList(S, {});
  const leagues = Object.values(S.leagues).sort((a, b) => a.prestige - b.prestige);
  let rows = all.filter((r) => (filter === 'short' ? r.shortlisted : filter === 'all' ? true : r.leagueName === S.leagues[filter].name));
  const urg = (r) => (r.rival ? 999 : heatMonths(r.heat, r.heatPerMonth));
  rows = rows.slice().sort(sort === 'acil' ? (a, b) => urg(a) - urg(b) || b.ca - a.ca : sort === 'guc' ? (a, b) => b.ca - a.ca : (a, b) => a.gap - b.gap || b.ca - a.ca);
  const shortCount = all.filter((r) => r.shortlisted).length;
  const urgent = all.filter((r) => !r.rival && heatMonths(r.heat, r.heatPerMonth) <= 2).length;
  return html`<div class="scout-radar">
    ${urgent ? html`<div class="scout-alert"><${Icon} name="flame" size=${18} /><span><b>${urgent} oyuncu</b> yakında rakip ajansa gidebilir.</span></div>` : null}
    <div class="scout-filters" role="group" aria-label="Filtre">
      <${Chip} active=${filter === 'short'} icon="star" onClick=${() => setFilter('short')}>Takip listesi (${shortCount})</${Chip}>
      <${Chip} active=${filter === 'all'} onClick=${() => setFilter('all')}>Tümü (${all.length})</${Chip}>
      ${leagues.map((l) => html`<${Chip} active=${filter === l.id} onClick=${() => setFilter(l.id)}>${l.name}</${Chip}>`)}
    </div>
    <div class="scout-sorts"><span class="eyebrow">Sırala</span>${SORTS.map(([id, l]) => html`<button type="button" class=${cx('scout-sort', sort === id && 'is-on')} onClick=${() => { audio.play('click'); setSort(id); }}>${l}</button>`)}</div>
    ${!rows.length ? (filter === 'short'
      ? html`<${EmptyState} icon="star" title="Takip listen boş" body="Radarında beğendiğin oyuncuları yıldızla; rakip ajanslar yaklaşırken ısıları burada görünür." action=${html`<${Button} variant="ghost" onClick=${() => setFilter('all')}>Tüm radarı gör</${Button}>`} />`
      : html`<${EmptyState} icon="eye" title="Radarında kimse yok" body="Keşif gezisi yap: bir lig ve odak seç, yeni yetenekler bu listeye düşsün." action=${html`<${Button} onClick=${goTrip}>Gezi planla</${Button}>`} />`)
      : html`<div class="scout-rows">${rows.slice(0, limit).map((r) => html`<${RadarRow} key=${r.id} S=${S} r=${r} />`)}</div>
        ${rows.length > limit ? html`<${Button} variant="ghost" block onClick=${() => setLimit(limit + 24)}>Daha fazla göster (${rows.length - limit})</${Button}>` : null}`}
  </div>`;
}

export default function Scout() {
  const S = useStore((s) => s.S);
  const [tab, setTabState] = useState(lastTab);
  const setTab = (t) => { lastTab = t; setTabState(t); };
  if (!S) return html`<${EmptyState} icon="eye" title="Oyun yok" body="Önce bir kariyer başlat." />`;
  const nShort = sel.prospectList(S, {}).filter((r) => r.shortlisted).length;
  return html`<div class="scout">
    <header><div class="eyebrow">Yetenek avı</div><h1 class="players-head__title t-display">Keşif</h1></header>
    <${Tabs} items=${[{ id: 'trip', label: 'Gezi', icon: 'search' }, { id: 'radar', label: 'Radarım', icon: 'eye', badge: nShort || null }]} value=${tab} onChange=${setTab} label="Keşif" />
    ${tab === 'trip' ? html`<${Trip} S=${S} />` : html`<${Radar} S=${S} goTrip=${() => setTab('trip')} />`}
  </div>`;
}
