// Small Web Audio synth. Starts only after the first user gesture.
let ctx: AudioContext | null = null;
let muted = (() => { try { return localStorage.getItem('onuw:mute') === '1'; } catch { return false; } })();

export const isMuted = () => muted;
export function setMuted(m: boolean) { muted = m; try { localStorage.setItem('onuw:mute', m ? '1' : '0'); } catch { /* ignore */ } }

export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { ctx = null; }
}

function env(g: GainNode, t: number, a: number, peak: number, d: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', peak = 0.18, at = 0, glide?: number) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
  env(g, t, 0.02, peak, dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur: number, peak = 0.2, at = 0, lp = 1200, hp = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + at;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
  const g = ctx.createGain(); env(g, t, 0.01, peak, dur);
  let node: AudioNode = src.connect(f);
  if (hp) { const h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; node = node.connect(h); }
  node.connect(g).connect(ctx.destination); src.start(t); src.stop(t + dur + 0.05);
}

export const sfx = {
  howl() { tone(330, 0.5, 'sawtooth', 0.05, 0, 520); tone(520, 1.6, 'sine', 0.12, 0.45, 300); tone(260, 1.6, 'triangle', 0.05, 0.45, 180); },
  chime() { tone(880, 0.9, 'sine', 0.1); tone(1320, 0.9, 'sine', 0.06, 0.08); },
  drum() { tone(110, 0.35, 'sine', 0.35, 0, 45); noise(0.12, 0.12, 0, 600); },
  slash() { noise(0.25, 0.18, 0, 6000, 1800); },
  dawn() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.9, 'triangle', 0.08, i * 0.12)); },
  herald() { tone(659, 0.18, 'square', 0.05); tone(880, 0.35, 'square', 0.05, 0.14); },
  click() { tone(1200, 0.05, 'square', 0.03); },
  whoosh() { noise(0.45, 0.14, 0, 2500, 400); },
  splat() { noise(0.25, 0.3, 0, 900); tone(140, 0.2, 'sine', 0.2, 0, 60); },
  swap() { tone(600, 0.15, 'triangle', 0.08, 0, 900); tone(900, 0.15, 'triangle', 0.08, 0.15, 600); },
  reveal() { tone(392, 0.25, 'triangle', 0.08); tone(587, 0.5, 'triangle', 0.08, 0.12); },
  bow() { tone(200, 0.12, 'sawtooth', 0.08, 0, 900); noise(0.3, 0.15, 0.1, 4000, 1500); },
  gavel() { tone(180, 0.15, 'square', 0.12); tone(180, 0.15, 'square', 0.12, 0.2); },
  win() { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.6, 'triangle', 0.08, i * 0.1)); },
  lose() { [392, 349, 311, 262].forEach((f, i) => tone(f, 0.6, 'triangle', 0.08, i * 0.16)); },
  tick() { tone(1500, 0.04, 'square', 0.025); },
};
