// navigator.vibrate wrappers (guarded; no-op where unsupported or when muted).
import { audio } from './audio.js';
const v = (p) => { try { if (!audio.muted && navigator.vibrate) navigator.vibrate(p); } catch {} };
export const haptics = {
  tap: () => v(8),
  success: () => v([12, 40, 18]),
  warn: () => v([30, 40, 30]),
  heavy: () => v(40),
};
