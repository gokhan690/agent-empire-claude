// Piyasa — interests in your clients ("Teklifler"), clubs of every league, league tables.
import { html, useState, Segmented, Card, Badge, Avatar, Crest, Button, Chip, Meter, EmptyState, SectionTitle, PosChip, Icon, store, useStore, openOverlay, openSheet, cx } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';
import { LEAGUE_DEFS, MONTHS } from '../../engine/constants.js';
import { KIND_LABEL, LOCATIVE } from './table/lib.js';

const WINDOWS = [0, 1, 6];
function windowInfo(S) {
  const t = S.time, open = MONTHS[t.month].window;
  if (open) return { open, text: `Transfer dönemi açık`, sub: MONTHS[t.month].deadline ? `Son Gün bu ayın sonunda: ${MONTHS[t.month].name} bitmeden anlaşmaları bağla.` : 'Bu dönemin Son Günü Ağustos’un sonunda.' };
  let n = 1; while (!MONTHS[(t.month + n) % 12].window) n += 1;
  const name = MONTHS[(t.month + n) % 12].name;
  return { open, text: 'Transfer dönemi kapalı', sub: `${LOCATIVE[name] || name} açılır (${n} ay sonra). Bu sürede yemek, öneri ve basınla ilgi biriktir; Son Gün Ağustos ve Ocak aylarının sonundadır.` };
}
const fitTone = (v) => (v >= 50 ? 'lime' : v >= 40 ? 'gold' : 'danger');

function Level({ value }) {
  return html`<div class="mk-lvl" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(value)} aria-label="İlgi seviyesi">
    <div class="mk-lvl__track"><i class=${cx('mk-lvl__fill', value >= 60 ? 'is-hot' : 'is-cold')} style=${{ width: Math.min(100, value) + '%' }}></i><u class="mk-lvl__mark" style=${{ left: '60%' }}><em>60</em></u></div>
    <b class=${cx('num', value >= 60 ? 'lime' : 'gold')}>${Math.round(value)}</b>
  </div>`;
}

function InterestRow({ i, S, inDeadline }) {
  const club = S.clubs[i.clubId];
  const noEnergy = !inDeadline && S.agency.energy < 1;
  const sit = () => { const r = store.act('openNegotiation', { interestId: i.id }); if (r.ok) openOverlay('Negotiation', {}); };
  return html`<div class=${cx('mk-int', i.negotiable && 'is-hot')}>
    <button type="button" class="mk-int__club" onClick=${() => openSheet('ClubSheet', { clubId: i.clubId })} aria-label=${club.name + ' kulüp bilgisi'}><${Crest} colors=${club.colors} pattern=${club.crest} size=${40} /></button>
    <div class="mk-int__main">
      <div class="mk-int__head"><b class="t-display">${club.name}</b><${Badge} tone=${i.kind === 'free' ? 'lime' : i.kind === 'renewal' ? 'info' : 'gold'}>${KIND_LABEL[i.kind]}</${Badge}></div>
      <${Level} value=${i.level} />
      <div class=${cx('mk-int__fit', `is-${fitTone(i.fitSat)}`)}>${i.fitWord} · orada <b class="num">%${Math.round(i.expectedMinutes * 100)}</b> oynar${i.fitSat < 40 ? ' · gerçekçi pakete razı olmaz' : ''}</div>
      ${i.negotiable ? html`<${Button} size="sm" variant="primary" icon="handshake" energy=${inDeadline ? undefined : 1} disabled=${noEnergy} onClick=${sit}>Masaya otur</${Button}>${noEnergy ? html`<span class="mk-int__why">Enerjin yok</span>` : null}`
        : html`<div class="mk-int__why"><${Icon} name="lock" size=${14} /> ${i.reason}</div>`}
    </div>
  </div>`;
}

function Offers({ S, hub }) {
  const list = sel.interestList(S);
  const win = windowInfo(S);
  const groups = [];
  for (const i of list) { let g = groups.find((x) => x.id === i.playerId); if (!g) { g = { id: i.playerId, rows: [] }; groups.push(g); } g.rows.push(i); }
  const inDeadline = S.time.phase === 'deadline';
  return html`<div class="mk-stack">
    <section class=${cx('mk-win', win.open ? 'is-open' : 'is-shut')}>
      <span class="mk-win__dot"></span><div><b class="t-display">${win.text}</b><p>${win.sub}</p></div>
      ${inDeadline ? html`<${Button} size="sm" variant="danger" icon="clock" onClick=${() => openOverlay('Deadline', {})}>Son Gün</${Button}>` : null}
    </section>
    ${!groups.length ? html`<${EmptyState} icon="swap" title="Henüz teklif yok" body="Kulüpler müşterilerine ilgi duyduğunda burada görünür. İlgi 60’a ulaşınca masaya oturabilirsin." />
      <div class="mk-how">
        <${SectionTitle}>İlgi nasıl artar?</${SectionTitle}>
        <div class="mk-how__grid">
          <div><${Icon} name="target" size=${20} /><b>Öner</b><span>Oyuncuyu bir kulübe kendin öner: ilgi doğrudan yükselir.</span></div>
          <div><${Icon} name="users" size=${20} /><b>Yemek</b><span>Direktörle yemek ye: ihtiyaçlarını ve bütçesini öğren, güvenini kazan.</span></div>
          <div><${Icon} name="news" size=${20} /><b>Medya</b><span>Basın çalışması oyuncunun adını büyütür; büyük isimler daha çok aranır.</span></div>
          <div><${Icon} name="trendUp" size=${20} /><b>Form</b><span>İyi oynayan oyuncu kendiliğinden dikkat çeker. Dakikası olsun.</span></div>
        </div>
      </div>`
      : groups.map((g) => {
        const p = S.players[g.id], club = p.clubId ? S.clubs[p.clubId] : null;
        return html`<${Card} key=${g.id} class="mk-client">
          <button type="button" class="mk-client__head" onClick=${() => openSheet('PlayerSheet', { playerId: g.id })}>
            <${Avatar} id=${p.id} size=${46} />
            <div class="mk-client__t"><b class="t-display">${p.name}</b><span><${PosChip} pos=${p.pos} /> ${p.age} yaş · ${club ? club.name : 'Serbest'}</span></div>
            <${Icon} name="chevronRight" size=${18} />
          </button>
          <div class="mk-client__rows">${g.rows.map((i) => html`<${InterestRow} key=${i.id} i=${i} S=${S} inDeadline=${inDeadline} />`)}</div>
        </${Card}>`;
      })}
  </div>`;
}

function LeaguePicker({ value, onChange }) {
  return html`<div class="mk-leagues" role="group" aria-label="Lig">${LEAGUE_DEFS.map((l) => html`<${Chip} key=${l.id} active=${l.id === value} onClick=${() => onChange(l.id)}>${l.name}</${Chip}>`)}</div>`;
}

function Clubs({ S, lg, setLg }) {
  const rows = sel.clubList(S, lg);
  const mine = new Set(sel.myClients(S).map((p) => p.clubId).filter(Boolean));
  return html`<div class="mk-stack">
    <${LeaguePicker} value=${lg} onChange=${setLg} />
    <div class="mk-clubs">${rows.map((c) => html`<button type="button" key=${c.id} class=${cx('mk-club', mine.has(c.id) && 'is-mine')} onClick=${() => openSheet('ClubSheet', { clubId: c.id })}>
      <span class="mk-club__pos num">${c.position}</span><${Crest} colors=${c.colors} pattern=${c.crest} size=${38} />
      <span class="mk-club__n"><b>${c.name}</b><${Meter} value=${c.trust} size="sm" tone="info" hint=${null} label=${null} /></span>
      <span class="mk-club__r"><small>Güven</small><b class="num">${c.trust}</b>${c.lunchKnown ? html`<${Badge} tone="lime" icon="check">Tanıyorsun</${Badge}>` : html`<${Badge} tone="muted">Yemek yok</${Badge}>`}</span>
    </button>`)}</div>
  </div>`;
}

function Table({ S, lg, setLg }) {
  const rows = sel.tableSorted(S, lg);
  const mineBy = {};
  for (const p of sel.myClients(S)) if (p.clubId) (mineBy[p.clubId] = mineBy[p.clubId] || []).push(p.name);
  const L = S.leagues[lg];
  return html`<div class="mk-stack">
    <${LeaguePicker} value=${lg} onChange=${setLg} />
    <section class="card mk-table">
      <div class="mk-table__h"><span>#</span><span>Kulüp</span><span>O</span><span>AV</span><span>P</span></div>
      ${rows.map((r, i) => { const c = S.clubs[r.clubId]; const mine = mineBy[r.clubId];
        return html`<button type="button" key=${r.clubId} class=${cx('mk-table__r', mine && 'is-mine', i === 0 && 'is-top')} onClick=${() => openSheet('ClubSheet', { clubId: r.clubId })}>
          <span class="num mk-table__pos">${i + 1}</span>
          <span class="mk-table__club"><${Crest} colors=${c.colors} pattern=${c.crest} size=${26} /><span><b>${c.name}</b>${mine ? html`<small class="lime">Müşterin: ${mine.join(', ')}</small>` : null}</span></span>
          <span class="num">${r.p}</span><span class="num">${r.gd > 0 ? '+' : ''}${r.gd}</span><b class="num mk-table__pts">${r.pts}</b></button>`; })}
    </section>
    ${L && L.matchday === 0 ? html`<p class="muted small">Sezon henüz başlamadı: tablo sıfırdan başlar.</p>` : null}
  </div>`;
}

export default function Market() {
  const st = useStore();
  const S = st.S;
  const [seg, setSeg] = useState(() => (S && sel.hubSummary(S).tutorialStep === 'market' ? 'clubs' : 'offers'));
  const first = S ? sel.myClients(S).map((p) => p.clubId).filter(Boolean)[0] : null;
  const [lg, setLg] = useState(first && S ? S.clubs[first].leagueId : 'tr1');
  if (!S) return html`<${EmptyState} icon="swap" title="Piyasa" body="Önce bir oyun başlat." />`;
  const hot = sel.interestList(S).filter((i) => i.negotiable).length;
  return html`<div class="mk">
    <header class="mk__head"><div class="eyebrow">Piyasa</div><h1 class="t-display mk__title">Teklifler ve kulüpler</h1></header>
    <${Segmented} label="Piyasa bölümleri" value=${seg} onChange=${setSeg} items=${[{ id: 'offers', label: 'Teklifler', badge: hot || null }, { id: 'clubs', label: 'Kulüpler' }, { id: 'table', label: 'Puan durumu' }]} />
    ${seg === 'offers' ? html`<${Offers} S=${S} />` : seg === 'clubs' ? html`<${Clubs} S=${S} lg=${lg} setLg=${setLg} />` : html`<${Table} S=${S} lg=${lg} setLg=${setLg} />`}
  </div>`;
}
