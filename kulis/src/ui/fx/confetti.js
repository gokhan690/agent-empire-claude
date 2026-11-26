// Canvas confetti. confetti({ x, y, count, colors, spread, power, duration }) — x/y in viewport px (default top-centre-ish). Returns a Promise.
import { reducedMotion } from '../lib.js';
const COLORS = ['#3DDC84', '#F5C451', '#EEF4EF', '#5AB0FF', '#FF5D5D'];
export function confetti(o = {}) {
  if (reducedMotion()) return Promise.resolve();
  const W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  const { x = W / 2, y = H * 0.35, count = 120, colors = COLORS, power = 11, duration = 2600, gravity = 0.32 } = o;
  const cv = document.createElement('canvas');
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:300';
  document.body.appendChild(cv);
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const ps = Array.from({ length: count }, () => {
    const a = Math.random() * Math.PI * 2, v = power * (0.35 + Math.random() * 0.75);
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - power * 0.5, w: 5 + Math.random() * 6, h: 3 + Math.random() * 5,
      r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[(Math.random() * colors.length) | 0], t: Math.random() * 6 };
  });
  const t0 = performance.now();
  return new Promise((res) => {
    (function frame(now) {
      const k = (now - t0) / duration;
      g.clearRect(0, 0, W, H);
      for (const p of ps) {
        p.vy += gravity; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.t += 0.2;
        g.save(); g.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.6) / 0.4);
        g.translate(p.x, p.y); g.rotate(p.r); g.scale(1, Math.cos(p.t)); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
      }
      if (k < 1) requestAnimationFrame(frame); else { cv.remove(); res(); }
    })(t0);
  });
}
