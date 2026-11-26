import { html, cx, useEffect, useState } from '../lib.js';
import { Icon } from './Icon.js';
import { audio } from '../fx/audio.js';

let items = [], nid = 1;
const subs = new Set();
const emit = () => subs.forEach((f) => f(items));
const ICONS = { success: 'check', error: 'alert', info: 'info', money: 'cash', bad: 'alert' };

/**
 * toast(text, { tone: 'info|success|error|money|bad', icon, duration=3200, sfx })
 * toast.success(text) / toast.error(text) / toast.info(text) / toast.money(text)
 */
export function toast(text, o = {}) {
  const tone = o.tone || 'info';
  const t = { id: nid++, text, tone, icon: o.icon || ICONS[tone] || 'info' };
  items = [...items.slice(-3), t]; emit();
  const sfx = o.sfx === undefined ? { error: 'error', success: 'confirm', money: 'coin', bad: 'badnews' }[tone] : o.sfx;
  if (sfx) audio.play(sfx);
  setTimeout(() => dismiss(t.id), o.duration || 3200);
  return t.id;
}
toast.success = (t, o) => toast(t, { ...o, tone: 'success' });
toast.error = (t, o) => toast(t, { ...o, tone: 'error' });
toast.info = (t, o) => toast(t, { ...o, tone: 'info' });
toast.money = (t, o) => toast(t, { ...o, tone: 'money' });
export function dismiss(id) { items = items.filter((t) => t.id !== id); emit(); }

export function ToastHost() {
  const [list, setList] = useState(items);
  useEffect(() => { subs.add(setList); return () => subs.delete(setList); }, []);
  return html`<div class="toasts" role="status" aria-live="polite">
    ${list.map((t) => html`<div class=${cx('toast', `toast--${t.tone}`)} key=${t.id} onClick=${() => dismiss(t.id)}><${Icon} name=${t.icon} size=${18} /><span>${t.text}</span></div>`)}
  </div>`;
}
