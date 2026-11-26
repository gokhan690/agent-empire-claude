import { html, useRef } from '../lib.js';
import { Sheet } from './Sheet.js';
import { Button } from './Button.js';
import { toast } from './Toast.js';
import { audio } from '../fx/audio.js';
import { store } from '../store.js';

/** Settings sheet (sound, save export/import, new game). Registered in app.js as sheet 'Settings'. */
export default function SettingsSheet({ close }) {
  const file = useRef();
  const exp = () => {
    const txt = store.exportJSON();
    if (!txt) return toast.error('Kaydedilecek oyun yok');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
    a.download = 'kulis-kayit.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const imp = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = store.importJSON(await f.text());
    if (r.ok) { toast.success('Kayıt yüklendi'); close(); }
    else toast.error(r.error);
    e.target.value = '';
  };
  const reset = () => { if (confirm('Tüm ilerleme silinsin ve yeni oyun başlasın mı?')) { store.reset(); close(); } };
  return html`<${Sheet} title="Ayarlar" onClose=${close}>
    <div class="stack">
      <${Button} variant="ghost" block icon=${audio.muted ? 'soundOff' : 'soundOn'} onClick=${() => { audio.toggle(); store.notify(); }} sfx=${false}>Ses: ${audio.muted ? 'Kapalı' : 'Açık'}</${Button}>
      <${Button} variant="ghost" block icon="download" onClick=${exp}>Kaydı dışa aktar</${Button}>
      <${Button} variant="ghost" block icon="upload" onClick=${() => file.current.click()}>Kaydı içe aktar</${Button}>
      <input ref=${file} type="file" accept="application/json,.json" hidden onChange=${imp} />
      <${Button} variant="danger" block icon="close" onClick=${reset}>Yeni oyun (kaydı sil)</${Button}>
    </div>
  </${Sheet}>`;
}
