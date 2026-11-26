import { html, cx, useEffect, useRef, useState, useCallback } from '../lib.js';
import { Icon } from './Icon.js';
import { audio } from '../fx/audio.js';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Traps Tab focus inside `ref`, focuses first focusable on mount, restores focus on unmount, calls onEsc on Escape. */
export function useFocusTrap(ref, onEsc) {
  const esc = useRef(onEsc); esc.current = onEsc;
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current;
    if (el) {
      const first = el.querySelector('[data-autofocus]') || el.querySelector(FOCUSABLE);
      (first || el).focus({ preventScroll: true });
    }
    const onKey = (e) => {
      if (e.key === 'Escape' && esc.current) { e.stopPropagation(); esc.current(); return; }
      if (e.key !== 'Tab' || !el) return;
      const list = [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (!list.length) { e.preventDefault(); return; }
      const a = list[0], z = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === a || document.activeElement === el)) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); try { prev && prev.focus && prev.focus({ preventScroll: true }); } catch {} };
  }, []);
}

/**
 * <Sheet title onClose tall>…</Sheet> — bottom sheet: backdrop, drag handle (drag down / tap backdrop / Esc closes), focus trap.
 * Mount it only while open; it animates out then calls onClose.
 */
export function Sheet({ title, onClose, tall, class: cls, children, footer }) {
  const ref = useRef(), panel = useRef();
  const [closing, setClosing] = useState(false);
  const drag = useRef(null);
  const close = useCallback(() => {
    if (closing) return;
    setClosing(true); audio.play('page');
    setTimeout(() => onClose && onClose(), 200);
  }, [closing, onClose]);
  useFocusTrap(ref, close);
  useEffect(() => { document.body.classList.add('no-scroll'); return () => document.body.classList.remove('no-scroll'); }, []);

  const down = (e) => { drag.current = { y: e.clientY, t: performance.now() }; e.currentTarget.setPointerCapture(e.pointerId); panel.current.style.transition = 'none'; };
  const move = (e) => { if (!drag.current) return; const dy = Math.max(0, e.clientY - drag.current.y); panel.current.style.transform = `translateY(${dy}px)`; };
  const up = (e) => {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.y, v = dy / (performance.now() - drag.current.t);
    drag.current = null; panel.current.style.transition = '';
    if (dy > 90 || v > 0.6) close(); else panel.current.style.transform = '';
  };
  return html`<div class=${cx('sheet-wrap', closing && 'is-closing')} ref=${ref} tabindex="-1">
    <div class="sheet-backdrop" onClick=${close}></div>
    <section class=${cx('sheet', tall && 'sheet--tall', cls)} role="dialog" aria-modal="true" aria-label=${title} ref=${panel}>
      <div class="sheet__grab" onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up}><i></i></div>
      <header class="sheet__head">
        <h2 class="sheet__title">${title}</h2>
        <button type="button" class="iconbtn" aria-label="Kapat" onClick=${close}><${Icon} name="close" size=${20} /></button>
      </header>
      <div class="sheet__body">${children}</div>
      ${footer ? html`<footer class="sheet__foot">${footer}</footer>` : null}
    </section>
  </div>`;
}

/**
 * <Overlay tone="night|gold|danger" onClose? label>…</Overlay> — full-screen layer (Masa, Son Gün, playback…).
 * Provide onClose to enable Esc-to-close; otherwise render your own exit button.
 */
export function Overlay({ onClose, label, tone, class: cls, children }) {
  const ref = useRef();
  useFocusTrap(ref, onClose);
  useEffect(() => { document.body.classList.add('no-scroll'); return () => document.body.classList.remove('no-scroll'); }, []);
  return html`<div class=${cx('overlay', tone && `overlay--${tone}`, cls)} role="dialog" aria-modal="true" aria-label=${label} ref=${ref} tabindex="-1">${children}</div>`;
}
