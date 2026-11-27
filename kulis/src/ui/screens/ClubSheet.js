// Club sheet: what the club needs and which of your clients would fit (pitch from here too).
import { html, Sheet, Crest, Badge, Button, PosChip, SectionTitle, toast, store, useStore, audio } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';

const TONE = { 'İlgilenir': 'lime', Belki: 'gold', Zor: 'muted' };
export default function ClubSheet({ close, clubId }) {
  const S = useStore((s) => s.S);
  const v = S ? sel.clubView(S, clubId) : null;
  if (!v) return null;
  const go = (c) => {
    const r = store.act('pitchPlayer', { playerId: c.id, clubId });
    if (!r.ok) return;
    audio.play(r.offer ? 'confirm' : 'click');
    toast[r.offer ? 'success' : 'info'](r.offer ? `${v.name} ${c.name} ile ilgileniyor: teklif Piyasa'da` : `${v.name} pek ilgilenmedi`);
  };
  return html`<${Sheet} title=${v.name} onClose=${close}>
    <div class="stack" data-testid="club-sheet">
      <div class="row"><${Crest} colors=${v.colors} pattern=${v.crest} size=${52} /><div><div class="small muted">${v.leagueName} · ${v.position}. sıra</div><div class="small">Direktör: ${v.director}</div></div></div>
      <div><span class="eyebrow">Arıyor</span><div class="club-needs">${v.needs.length ? v.needs.map((n) => html`<${Badge} tone=${n.level >= 3 ? 'gold' : 'muted'}>${n.pos}${n.level >= 3 ? ' · acil' : ''}</${Badge}>`) : html`<span class="muted small">Şimdilik kimseyi aramıyor</span>`}</div></div>
      ${v.clients.length ? html`<${SectionTitle}>Oyuncunu öner</${SectionTitle}>
        <div class="stack">${v.clients.map((c) => html`<div class="club-cl"><${PosChip} pos=${c.pos} /><b class="grow">${c.name}</b><${Badge} tone=${TONE[c.fit]}>${c.fit}</${Badge}>
          <${Button} size="sm" variant="ghost" energy=${1} disabled=${S.agency.energy < 1} onClick=${() => go(c)}>Öner</${Button}></div>`)}</div>` : null}
    </div>
  </${Sheet}>`;
}
