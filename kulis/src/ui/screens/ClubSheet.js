import { html, Sheet, EmptyState } from "../ui-kit.js";

/** STUB sheet — props: { close, ...props passed to store.ui.openSheet }. Replace the body; keep the default export. */
export default function ClubSheet({ close }) {
  return html`<${Sheet} title="Kulüp" onClose=${close}><${EmptyState} icon="shield" title="Kulüp" body="Bu sayfa henüz hazırlanıyor." /></${Sheet}>`;
}
