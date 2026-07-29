// Tiny WebAudio synth for satisfying feedback — no external files needed.
let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function setMuted(m: boolean) { muted = m; }
export function isMuted() { return muted; }

function beep(freq: number, dur = 0.08, type: OscillatorType = "sine", gain = 0.15, slide = 0) {
  if (muted) return;
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), a.currentTime + dur);
  g.gain.setValueAtTime(0, a.currentTime);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur + 0.02);
}

export const sfx = {
  deal: () => beep(280, 0.05, "triangle", 0.08, -120),
  flip: () => beep(520, 0.06, "square", 0.06),
  correct: () => {
    beep(660, 0.09, "triangle", 0.12);
    setTimeout(() => beep(990, 0.12, "triangle", 0.12), 70);
  },
  wrong: () => {
    beep(180, 0.14, "sawtooth", 0.14, -60);
    setTimeout(() => beep(120, 0.18, "sawtooth", 0.12, -40), 90);
  },
  combo: (n: number) => {
    const f = 440 + Math.min(1200, n * 40);
    beep(f, 0.09, "triangle", 0.1);
  },
  click: () => beep(700, 0.03, "square", 0.06),
  gameover: () => {
    [440, 330, 220, 165].forEach((f, i) => setTimeout(() => beep(f, 0.16, "sawtooth", 0.12), i * 120));
  },
  start: () => {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.1, "triangle", 0.1), i * 70));
  },
  hint: () => beep(880, 0.05, "sine", 0.06),
};
