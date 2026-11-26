import { html, Overlay, EmptyState, Button } from '../ui-kit.js';

/** STUB overlay — props: { close, ...props passed to store.ui.openOverlay }. Replace the body; keep the default export. */
export default function SeasonEnd({ close }) {
  return html`<${Overlay} label="Sezon Sonu" onClose=${close}>
    <div class="screen-pad"><${EmptyState} icon="trophy" title="Sezon Sonu" body="Sezon değerlendirmesi burada olacak." action=${html`<${Button} variant="ghost" onClick=${close}>Kapat</${Button}>`} /></div>
  </${Overlay}>`;
}
