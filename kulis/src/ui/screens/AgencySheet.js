// Ajans: one sheet, one scroll — rank among the agencies, money, the upgrade list.
import { html, Sheet, Button, Badge, Icon, SectionTitle, fmtMoney, toast, audio, haptics, store, useStore } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';

export default function AgencySheet({ close }) {
  const S = useStore((s) => s.S);
  const v = S ? sel.agencyView(S) : null;
  if (!v) return null;
  const buy = (u) => { const r = store.act('buyUpgrade', { upgradeId: u.id }); if (r.ok) { audio.play('coin'); haptics.success(); toast.money(u.name + ' alındı'); } };
  const top = Math.max(1, ...v.ranking.map((r) => r.score));
  return html`<${Sheet} title=${v.name} onClose=${close} tall>
    <div class="agency stack" data-testid="agency">
      <${SectionTitle}>Ajanslar arasında</${SectionTitle}>
      <div class="agency__rank">${v.ranking.map((r) => html`<div class=${'agency__row' + (r.isYou ? ' is-you' : '')} style=${{ '--rc': r.color, '--w': Math.round(r.score / top * 100) + '%' }}>
        <b class="num">${r.rank}</b><span class="agency__n">${r.name}${r.isYou ? html` <${Badge} tone="lime">Sen</${Badge}>` : ''}</span><span class="num small">${fmtMoney(r.score)}</span><i></i></div>`)}</div>

      <${SectionTitle}>Para</${SectionTitle}>
      <div class="agency__money">
        <div><span>Kasa</span><b class=${'num ' + (v.cash < 0 ? 'danger' : 'gold')}>${fmtMoney(v.cash)}</b></div>
        <div><span>Aylık gelir</span><b class="num lime">+${fmtMoney(v.income)}</b></div>
        <div><span>Aylık gider</span><b class="num danger">−${fmtMoney(v.upkeep)}</b></div>
      </div>
      ${v.loan ? html`<p class="small muted"><${Icon} name="building" size=${13} /> Kredi: ayda ${fmtMoney(v.loan.monthly)} · ${v.loan.monthsLeft} ay kaldı</p>` : null}

      <${SectionTitle}>Yükseltmeler</${SectionTitle}>
      <div class="agency__ups">${v.upgrades.map((u) => html`<div class=${'agency__up' + (u.owned ? ' is-owned' : '')} data-testid="upgrade">
        <div class="agency__up-t"><b>${u.name}</b><span class="small muted">${u.text}</span></div>
        ${u.owned ? html`<${Badge} tone="lime" icon="check">Alındı</${Badge}>` : html`<${Button} size="sm" variant=${u.canAfford ? 'gold' : 'ghost'} disabled=${!u.canAfford} onClick=${() => buy(u)}>${fmtMoney(u.price)}</${Button}>`}
      </div>`)}</div>
    </div>
  </${Sheet}>`;
}
