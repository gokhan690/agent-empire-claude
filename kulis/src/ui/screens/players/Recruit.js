// The signing pitch: a deliberate bet. score vs threshold, promise toggles (max 3), live preview, binding warning.
import { html, useState, useEffect, cx, store, Meter, Badge, Button, Icon, Avatar, PotentialBand, audio, confetti, haptics, toast } from '../../ui-kit.js';
import { dueText, TRAITS } from './common.js';

export function useRecruit(id, enabled, onSigned) {
  const [chosen, setChosen] = useState([]);
  const [pv, setPv] = useState(null);
  const [fail, setFail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const key = chosen.join(',');
  useEffect(() => {
    if (!enabled) return;
    const r = store.preview('recruitPreview', { playerId: id, promises: chosen.map((type) => ({ type })) });
    setPv(r && r.ok ? r.preview : null);
  }, [enabled, key]);
  const toggle = (type) => {
    setFail(null);
    setChosen((c) => (c.includes(type) ? c.filter((t) => t !== type) : c.length >= 3 ? c : [...c, type]));
  };
  const sign = () => {
    if (busy) return;
    setBusy(true);
    const r = store.act('recruit', { playerId: id, promises: chosen.map((type) => ({ type })) });
    setBusy(false);
    if (!r || r.ok === false) { setFail((r && r.error) || 'İmza atılmadı'); setShake((n) => n + 1); haptics.warn(); return; }
    const ev = (r.events || []).find((e) => e.type === 'signed') || {};
    audio.play('sign'); haptics.success();
    confetti({ count: 160 });
    toast.success('İmza tamam! Yeni müvekkilin var.', { icon: 'pen' });
    onSigned(ev);
  };
  return { chosen, pv, fail, busy, shake, toggle, sign };
}

const gapText = (pv) => (pv.canSign ? 'Eşik aşıldı — imza için hazırsın.' : `Eşiğe ${Math.max(1, pv.gap)} puan eksik.`);

export function RecruitBody({ rec, vm }) {
  const { pv, chosen, toggle } = rec;
  if (!pv) return html`<div class="recruit-load muted">Teklif hesaplanıyor…</div>`;
  if (pv.error) return html`<div class="recruit-err"><${Icon} name="alert" /> ${pv.error}</div>`;
  const max = Math.max(pv.threshold * 1.35, pv.score * 1.08, 20);
  const maxPart = Math.max(...pv.parts.map((p) => Math.abs(p.value)), 1);
  return html`<div class="recruit">
    <div class="recruit-who">
      <${Avatar} id=${vm.id} size=${52} colors=${vm.club && vm.club.colors} />
      <div class="grow"><div class="recruit-who__name">${vm.name}</div>
        <div class="muted small">${vm.pos} · ${vm.age} yaş · Güç ${vm.ca}${vm.band ? ` · tavan ${vm.band.lo}–${vm.band.hi}` : ''}</div></div>
    </div>
    ${pv.rival ? html`<div class="recruit-rival"><${Icon} name="shield" size=${18} /><div><b>Rakip bir menajerin müvekkili.</b> Sözleşmesinin son sezonunda olduğu için konuşabiliyorsun; eşik daha yüksek.</div></div>` : null}

    <section class=${cx('recruit-gauge', pv.canSign ? 'is-ok' : 'is-short')}>
      <div class="recruit-gauge__nums">
        <div><span>İkna puanın</span><b class="num">${pv.score}</b></div>
        <i class="num">/</i>
        <div><span>Gereken eşik</span><b class="num">${pv.threshold}</b></div>
      </div>
      <${Meter} value=${pv.score} max=${max} threshold=${pv.threshold} thresholdLabel="Eşik" size="lg" tone=${pv.canSign ? 'lime' : 'gold'} label="İkna" valueText=${pv.canSign ? 'YETERLİ' : `−${Math.max(1, pv.gap)}`} />
      <p class="recruit-gauge__say">${gapText(pv)}</p>
    </section>

    <section class="recruit-parts">
      <div class="eyebrow">Puanın nereden geliyor</div>
      ${pv.parts.map((p) => html`<div class="recruit-part"><span>${p.label}</span><i><u style=${{ width: Math.max(4, (Math.abs(p.value) / maxPart) * 100) + '%' }} class=${cx(p.value < 0 && 'is-neg')}></u></i><b class="num">${p.value > 0 ? '+' : ''}${p.value}</b></div>`)}
      <details class="recruit-thr"><summary>Eşiği ne belirliyor?</summary>
        ${pv.thresholdParts.map((p) => html`<div class="recruit-part recruit-part--thr"><span>${p.label}</span><b class="num">${p.value}</b></div>`)}
        <p class="muted small">Yetenek ve şöhret arttıkça eşik yükselir. Daha çok izleyip tanıdıkça puanın büyür.</p>
      </details>
    </section>

    <section class="recruit-promises">
      <div class="recruit-promises__head"><div class="eyebrow">Söz ver</div><span class="num">${chosen.length}/3</span></div>
      <p class="muted small">Her söz puanını artırır ama gerçek bir yükümlülüktür. En fazla 3 söz verebilirsin.</p>
      ${pv.promiseOptions.map((o) => {
        const on = chosen.includes(o.type);
        const blocked = !!o.blocked;
        const locked = (!on && chosen.length >= 3) || blocked;
        return html`<button type="button" class=${cx('recruit-prom', on && 'is-on', locked && 'is-locked', blocked && 'is-blocked')} aria-pressed=${on ? 'true' : 'false'} disabled=${locked} onClick=${() => { audio.play(on ? 'click' : 'confirm'); toggle(o.type); }}>
          <span class="recruit-prom__box" aria-hidden="true">${on ? html`<${Icon} name="check" size=${16} strokeWidth=${3} />` : null}</span>
          <span class="recruit-prom__main">
            <span class="recruit-prom__top"><b>${o.label}</b>${o.fit && !blocked ? html`<${Badge} tone="lime">Ona uygun</${Badge}>` : null}${blocked ? html`<${Badge} tone="danger" icon="lock">Verilemez</${Badge}>` : null}</span>
            <span class="recruit-prom__text">${o.text}</span>
            <span class="recruit-prom__due"><${Icon} name="calendar" size=${12} /> Vade: ${dueText(o.due)}</span>
            ${o.warning ? html`<span class=${cx('recruit-prom__warn', blocked ? 'is-block' : 'is-warn')}><${Icon} name=${blocked ? 'lock' : 'alert'} size=${13} /> ${o.warning}</span>` : null}
          </span>
          <span class=${cx('recruit-prom__add num', o.fit && 'is-fit')}>${blocked ? '—' : '+' + o.add}</span>
        </button>`;
      })}
    </section>

    <section class="recruit-warn">
      <${Icon} name="alert" size=${20} />
      <div><b>Sözler bağlayıcıdır.</b> Tutamazsan <b class="danger">bağlılık −25</b> ve <b class="danger">itibar −3</b>. Hırslı ya da Yıldız Adayı bir oyuncu seni bırakıp gidebilir. Tutarsan bağlılık +15, itibar +2.</div>
    </section>
  </div>`;
}

export function RecruitFooter({ rec, onBack }) {
  const { pv, fail, busy, shake, sign } = rec;
  const ok = pv && !pv.error && pv.canSign;
  const noEnergy = store.S && store.S.agency.energy < 1;
  return html`<div class="recruit-foot">
    ${fail ? html`<div class="recruit-fail" key=${shake}><${Icon} name="alert" size=${16} /> ${fail}</div>` : null}
    <div class="recruit-foot__row">
      <${Button} variant="ghost" onClick=${onBack}>Vazgeç</${Button}>
      <${Button} variant=${ok ? 'gold' : 'ghost'} size="lg" icon="pen" class="grow" energy=${1} loading=${busy} disabled=${!pv || !!pv.error || noEnergy} onClick=${sign}>${ok ? 'İmzala' : 'Yine de dene'}</${Button}>
    </div>
    ${noEnergy ? html`<div class="small danger recruit-foot__hint"><${Icon} name="bolt" size=${13} /> Enerjin yok: ayı oynatınca enerji yenilenir.</div>` : null}
    ${pv && !pv.error && !pv.canSign ? html`<div class="muted small recruit-foot__hint">Puan yetmezse bir şey harcamazsın; ama bir söz daha eklemek ya da oyuncuyu izlemek işe yarar.</div>` : null}
  </div>`;
}

export function SignedMoment({ ev, vm, chosen, pv, onOpen }) {
  const sel = (pv && pv.promiseOptions ? pv.promiseOptions : []).filter((o) => chosen.includes(o.type));
  return html`<div class="recruit-done">
    <div class="recruit-done__burst" aria-hidden="true"></div>
    <div class="eyebrow gold">Temsil sözleşmesi</div>
    <h2 class="recruit-done__title t-display">İmzalandı</h2>
    <${Avatar} id=${vm.id} size=${96} ring colors=${vm.club && vm.club.colors} />
    <div class="recruit-done__name">${vm.name}</div>
    <div class="recruit-done__facts">
      <div><b class="num">%${ev.commissionPct ?? '—'}</b><span>Komisyon</span></div>
      <div><b class="num">${ev.endSeason ?? '—'}. sezon</b><span>Sözleşme sonu</span></div>
      <div><b class="num">${chosen.length}</b><span>Söz</span></div>
    </div>
    ${sel.length ? html`<div class="recruit-done__proms">${sel.map((o) => html`<div><${Icon} name="handshake" size=${14} /> ${o.label} — ${dueText(o.due)}</div>`)}</div>` : null}
    <${Button} size="lg" block icon="users" onClick=${onOpen}>Müvekkil dosyasını aç</${Button}>
  </div>`;
}
