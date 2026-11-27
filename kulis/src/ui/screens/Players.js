// Oyuncular: your clients + "Yeni oyuncu bul" (search, watch, sign).
import { html, Card, Button, Badge, Icon, Stars, PosChip, PlayerRow, SectionTitle, EmptyState, Avatar, fmtMoney, toast, audio, haptics, store, useStore } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';
import { BAL } from '../../engine/constants.js';
import { openPlayer } from './common.js';

function Candidate({ c, S }) {
  const watch = () => { const r = store.act('watchPlayer', { playerId: c.id }); if (r.ok) { audio.play('confirm'); toast.success(c.name + ' izlendi: potansiyeli artık net'); } };
  const sign = () => { const r = store.act('signPlayer', { playerId: c.id }); if (r.ok) { audio.play('sign'); haptics.success(); toast.success(c.name + ' artık müşterin'); } };
  return html`<${Card} class="cand" data-testid="candidate">
    <div class="cand__top">
      <${Avatar} id=${c.id} size=${46} />
      <div class="cand__id"><b class="cand__name">${c.name}</b>
        <span class="cand__meta"><${PosChip} pos=${c.pos} /> ${c.age} yaş · ${c.clubName}</span></div>
      <span class="num gold cand__val">${fmtMoney(c.value)}</span>
    </div>
    <div class="cand__stars">
      <span><small>Güç</small> <${Stars} value=${c.stars} /></span>
      <span><small>Potansiyel</small> <${Stars} lo=${c.potential.lo} hi=${c.potential.hi} /></span>
    </div>
    <div class="cand__act">
      ${c.watched ? html`<${Badge} tone="lime" icon="check">İzlendi</${Badge}>` : html`<${Button} size="sm" variant="ghost" icon="eye" energy=${1} disabled=${S.agency.energy < 1} onClick=${watch}>İzle</${Button}>`}
      ${c.canSign ? html`<${Button} size="sm" icon="pen" energy=${1} disabled=${S.agency.energy < 1} onClick=${sign}>İmzala</${Button}>` : html`<span class="cand__why small"><${Icon} name="lock" size=${13} /> ${c.block}</span>`}
    </div>
  </${Card}>`;
}

export default function Players() {
  const S = useStore((s) => s.S);
  if (!S) return null;
  const rows = sel.clientList(S);
  const cands = sel.candidateList(S);
  const search = () => { const r = store.act('searchPlayers', {}); if (r.ok) { audio.play('whoosh'); } };
  return html`<div class="players stack">
    <${SectionTitle} right=${html`<span class="muted small">${rows.length}</span>`}>Oyuncularım</${SectionTitle}>
    ${rows.length ? html`<div class="stack players__list">${rows.map((p) => html`<${PlayerRow} key=${p.id} p=${p} colors=${S.clubs[S.players[p.id].clubId] && S.clubs[S.players[p.id].clubId].colors} onClick=${() => openPlayer(p.id)} />`)}</div>`
      : html`<${Card}><${EmptyState} icon="users" title="Henüz müşterin yok" body="Aşağıdan yeni oyuncu ara ve imzala." /></${Card}>`}

    <${SectionTitle}>Yeni oyuncu bul</${SectionTitle}>
    <${Button} block icon="search" energy=${1} disabled=${S.agency.energy < 1} onClick=${search} data-testid="search">Oyuncu ara</${Button}>
    <div class="stack">
      ${cands.length ? cands.map((c) => html`<${Candidate} key=${c.id} c=${c} S=${S} />`) : html`<p class="muted small center">${BAL.scout.count} aday gelir. Beğendiğini izle, imzala.</p>`}
    </div>
  </div>`;
}
