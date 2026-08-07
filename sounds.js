/**
 * Lightweight synthesized SFX (Web Audio) — no asset files.
 * Muted preference persists in localStorage.
 */

const STORAGE_KEY = "pg-twland-sfx-muted";

/** @type {AudioContext | null} */
let ctx = null;
let muted = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
})();

function getCtx() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Unlock audio on first user gesture (autoplay policy). */
export function unlockAudio() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
}

export function isMuted() {
  return muted;
}

export function setMuted(next) {
  muted = Boolean(next);
  try {
    localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (!muted) unlockAudio();
}

export function toggleMuted() {
  setMuted(!muted);
  return muted;
}

/**
 * @param {number} freq
 * @param {number} dur
 * @param {{ type?: OscillatorType, gain?: number, when?: number, slide?: number }} [opts]
 */
function beep(freq, dur, opts = {}) {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + (opts.when || 0);
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = opts.type || "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slide) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, freq * opts.slide),
      t0 + dur,
    );
  }
  const g = opts.gain ?? 0.08;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(g, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Soft noise burst (dice / land). */
function noiseBurst(dur, opts = {}) {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + (opts.when || 0);
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = opts.freq || 1200;
  filter.Q.value = 0.7;
  const gain = c.createGain();
  const g = opts.gain ?? 0.1;
  gain.gain.setValueAtTime(g, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export const sfx = {
  ui() {
    beep(660, 0.05, { type: "triangle", gain: 0.04 });
  },
  diceTick() {
    noiseBurst(0.04, { freq: 1800, gain: 0.06 });
  },
  diceLand() {
    noiseBurst(0.08, { freq: 900, gain: 0.09 });
    beep(220, 0.07, { type: "triangle", gain: 0.05, when: 0.02 });
  },
  move() {
    beep(392, 0.07, { type: "sine", gain: 0.05 });
    beep(523, 0.09, { type: "sine", gain: 0.04, when: 0.05 });
  },
  cardChance() {
    beep(523, 0.1, { type: "triangle", gain: 0.07 });
    beep(659, 0.12, { type: "triangle", gain: 0.06, when: 0.08 });
    beep(784, 0.16, { type: "triangle", gain: 0.05, when: 0.16 });
  },
  cardChest() {
    beep(392, 0.12, { type: "sine", gain: 0.07 });
    beep(494, 0.12, { type: "sine", gain: 0.06, when: 0.1 });
    beep(587, 0.18, { type: "sine", gain: 0.05, when: 0.2 });
  },
  good() {
    beep(523, 0.08, { type: "sine", gain: 0.06 });
    beep(659, 0.1, { type: "sine", gain: 0.055, when: 0.07 });
    beep(784, 0.14, { type: "sine", gain: 0.05, when: 0.14 });
  },
  warn() {
    beep(330, 0.12, { type: "sawtooth", gain: 0.035, slide: 0.7 });
  },
  build() {
    beep(440, 0.06, { type: "square", gain: 0.03 });
    beep(554, 0.08, { type: "square", gain: 0.028, when: 0.05 });
  },
  jail() {
    beep(196, 0.18, { type: "triangle", gain: 0.06, slide: 0.55 });
  },
  win() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => {
      beep(f, 0.16, { type: "sine", gain: 0.055, when: i * 0.1 });
    });
  },
  start() {
    beep(392, 0.1, { type: "triangle", gain: 0.05 });
    beep(523, 0.14, { type: "triangle", gain: 0.05, when: 0.09 });
  },
};
