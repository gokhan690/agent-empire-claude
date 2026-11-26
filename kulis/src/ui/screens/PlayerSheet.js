import { html, Sheet, EmptyState } from "../ui-kit.js";

/** STUB sheet — props: { close, ...props passed to store.ui.openSheet }. Replace the body; keep the default export. */
export default function PlayerSheet({ close }) {
  return html`<${Sheet} title="Oyuncu" onClose=${close}><${EmptyState} icon="users" title="Oyuncu" body="Bu sayfa henüz hazırlanıyor." /></${Sheet}>`;
}
