import { html, cx, fmtMoney, useEffect, useRef, useState, reducedMotion } from '../lib.js';

/** Animates between numeric values. <NumberTicker value=${n} format=${fn} duration=700 /> */
export function NumberTicker({ value, format = (n) => String(Math.round(n)), duration = 700, class: cls }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reducedMotion() || from.current === value) { from.current = value; setShown(value); return; }
    const a = from.current, b = value, t0 = performance.now();
    let raf;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / duration), e = 1 - Math.pow(1 - k, 3);
      const cur = a + (b - a) * e;
      from.current = cur; setShown(cur);
      if (k < 1) raf = requestAnimationFrame(step); else from.current = b;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return html`<span class=${cx('ticker num', cls)}>${format(shown)}</span>`;
}

/**
 * <Money value=${12000} sign colored count compact />
 * Turkish formatting (€450K, €1,25M). `colored` tints by sign (lime/danger), default plain gold-ish text colour.
 * `count` animates changes.
 */
export function Money({ value, sign = false, colored = false, count = false, compact = true, class: cls }) {
  const f = (n) => fmtMoney(n, { sign, compact });
  const tone = colored ? (value > 0 ? 'money--pos' : value < 0 ? 'money--neg' : '') : '';
  return html`<span class=${cx('money num', tone, cls)}>${count ? html`<${NumberTicker} value=${value} format=${f} />` : f(value)}</span>`;
}
