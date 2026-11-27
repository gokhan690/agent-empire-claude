// "Kulübe öner": pick a club (best fit first); 1 energy. An interested club makes an offer at once.
import { html, useState, Sheet, Button, Crest, Badge, store, useStore, audio, haptics } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';
import { sitAtTable } from './common.js';

const TONE = { 'İlgilenir': 'lime', Belki: 'gold', Zor: 'muted' };

export default function PitchSheet({ close, playerId }) {
  const S = useStore((s) => s.S);
  const [res, setRes] = useState(null);
  const p = S && S.players[playerId];
  if (!p) return null;
  const rows = sel.pitchOptions(S, playerId, 12);
  const go = (o) => {
    const r = store.act('pitchPlayer', { playerId, clubId: o.clubId });
    if (!r.ok) return;
    audio.play(r.offer ? 'confirm' : 'click'); haptics.tap();
    setRes({ club: S.clubs[o.clubId], offer: r.offer, interestId: r.interestId });
  };
  if (res) {
    return html`<${Sheet} title="Kulübe öner" onClose=${close}>
      <div class="pitch-res stack" data-testid="pitch-result">
        <div class="pitch-res__head"><${Crest} colors=${res.club.colors} pattern=${res.club.crest} size=${52} />
          <div><b class="t-display">${res.club.name}</b><div class="small muted">${res.offer ? `${p.name} ilgilerini çekti: teklif geldi!` : 'Çok ilgilenmediler. Biraz ısındılar.'}</div></div></div>
        ${res.offer ? html`<${Button} block variant="gold" icon="handshake" energy=${1} disabled=${S.agency.energy < 1} onClick=${() => { close(); sitAtTable(res.interestId); }}>Masaya otur</${Button}>` : null}
        <${Button} block variant="ghost" onClick=${close}>Tamam</${Button}>
      </div>
    </${Sheet}>`;
  }
  return html`<${Sheet} title=${p.name + ': kulüp seç'} onClose=${close}>
    <div class="stack pitch" data-testid="pitch">
      ${rows.map((o) => html`<button type="button" key=${o.clubId} class="pitch__row" disabled=${S.agency.energy < 1 || o.cooldown > 0} onClick=${() => go(o)}>
        <${Crest} colors=${o.colors} pattern=${o.crest} size=${34} />
        <span class="pitch__n"><b>${o.name}</b><small>${o.leagueName}${o.needs.length ? ' · arıyor: ' + o.needs.join(', ') : ''}</small></span>
        <${Badge} tone=${o.cooldown ? 'danger' : TONE[o.fit]}>${o.cooldown ? 'Küs' : o.fit}</${Badge}>
      </button>`)}
      <p class="small muted center">Her öneri 1 enerji.</p>
    </div>
  </${Sheet}>`;
}
