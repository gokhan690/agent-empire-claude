import { html, Overlay, EmptyState, Button } from '../ui-kit.js';

/** STUB overlay — props: { close, ...props passed to store.ui.openOverlay }. Replace the body; keep the default export. */
export default function Playback({ close }) {
  return html`<${Overlay} label="Ay Özeti" onClose=${close}>
    <div class="screen-pad"><${EmptyState} icon="whistle" title="Ay Özeti" body="Maç sonuçları ve rapor burada olacak." action=${html`<${Button} variant="ghost" onClick=${close}>Kapat</${Button}>`} /></div>
  </${Overlay}>`;
}
