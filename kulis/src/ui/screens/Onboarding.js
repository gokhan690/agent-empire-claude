// Onboarding overlay: atmospheric title screen -> one setup screen -> newGame -> Hub.
import { html, useState, Overlay, Button, Icon, store, navigate, audio, haptics, toast } from '../ui-kit.js';
import { BAL } from '../../engine/constants.js';

const AGENTS = ['Kemal Arslan', 'Cengiz Demirtaş', 'Selim Karaca', 'Murat Yalçın', 'Barış Tekin', 'Orhan Aksoy', 'Tolga Ersoy', 'Ferhat Gündüz', 'Emre Bozkurt', 'Volkan Işık', 'Derya Kaya', 'Aylin Sönmez'];
const AGENCIES = ['Gece Maçı Menajerlik', 'Kulis Spor Yönetimi', 'Altın Ayak Menajerlik', 'Mavi Hat Spor', 'Kuzey Yıldızı Menajerlik', 'Tribün Menajerlik', 'Gol Hattı Menajerlik', 'Kırmızı Kart Spor', 'Üçüncü Yarı Menajerlik', 'Ofsayt Spor Yönetimi'];
const pick = (a, not) => { let v; do { v = a[Math.floor(Math.random() * a.length)]; } while (v === not && a.length > 1); return v; };

function Title({ onNew, onContinue, hasSave }) {
  return html`<div class="onboarding-title">
    <div class="onboarding-lights" aria-hidden="true"><i></i><i></i></div>
    <svg class="onboarding-pitch" viewBox="0 0 400 400" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <circle cx="200" cy="200" r="150" stroke-dasharray="4 8"/><circle cx="200" cy="200" r="60"/><circle cx="200" cy="200" r="4" fill="currentColor"/>
    </svg>
    <div class="onboarding-title__main">
      <div class="eyebrow onboarding-kick">Futbol menajerliği oyunu</div>
      <h1 class="onboarding-word t-display">KULİS</h1>
      <div class="onboarding-rule"><i></i></div>
      <p class="onboarding-tag">Oyuncu bul, imzala, büyük kulüplere sat, komisyonunu al.</p>
    </div>
    <div class="onboarding-title__cta stack">
      <${Button} size="lg" block icon="play" onClick=${onNew} data-autofocus>Yeni Kariyer</${Button}>
      ${hasSave ? html`<${Button} size="lg" block variant="ghost" icon="download" onClick=${onContinue}>Devam Et</${Button}>` : null}
      <div class="onboarding-foot small muted">${BAL.careerSeasons} sezon · 4 rakip ajans · tek amaç: zirve</div>
    </div>
  </div>`;
}

function Setup({ onBack, onStart }) {
  const [agent, setAgent] = useState(() => pick(AGENTS));
  const [agency, setAgency] = useState(() => pick(AGENCIES));
  const [seed] = useState(() => 1 + Math.floor(Math.random() * 2147483000));
  const shuffle = () => { audio.play('whoosh'); setAgent((a) => pick(AGENTS, a)); setAgency((a) => pick(AGENCIES, a)); };
  const start = () => onStart({ seed, agentName: agent.trim() || 'Ajan', agencyName: agency.trim() || 'Kulis Menajerlik' });
  return html`<div class="onboarding-setup stack">
    <header class="onboarding-head">
      <button type="button" class="onboarding-back" onClick=${() => { audio.play('page'); onBack(); }} aria-label="Geri"><${Icon} name="chevronLeft" size=${22} /></button>
      <div><div class="eyebrow">Yeni kariyer</div><h2 class="t-display onboarding-h2">Ajansını kur</h2></div>
    </header>
    <section class="stack onboarding-sec">
      <div class="row row--between"><span class="eyebrow">Kimlik</span>
        <button type="button" class="onboarding-shuffle" onClick=${shuffle}><${Icon} name="dice" size=${16} /> Rastgele</button></div>
      <label class="onboarding-field"><span>Menajer adı</span>
        <input class="onboarding-input" value=${agent} maxlength="26" autocomplete="off" onInput=${(e) => setAgent(e.currentTarget.value)} /></label>
      <label class="onboarding-field"><span>Ajans adı</span>
        <input class="onboarding-input" value=${agency} maxlength="30" autocomplete="off" onInput=${(e) => setAgency(e.currentTarget.value)} /></label>
    </section>
    <div class="onboarding-go stack">
      <${Button} size="lg" block icon="play" onClick=${start} data-testid="start">Kariyere Başla</${Button}>
    </div>
  </div>`;
}

export default function Onboarding({ close }) {
  const [step, setStep] = useState('title');
  const hasSave = store.hasSave();
  const go = (opts) => {
    const r = store.newGame(opts);
    if (!r.ok) { toast.error(r.error || 'Oyun başlatılamadı'); return; }
    audio.play('sign'); haptics.success();
    close(); navigate('hub');
  };
  const cont = () => { const r = store.load(); if (!r.ok) { toast.error(r.error); return; } audio.play('confirm'); close(); navigate('hub'); store.restore(); };
  return html`<${Overlay} label="KULİS" tone="night" class="onboarding">
    ${step === 'title' ? html`<${Title} hasSave=${hasSave} onNew=${() => { audio.play('whoosh'); setStep('setup'); }} onContinue=${cont} />`
      : html`<${Setup} onBack=${() => setStep('title')} onStart=${go} />`}
  </${Overlay}>`;
}
