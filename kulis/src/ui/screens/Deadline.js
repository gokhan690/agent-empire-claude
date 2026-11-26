import { html, Overlay, EmptyState, Button } from '../ui-kit.js';

/** STUB overlay — props: { close, ...props passed to store.ui.openOverlay }. Replace the body; keep the default export. */
export default function Deadline({ close }) {
  return html`<${Overlay} label="Son Gün" onClose=${close}>
    <div class="screen-pad"><${EmptyState} icon="clock" title="Son Gün" body="Transfer son günü burada olacak." action=${html`<${Button} variant="ghost" onClick=${close}>Kapat</${Button}>`} /></div>
  </${Overlay}>`;
}
