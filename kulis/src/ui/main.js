import { render, html } from './lib.js';
import { App } from './app.js';
import { store } from './store.js';
import { currentRoute, navigate } from './router.js';

(async function boot() {
  const ok = await store.init();
  if (ok) {
    if (store.hasSave()) { const r = store.load(); if (!r.ok) console.warn(r.error); else store.restore(); }
    if (!store.S) store.ui.overlay = { name: 'Onboarding', props: {}, key: 1 };
  }
  if (!currentRoute()) navigate(ok ? 'hub' : 'gallery');
  render(html`<${App} />`, document.getElementById('app'));
  document.documentElement.classList.add('ready');
})();
