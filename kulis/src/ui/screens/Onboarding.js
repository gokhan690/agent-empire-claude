import { html, Overlay, EmptyState, Button, store, navigate } from '../ui-kit.js';

/** STUB overlay — minimal "start" so the shell is playable. Replace with the real onboarding (name, agency, archetype). */
export default function Onboarding({ close }) {
  const start = () => {
    const r = store.newGame({ agentName: 'Ajan', agencyName: 'Kulis Menajerlik', archetype: 'mahalle' });
    if (r.ok) { close(); navigate('hub'); }
  };
  return html`<${Overlay} label="Hoş geldin" tone="night">
    <div class="screen-pad"><${EmptyState} icon="ball" title="KULİS" body="Menajerliğe hoş geldin. (Kurulum ekranı henüz hazırlanıyor.)"
      action=${html`<${Button} size="lg" onClick=${start}>Oyuna Başla</${Button}>`} /></div>
  </${Overlay}>`;
}
