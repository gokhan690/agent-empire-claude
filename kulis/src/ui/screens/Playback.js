// Month report: one compact screen — your clients' month, the money, anything new — and one "Devam" button.
import { html, cx, fmtMoney, MONTH_NAMES, useEffect, Overlay, Button, Avatar, Icon, Money, store, openOverlay, audio, haptics, confetti } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';

const rate = (r) => (Math.round(r * 10) / 10).toFixed(1).replace('.', ',');

function clientLine(c) {
  if (!c.apps) return 'Bu ay maça çıkmadı';
  return `${c.apps} maç${c.goals ? ' · ' + c.goals + ' gol' : ''}${c.assists ? ' · ' + c.assists + ' asist' : ''} · ${rate(c.rating)}`;
}

export default function Playback({ close, report }) {
  const S = store.S;
  const r = report;
  useEffect(() => {
    if (!r) return;
    const scored = r.clients.some((c) => c.goals > 0);
    if (r.events.some((e) => e.type === 'goal' && e.status === 'done')) { audio.play('levelup'); confetti({ count: 90, colors: ['#F5C451', '#3DDC84', '#EEF4EF'] }); }
    else if (scored) audio.play('goal');
    else audio.play('page');
  }, []);
  if (!r || !S) return html`<${Overlay} label="Ay raporu" onClose=${close}><div class="screen-pad"></div></${Overlay}>`;
  const fin = r.finance || { net: 0, cash: S.agency.cash, items: [] };
  const rows = r.clients.filter((c) => c.apps > 0 || c.caDelta);
  const goal = r.events.find((e) => e.type === 'goal');
  const newOffers = r.events.filter((e) => e.type === 'interest' && S.players[e.playerId] && S.players[e.playerId].agentId === 'you');
  const left = r.events.filter((e) => e.type === 'clientLeft');
  const rival = r.rivalMoves.find((m) => m.sniped) || r.rivalMoves[0];
  const done = () => {
    audio.play('click'); haptics.tap();
    if (r.seasonEnd) openOverlay('SeasonEnd', { seasonEnd: r.seasonEnd, report: r });
    else if (r.ending) openOverlay('Ending', {});
    else close();
  };
  return html`<${Overlay} label="Ay raporu" onClose=${done}>
    <div class="playback" data-testid="month-report">
      <header class="playback__head"><div class="eyebrow">Sezon ${r.season}</div><h1 class="t-display playback__title">${MONTH_NAMES[r.month]} raporu</h1></header>

      ${rows.length ? html`<section class="playback__sec"><div class="eyebrow">Oyuncuların</div>
        ${rows.map((c) => { const p = S.players[c.playerId]; return p ? html`<div class="playback__row"><${Avatar} id=${p.id} size=${34} /><div class="grow"><b>${p.name}</b><span class="small muted">${clientLine(c)}</span></div>
          ${c.caDelta ? html`<span class=${cx('num small', c.caDelta > 0 ? 'lime' : 'danger')}><${Icon} name=${c.caDelta > 0 ? 'arrowUp' : 'arrowDown'} size=${12} strokeWidth=${2.6} />${Math.abs(c.caDelta)}</span>` : null}</div>` : null; })}
      </section>` : null}

      <section class="playback__sec playback__money">
        <div><span class="eyebrow">Bu ay</span><b class=${cx('num', fin.net >= 0 ? 'lime' : 'danger')}>${fin.net >= 0 ? '+' : '−'}${fmtMoney(Math.abs(fin.net))}</b></div>
        <div><span class="eyebrow">Kasa</span><b class=${cx('num', fin.cash >= 0 ? 'gold' : 'danger')}>${fmtMoney(fin.cash)}</b></div>
      </section>

      ${newOffers.length || left.length || goal || rival ? html`<section class="playback__sec playback__notes">
        ${newOffers.length ? html`<p><${Icon} name="swap" size=${15} /> ${newOffers.length === 1 ? 'Yeni bir teklif var' : newOffers.length + ' yeni teklif var'}: Piyasa'ya bak.</p>` : null}
        ${goal && goal.status === 'done' ? html`<p class="lime"><${Icon} name="check" size=${15} /> Sezon hedefi tamam: ${fmtMoney(goal.reward.cash)} ve +${goal.reward.rep} itibar.</p>` : null}
        ${goal && goal.status === 'failed' ? html`<p class="muted"><${Icon} name="alert" size=${15} /> Sezon hedefi kaçtı.</p>` : null}
        ${left.map((e) => html`<p class="danger"><${Icon} name="alert" size=${15} /> ${e.name} mutsuz olup ayrıldı.</p>`)}
        ${rival ? html`<p class="muted"><${Icon} name="users" size=${15} /> ${rival.text}</p>` : null}
      </section>` : null}

      <footer class="playback__bar"><${Button} size="lg" block onClick=${done} data-testid="continue">Devam</${Button}></footer>
    </div>
  </${Overlay}>`;
}
