import { html, Overlay, EmptyState, Button } from '../ui-kit.js';

/** STUB overlay — props: { close, ...props passed to store.ui.openOverlay }. Replace the body; keep the default export. */
export default function Ceremony({ close }) {
  return html`<${Overlay} label="İmza Töreni" onClose=${close}>
    <div class="screen-pad"><${EmptyState} icon="pen" title="İmza Töreni" body="İmza töreni burada olacak." action=${html`<${Button} variant="ghost" onClick=${close}>Kapat</${Button}>`} /></div>
  </${Overlay}>`;
}
