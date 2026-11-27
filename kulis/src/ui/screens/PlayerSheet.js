// Player dossier: one phone screen — stars, club, contract end, value, mood, ≤ 3 actions.
import { html, useState, Sheet, Button, Avatar, Crest, PosChip, Stars, MoodDot, Badge, fmtMoney, store, useStore, toast } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';
import { sitAtTable } from './common.js';

export default function PlayerSheet({ close, playerId }) {
  const S = useStore((s) => s.S);
  const [sure, setSure] = useState(false);
  const v = S ? sel.clientView(S, playerId) : null;
  if (!v) return html`<${Sheet} title="Oyuncu" onClose=${close}><p class="muted">Bu oyuncu artık müşterin değil.</p></${Sheet}>`;
  const best = v.offers[0];
  const endTxt = v.contractYearsLeft <= 0 ? 'Bu sezon bitiyor' : `${v.contractEnd}. sezon sonu`;
  const release = () => { if (!sure) { setSure(true); return; } const r = store.act('releaseClient', { playerId }); if (r.ok) { toast.info(v.name + ' ile yollar ayrıldı'); close(); } };
  return html`<${Sheet} title=${v.name} onClose=${close}>
    <div class="psheet" data-testid="player-sheet">
      <div class="psheet__top">
        <${Avatar} id=${v.id} size=${64} colors=${v.club && v.club.colors} ring />
        <div class="psheet__id">
          <div class="psheet__meta"><${PosChip} pos=${v.pos} /> <span>${v.age} yaş</span> ${v.injured ? html`<${Badge} tone="danger" icon="alert">Sakat ${v.injured} ay</${Badge}>` : null}</div>
          <div class="psheet__club">${v.club ? html`<${Crest} colors=${v.club.colors} pattern=${v.club.crest} size=${18} />${v.club.name}` : '—'}</div>
        </div>
      </div>
      <dl class="psheet__facts">
        <div><dt>Güç</dt><dd><${Stars} value=${v.stars} /></dd></div>
        <div><dt>Potansiyel</dt><dd><${Stars} lo=${v.potential.lo} hi=${v.potential.hi} /></dd></div>
        <div><dt>Değer</dt><dd class="num gold">${fmtMoney(v.value)}</dd></div>
        <div><dt>Sözleşme</dt><dd>${endTxt}</dd></div>
        <div><dt>Ruh hali</dt><dd><${MoodDot} tone=${v.moodTone} word=${v.moodWord} /></dd></div>
      </dl>
      <div class="psheet__act stack">
        ${best ? html`<${Button} block variant="gold" icon="handshake" energy=${1} disabled=${S.agency.energy < 1 || !!S.negotiation} onClick=${() => { close(); sitAtTable(best.id); }}>Masaya otur: ${best.clubName}</${Button}>` : null}
        <${Button} block variant=${best ? 'ghost' : 'primary'} icon="swap" energy=${1} disabled=${S.agency.energy < 1} onClick=${() => store.ui.openSheet('PitchSheet', { playerId })}>Kulübe öner</${Button}>
        <button type="button" class="psheet__release" onClick=${release}>${sure ? 'Emin misin? Tekrar dokun' : 'Yollarımızı ayır'}</button>
      </div>
    </div>
  </${Sheet}>`;
}
