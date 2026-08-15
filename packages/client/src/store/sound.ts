/**
 * Synthesised sound effects.
 *
 * Everything is generated with the WebAudio API instead of shipping audio
 * files: no assets to license, nothing to load, and the pitch can react to the
 * game (bids rise in pitch as the price climbs, which feels great in a bidding
 * war).
 */

let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = localStorage.getItem('gla.muted') === '1';
} catch {
  /* ignore */
}

function audio(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Browsers require a user gesture before audio may play. */
export function unlockAudio() {
  audio();
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem('gla.muted', value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

interface ToneOptions {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  /** Frequency to glide to over the duration. */
  slideTo?: number;
  delay?: number;
}

function tone({ freq, duration, type = 'sine', gain = 0.18, slideTo, delay = 0 }: ToneOptions) {
  const ac = audio();
  if (!ac) return;

  const start = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const env = ac.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + duration);

  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(env).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/** Filtered white noise - the body of impacts like the hammer and coins. */
function noise(duration: number, gain = 0.2, filterFreq = 1200, delay = 0) {
  const ac = audio();
  if (!ac) return;

  const start = ac.currentTime + delay;
  const frames = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);

  const src = ac.createBufferSource();
  src.buffer = buffer;

  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterFreq, start);

  const env = ac.createGain();
  env.gain.setValueAtTime(gain, start);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  src.connect(filter).connect(env).connect(ac.destination);
  src.start(start);
}

export const sfx = {
  /** Category banner / starting-bid stamp. */
  stamp() {
    noise(0.18, 0.25, 900);
    tone({ freq: 160, duration: 0.22, type: 'square', gain: 0.14, slideTo: 70 });
  },

  /** Character reveal beat. */
  reveal() {
    tone({ freq: 320, duration: 0.35, type: 'triangle', gain: 0.12, slideTo: 640 });
    tone({ freq: 480, duration: 0.4, type: 'sine', gain: 0.08, delay: 0.08 });
  },

  /** Bid accepted - pitch climbs with the number of bids for rising tension. */
  bid(bidCount: number) {
    const base = 420 + Math.min(bidCount, 14) * 28;
    tone({ freq: base, duration: 0.12, type: 'square', gain: 0.1 });
    tone({ freq: base * 1.5, duration: 0.1, type: 'sine', gain: 0.06, delay: 0.03 });
  },

  /** Countdown heartbeat: lower and harder as it approaches zero. */
  tick(value: number) {
    const pitch = 210 - (5 - value) * 18;
    tone({ freq: pitch, duration: 0.13, type: 'sine', gain: 0.24, slideTo: pitch * 0.6 });
    noise(0.06, 0.12, 500);
  },

  hammer() {
    noise(0.3, 0.4, 2200);
    tone({ freq: 90, duration: 0.4, type: 'square', gain: 0.22, slideTo: 40 });
    tone({ freq: 660, duration: 0.5, type: 'triangle', gain: 0.1, delay: 0.06 });
  },

  whoosh() {
    tone({ freq: 700, duration: 0.4, type: 'sine', gain: 0.1, slideTo: 120 });
    noise(0.35, 0.1, 700);
  },

  coins() {
    for (let i = 0; i < 6; i++) {
      tone({ freq: 900 + Math.random() * 700, duration: 0.14, type: 'triangle', gain: 0.07, delay: i * 0.055 });
    }
  },

  notify() {
    tone({ freq: 660, duration: 0.12, type: 'sine', gain: 0.12 });
    tone({ freq: 880, duration: 0.16, type: 'sine', gain: 0.1, delay: 0.1 });
  },

  error() {
    tone({ freq: 180, duration: 0.22, type: 'sawtooth', gain: 0.12, slideTo: 120 });
  },

  /** The disappointing trap reveal. */
  trombone() {
    tone({ freq: 300, duration: 0.9, type: 'sawtooth', gain: 0.12, slideTo: 110 });
  },

  fanfare() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      tone({ freq, duration: 0.5, type: 'triangle', gain: 0.16, delay: i * 0.13 });
      tone({ freq: freq / 2, duration: 0.5, type: 'sine', gain: 0.1, delay: i * 0.13 });
    });
    noise(0.6, 0.12, 3000, 0.5);
  },
};
