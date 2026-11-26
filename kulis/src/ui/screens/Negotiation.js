import { html, Overlay, EmptyState, Button } from '../ui-kit.js';

/** STUB overlay — props: { close, ...props passed to store.ui.openOverlay }. Replace the body; keep the default export. */
export default function Negotiation({ close }) {
  return html`<${Overlay} label="Masa" onClose=${close}>
    <div class="screen-pad"><${EmptyState} icon="handshake" title="Masa" body="Pazarlık masası burada olacak." action=${html`<${Button} variant="ghost" onClick=${close}>Kapat</${Button}>`} /></div>
  </${Overlay}>`;
}
