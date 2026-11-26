// "Kulübe öner": club picker with pitchPreview deltas shown before spending.
import { html, useState, useEffect, cx, store, Crest, Button, Icon, Segmented, Meter, audio, haptics, toast } from '../../ui-kit.js';
import * as sel from '../../../engine/selectors.js';

export function usePitch(S, playerId, enabled, onDone) {
  const p = S.players[playerId];
  const home = p && p.clubId && S.clubs[p.clubId] ? S.clubs[p.clubId].leagueId : 'tr1';
  const [lg, setLg] = useState(home);
  const [rows, setRows] = useState(null);
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const ids = S.leagues[lg].clubIds.filter((c) => c !== (p && p.clubId));
    const out = ids.map((cid) => {
      const r = store.act('pitchPreview', { playerId, clubId: cid });
      const pv = r && r.ok ? r.preview : { error: 'Hesaplanamadı', delta: 0, levelBefore: 0, levelAfter: 0, energy: 1, cash: 0 };
      return { club: S.clubs[cid], pv };
    });
    out.sort((a, b) => (a.pv.error ? 1 : 0) - (b.pv.error ? 1 : 0) || b.pv.delta - a.pv.delta);
    setRows(out); setPick(null);
  }, [enabled, lg]);
  const go = () => {
    const row = rows && rows.find((r) => r.club.id === pick);
    if (!row || busy) return;
    setBusy(true);
    const r = store.act('pitchPlayer', { playerId, clubId: pick });
    setBusy(false);
    if (!r || r.ok === false) return;
    audio.play('confirm'); haptics.success();
    toast.success(`${row.club.name} ilgisi +${r.delta ?? row.pv.delta} → %${row.pv.levelAfter}`, { icon: 'eye' });
    onDone(row.club, r);
  };
  return { lg, setLg, rows, pick, setPick, busy, go };
}

export function PitchBody({ S, pitch, vm }) {
  const { lg, setLg, rows, pick, setPick } = pitch;
  const leagues = Object.values(S.leagues).sort((a, b) => a.prestige - b.prestige).map((l) => ({ id: l.id, label: l.name.replace(' Ligi', '') }));
  return html`<div class="pitch">
    <p class="muted small">Bir kulübe ${vm.name} için kulis yaparsan o kulübün ilgisi hemen artar. Aşağıda her kulüp için kazancı harcamadan görürsün.</p>
    <div class="pitch-leagues">${leagues.map((l) => html`<button type="button" class=${cx('pitch-lg', l.id === lg && 'is-on')} onClick=${() => { audio.play('click'); setLg(l.id); }}>${l.label}</button>`)}</div>
    ${!rows ? html`<div class="muted">Hesaplanıyor…</div>` : html`<div class="pitch-list">${rows.map(({ club, pv }) => {
      const off = !!pv.error;
      const pos = (sel.tableSorted(S, club.leagueId).findIndex((r) => r.clubId === club.id)) + 1;
      return html`<button type="button" class=${cx('pitch-row', pick === club.id && 'is-on', off && 'is-off')} disabled=${off} onClick=${() => { audio.play('click'); setPick(club.id); }}>
        <${Crest} colors=${club.colors} pattern=${club.crest} size=${28} />
        <span class="pitch-row__main"><b>${club.name}</b>
          ${off ? html`<em class="danger">${pv.error}</em>` : html`<span class="pitch-row__lv"><${Meter} value=${pv.levelAfter} tone="lime" size="sm" label="İlgi" /><i class="num">%${pv.levelBefore} → %${pv.levelAfter}</i></span>`}
          <em class="muted">${pos}. sıra · Güven ${club.trust}</em></span>
        <span class=${cx('pitch-row__d num', off && 'is-off')}>${off ? '—' : '+' + pv.delta}</span>
      </button>`;
    })}</div>`}
  </div>`;
}

export function PitchFooter({ S, pitch, onBack }) {
  const row = pitch.rows && pitch.rows.find((r) => r.club.id === pitch.pick);
  return html`<div class="recruit-foot__row">
    <${Button} variant="ghost" onClick=${onBack}>Geri</${Button}>
    <${Button} class="grow" size="lg" icon="eye" energy=${row ? row.pv.energy : 1} cash=${row && row.pv.cash ? row.pv.cash : undefined} disabled=${!row} loading=${pitch.busy} onClick=${pitch.go}>${row ? 'Öner' : 'Kulüp seç'}</${Button}>
  </div>`;
}
