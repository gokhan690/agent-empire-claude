// Season review: one compact screen — your rank, the money, the goal result — and one button.
import { html, Overlay, Button, Card, Icon, Crest, Stat, store, audio, useStore, fmtMoney } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';

export default function SeasonEnd({ close, seasonEnd, report }) {
  const S = useStore((s) => s.S);
  if (!S) return null;
  const hist = S.history || [];
  const last = hist[hist.length - 1], prev = hist[hist.length - 2];
  const season = last ? last.season : (seasonEnd ? seasonEnd.season : S.time.season - 1);
  const deals = S.deals.filter((d) => d.season === season);
  const commission = deals.reduce((a, d) => a + d.commission, 0);
  const champId = seasonEnd ? seasonEnd.champions.tr1 : (last && last.champions.tr1);
  const champ = champId ? S.clubs[champId] : null;
  const ended = S.time.phase === 'over' && !!S.ending;
  const goal = report && report.events.find((e) => e.type === 'goal');
  const retired = report ? report.events.filter((e) => e.type === 'retire') : [];
  const rank = last ? last.rank : sel.myRank(S);
  const dRank = prev ? prev.rank - rank : 0;
  const go = () => { audio.play('click'); if (ended) store.ui.openOverlay('Ending', {}); else close(); };
  return html`<${Overlay} label="Sezon özeti" tone=${rank === 1 ? 'gold' : undefined} class="season-ov" onClose=${go}>
    <div class="season-wrap" data-testid="season-end">
      <header class=${'season-head' + (rank === 1 ? ' is-gold' : '')}>
        <span class="season-head__ico"><${Icon} name=${rank === 1 ? 'trophy' : 'whistle'} size=${28} /></span>
        <div class="eyebrow">Son düdük çaldı</div>
        <h2 class="season-head__title t-display">Sezon ${season} bitti</h2>
      </header>
      <${Card} chalk tone=${rank === 1 ? 'gold' : undefined} class="season-rank">
        <div class="season-rank__n num">${rank}<small>. sıra</small></div>
        <div class="season-rank__t"><b>Ajans sıralaman</b><span class="muted small">${prev ? (dRank > 0 ? `Geçen sezon ${prev.rank}. idin: ${dRank} basamak yükseldin` : dRank < 0 ? `Geçen sezon ${prev.rank}. idin` : 'Sıran değişmedi') : 'İlk sezonun: yarış başladı'}</span></div>
      </${Card}>
      <div class="season-grid">
        <${Card}><${Stat} label="Kasa" icon="cash" value=${fmtMoney(S.agency.cash)} /></${Card}>
        <${Card}><${Stat} label="İtibar" icon="star" tone="gold" value=${Math.round(S.agency.rep)} /></${Card}>
        <${Card}><${Stat} label="Komisyon" icon="handshake" tone="lime" value=${fmtMoney(commission)} hint="bu sezon" /></${Card}>
        <${Card}><${Stat} label="Transfer" icon="swap" value=${deals.length} hint="bu sezon" /></${Card}>
      </div>
      <div class="season-notes">
        ${goal ? html`<p class=${goal.status === 'done' ? 'lime' : 'muted'}><${Icon} name=${goal.status === 'done' ? 'check' : 'alert'} size=${15} /> Hedef: ${goal.title}: ${goal.status === 'done' ? 'tamam' : 'kaçtı'}</p>` : null}
        ${champ ? html`<p class="muted"><${Crest} colors=${champ.colors} pattern=${champ.crest} size=${16} /> Süper Lig şampiyonu: ${champ.name}</p>` : null}
        ${retired.map((e) => html`<p class="muted"><${Icon} name="whistle" size=${15} /> ${e.name} futbola veda etti.</p>`)}
      </div>
      <footer class="season-foot"><${Button} size="lg" block variant=${ended ? 'gold' : 'primary'} onClick=${go} data-testid="season-continue">${ended ? 'Finale geç' : `Sezon ${S.time.season}'e başla`}</${Button}></footer>
    </div>
  </${Overlay}>`;
}
