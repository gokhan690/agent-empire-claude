// Piyasa: offers waiting for you (take a seat at the table) and the clubs of every league (what they need).
import { html, useState, Card, Button, Crest, Chip, SectionTitle, EmptyState, Icon, Badge, fmtMoney, store, useStore, navigate } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';
import { LEAGUE_DEFS } from '../../engine/constants.js';
import { openClub, sitAtTable } from './common.js';

function Offer({ o, S }) {
  return html`<${Card} class="offer" data-testid="offer">
    <div class="offer__top">
      <${Crest} colors=${o.colors} pattern=${o.crest} size=${40} />
      <div class="offer__id"><b class="offer__club">${o.clubName}</b><span class="small muted">${o.playerName} (${o.pos}) · ${o.leagueName}</span></div>
      <${Badge} tone=${o.plays ? 'lime' : 'muted'}>${o.playsWord}</${Badge}>
    </div>
    <div class="offer__row">
      <span class="small muted">Tahmini komisyon <b class="num gold">${fmtMoney(o.fee)}</b></span>
      <${Button} size="sm" icon="handshake" energy=${1} disabled=${S.agency.energy < 1 || !!S.negotiation} onClick=${() => sitAtTable(o.id)}>Masaya otur</${Button}>
    </div>
  </${Card}>`;
}

export default function Market() {
  const S = useStore((s) => s.S);
  const [lg, setLg] = useState('tr1');
  if (!S) return null;
  const offers = sel.offerList(S);
  const clubs = sel.clubList(S, lg);
  return html`<div class="market stack">
    <${SectionTitle} right=${html`<span class="muted small">${offers.length}</span>`}>Teklifler</${SectionTitle}>
    ${offers.length ? offers.map((o) => html`<${Offer} key=${o.id} o=${o} S=${S} />`)
      : html`<${Card}><${EmptyState} icon="swap" title="Teklif yok" body="Oyuncunu bir kulübe öner: ilgilenirse teklif burada belirir."
        action=${html`<${Button} size="sm" variant="ghost" onClick=${() => navigate('players')}>Oyunculara git</${Button}>`} /></${Card}>`}

    <${SectionTitle}>Kulüpler</${SectionTitle}>
    <div class="market__chips" role="group" aria-label="Lig">${LEAGUE_DEFS.map((l) => html`<${Chip} key=${l.id} active=${lg === l.id} onClick=${() => setLg(l.id)}>${l.name}</${Chip}>`)}</div>
    <div class="stack market__clubs">${clubs.map((c) => html`<button type="button" key=${c.id} class="mclub" onClick=${() => openClub(c.id)}>
      <${Crest} colors=${c.colors} pattern=${c.crest} size=${34} />
      <span class="mclub__n">${c.name}</span>
      <span class="mclub__needs">${c.needs.length ? c.needs.slice(0, 3).map((p) => html`<em>${p}</em>`) : html`<small class="muted">—</small>`}</span>
    </button>`)}</div>
  </div>`;
}
