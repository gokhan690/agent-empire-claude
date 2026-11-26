// WebAudio-synthesised SFX only. API: audio.play(name), audio.muted, audio.setMuted(b), audio.toggle(), audio.unlock(), audio.onChange(fn)
// Names: click confirm error coin whoosh page sign goal tick levelup badnews
const KEY = 'kulis-muted';
let ctx = null, master = null, noiseBuf = null;
let muted = false;
try { muted = localStorage.getItem(KEY) === '1'; } catch {}
const listeners = new Set();

function ensure() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
  return ctx;
}
function unlock() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}
['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, unlock, { passive: true }));

/** tone: oscillator with ADSR-ish envelope. f2 = glide target. */
function tone({ f, f2, t = 0, dur = 0.15, type = 'sine', gain = 0.3, attack = 0.005, vib }) {
  const c = ctx, t0 = c.currentTime + t;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = vib; lg.gain.value = f * 0.01; l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + 0.05); }
  o.start(t0); o.stop(t0 + dur + 0.05);
}
/** noise burst through a filter (optionally swept). */
function noise({ t = 0, dur = 0.2, type = 'bandpass', f = 1000, f2, q = 1, gain = 0.3, attack = 0.01, hold = 0, lfo }) {
  const c = ctx, t0 = c.currentTime + t;
  const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const flt = c.createBiquadFilter(); flt.type = type; flt.Q.value = q;
  flt.frequency.setValueAtTime(f, t0);
  if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  if (hold) g.gain.setValueAtTime(gain, t0 + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(flt); flt.connect(g); g.connect(master);
  if (lfo) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = lfo.rate; lg.gain.value = lfo.depth; l.connect(lg); lg.connect(g.gain); l.start(t0); l.stop(t0 + dur); }
  s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
}
const bell = (f, t, gain = 0.18, dur = 0.9) => { tone({ f, t, dur, gain, type: 'sine' }); tone({ f: f * 2.76, t, dur: dur * 0.5, gain: gain * 0.35, type: 'sine' }); };

const SOUNDS = {
  click: () => tone({ f: 900, f2: 520, dur: 0.05, type: 'triangle', gain: 0.22 }),
  confirm: () => { tone({ f: 523, dur: 0.1, type: 'triangle', gain: 0.25 }); tone({ f: 784, t: 0.07, dur: 0.18, type: 'triangle', gain: 0.25 }); },
  error: () => { tone({ f: 170, dur: 0.12, type: 'square', gain: 0.14 }); tone({ f: 140, t: 0.14, dur: 0.18, type: 'square', gain: 0.14 }); },
  coin: () => { tone({ f: 1318, dur: 0.07, type: 'square', gain: 0.12 }); tone({ f: 1760, t: 0.06, dur: 0.35, type: 'square', gain: 0.12 }); tone({ f: 3520, t: 0.06, dur: 0.2, gain: 0.05 }); },
  whoosh: () => noise({ dur: 0.38, f: 300, f2: 3200, q: 0.9, gain: 0.3, attack: 0.12 }),
  page: () => noise({ dur: 0.12, type: 'highpass', f: 2500, gain: 0.12, attack: 0.01 }),
  sign: () => {
    noise({ dur: 0.5, f: 4200, q: 3, gain: 0.16, attack: 0.04, lfo: { rate: 17, depth: 0.08 } });
    bell(1319, 0.55); bell(1976, 0.66, 0.14, 1.1);
  },
  goal: () => {
    noise({ dur: 2.2, type: 'bandpass', f: 500, f2: 900, q: 0.5, gain: 0.5, attack: 0.5, hold: 0.5, lfo: { rate: 6, depth: 0.1 } });
    noise({ dur: 2.0, type: 'highpass', f: 2200, gain: 0.08, attack: 0.4 });
    tone({ f: 2900, t: 0.05, dur: 0.5, type: 'sine', gain: 0.07, vib: 28 });
  },
  tick: () => tone({ f: 1100, f2: 700, dur: 0.035, type: 'square', gain: 0.1 }),
  levelup: () => [523, 659, 784, 1047].forEach((f, i) => tone({ f, t: i * 0.09, dur: 0.22, type: 'triangle', gain: 0.24 })),
  badnews: () => { tone({ f: 330, dur: 0.28, type: 'sawtooth', gain: 0.1 }); tone({ f: 247, t: 0.22, dur: 0.5, type: 'sawtooth', gain: 0.1 }); },
};

export const audio = {
  names: Object.keys(SOUNDS),
  get muted() { return muted; },
  setMuted(b) { muted = !!b; try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch {} listeners.forEach((f) => f(muted)); },
  toggle() { audio.setMuted(!muted); if (!muted) audio.play('click'); return muted; },
  unlock,
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  play(name) {
    if (muted) return;
    const fn = SOUNDS[name];
    if (!fn) return;
    try {
      const c = ensure();
      if (!c) return;
      if (c.state === 'suspended') { c.resume().then(() => fn()).catch(() => {}); return; }
      fn();
    } catch {}
  },
};
