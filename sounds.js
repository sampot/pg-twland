/**
 * Synthesized SFX — baked to short WAV blobs + HTMLAudioElement.
 * Mobile Safari：Web Audio 常被靜音鍵／自動播放政策擋下；HTMLAudio 走媒體音量較可靠。
 * Muted preference persists in localStorage.
 */

const STORAGE_KEY = "pg-twland-sfx-muted";

let muted = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
})();

/** @type {Record<string, string>} */
const urls = Object.create(null);
/** @type {Promise<void> | null} */
let bakePromise = null;
let unlocked = false;

/**
 * @param {AudioBuffer} buffer
 * @returns {Blob}
 */
function audioBufferToWavBlob(buffer) {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.getChannelData(0);
  const dataLength = samples.length * 2;
  const ab = new ArrayBuffer(44 + dataLength);
  const view = new DataView(ab);

  /** @param {number} offset @param {string} str */
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([ab], { type: "audio/wav" });
}

/**
 * @param {number} durationSec
 * @param {(ctx: OfflineAudioContext, t0: number) => void} build
 */
async function bake(durationSec, build) {
  const sr = 22050;
  const len = Math.max(1, Math.ceil(sr * durationSec));
  const ctx = new OfflineAudioContext(1, len, sr);
  build(ctx, 0);
  const rendered = await ctx.startRendering();
  return URL.createObjectURL(audioBufferToWavBlob(rendered));
}

/**
 * @param {OfflineAudioContext} ctx
 * @param {number} freq
 * @param {number} dur
 * @param {number} t0
 * @param {{ type?: OscillatorType, gain?: number, slide?: number }} [opts]
 */
function addBeep(ctx, freq, dur, t0, opts = {}) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type || "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slide) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, freq * opts.slide),
      t0 + dur,
    );
  }
  const g = opts.gain ?? 0.22;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(g, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/**
 * @param {OfflineAudioContext} ctx
 * @param {number} dur
 * @param {number} t0
 * @param {{ freq?: number, gain?: number }} [opts]
 */
function addNoise(ctx, dur, t0, opts = {}) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = opts.freq || 1200;
  filter.Q.value = 0.7;
  const gain = ctx.createGain();
  const g = opts.gain ?? 0.28;
  gain.gain.setValueAtTime(g, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

async function ensureBaked() {
  if (urls.ui) return;
  if (bakePromise) return bakePromise;
  bakePromise = (async () => {
    urls.silent = await bake(0.05, () => {
      /* empty → near-silent buffer */
    });
    urls.ui = await bake(0.08, (c, t0) => {
      addBeep(c, 660, 0.05, t0, { type: "triangle", gain: 0.18 });
    });
    urls.diceTick = await bake(0.06, (c, t0) => {
      addNoise(c, 0.04, t0, { freq: 1800, gain: 0.22 });
    });
    urls.diceLand = await bake(0.16, (c, t0) => {
      addNoise(c, 0.08, t0, { freq: 900, gain: 0.28 });
      addBeep(c, 220, 0.07, t0 + 0.02, { type: "triangle", gain: 0.18 });
    });
    urls.move = await bake(0.2, (c, t0) => {
      addBeep(c, 392, 0.07, t0, { type: "sine", gain: 0.18 });
      addBeep(c, 523, 0.09, t0 + 0.05, { type: "sine", gain: 0.15 });
    });
    urls.cardChance = await bake(0.4, (c, t0) => {
      addBeep(c, 523, 0.1, t0, { type: "triangle", gain: 0.22 });
      addBeep(c, 659, 0.12, t0 + 0.08, { type: "triangle", gain: 0.2 });
      addBeep(c, 784, 0.16, t0 + 0.16, { type: "triangle", gain: 0.18 });
    });
    urls.cardChest = await bake(0.45, (c, t0) => {
      addBeep(c, 392, 0.12, t0, { type: "sine", gain: 0.22 });
      addBeep(c, 494, 0.12, t0 + 0.1, { type: "sine", gain: 0.2 });
      addBeep(c, 587, 0.18, t0 + 0.2, { type: "sine", gain: 0.18 });
    });
    urls.good = await bake(0.35, (c, t0) => {
      addBeep(c, 523, 0.08, t0, { type: "sine", gain: 0.2 });
      addBeep(c, 659, 0.1, t0 + 0.07, { type: "sine", gain: 0.18 });
      addBeep(c, 784, 0.14, t0 + 0.14, { type: "sine", gain: 0.16 });
    });
    urls.warn = await bake(0.2, (c, t0) => {
      addBeep(c, 330, 0.12, t0, { type: "sawtooth", gain: 0.12, slide: 0.7 });
    });
    urls.build = await bake(0.18, (c, t0) => {
      addBeep(c, 440, 0.06, t0, { type: "square", gain: 0.1 });
      addBeep(c, 554, 0.08, t0 + 0.05, { type: "square", gain: 0.09 });
    });
    urls.jail = await bake(0.28, (c, t0) => {
      addBeep(c, 196, 0.18, t0, { type: "triangle", gain: 0.2, slide: 0.55 });
    });
    urls.win = await bake(0.55, (c, t0) => {
      [523, 659, 784, 1046].forEach((f, i) => {
        addBeep(c, f, 0.16, t0 + i * 0.1, { type: "sine", gain: 0.18 });
      });
    });
    urls.start = await bake(0.3, (c, t0) => {
      addBeep(c, 392, 0.1, t0, { type: "triangle", gain: 0.18 });
      addBeep(c, 523, 0.14, t0 + 0.09, { type: "triangle", gain: 0.18 });
    });
  })();
  try {
    await bakePromise;
  } finally {
    bakePromise = null;
  }
}

/** @param {string} key */
function playKey(key) {
  if (muted) return;
  const url = urls[key];
  if (!url) {
    void ensureBaked().then(() => playKey(key));
    return;
  }
  try {
    const a = new Audio(url);
    a.playsInline = true;
    a.setAttribute("playsinline", "true");
    a.preload = "auto";
    a.volume = 1;
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch {
    /* ignore */
  }
}

/**
 * Unlock media playback on a user gesture (autoplay policy + iOS).
 * Safe to call repeatedly.
 */
export function unlockAudio() {
  void (async () => {
    try {
      await ensureBaked();
      const a = new Audio(urls.silent || urls.ui);
      a.playsInline = true;
      a.setAttribute("playsinline", "true");
      a.volume = 0.01;
      await a.play();
      unlocked = true;
    } catch {
      unlocked = false;
    }
  })();
}

export function isAudioUnlocked() {
  return unlocked;
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

export const sfx = {
  ui() {
    playKey("ui");
  },
  diceTick() {
    playKey("diceTick");
  },
  diceLand() {
    playKey("diceLand");
  },
  move() {
    playKey("move");
  },
  cardChance() {
    playKey("cardChance");
  },
  cardChest() {
    playKey("cardChest");
  },
  good() {
    playKey("good");
  },
  warn() {
    playKey("warn");
  },
  build() {
    playKey("build");
  },
  jail() {
    playKey("jail");
  },
  win() {
    playKey("win");
  },
  start() {
    playKey("start");
  },
};

// Warm WAV blobs ASAP so the first gesture only needs .play().
if (typeof window !== "undefined") {
  void ensureBaked();
}
