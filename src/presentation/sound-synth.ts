import type { MaterialId } from '../core/materials';

/**
 * Procedural sound design on plain Web Audio, so it works offline with no
 * audio files. It runs on any BaseAudioContext, so the same code plays live
 * and renders offline for listening tests.
 *
 * Signal path: voice → stereo pan → bus → (dry + city reverb) → saturation →
 * compressor → output. Saturation adds harmonics to the sub-bass so the thump
 * is still felt on phone speakers that cannot reproduce it.
 */
export class SoundSynth {
  private readonly white: AudioBuffer;
  private readonly brown: AudioBuffer;
  private readonly bus: GainNode;
  private readonly reverbSend: GainNode;

  constructor(
    private readonly ctx: BaseAudioContext,
    output: AudioNode,
    private readonly rng: () => number = Math.random,
  ) {
    this.white = this.noiseBuffer('white', 2);
    this.brown = this.noiseBuffer('brown', 4);

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.knee.value = 8;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    compressor.connect(output);

    const saturate = ctx.createWaveShaper();
    saturate.curve = softClip(2.2);
    saturate.oversample = '2x';
    saturate.connect(compressor);

    this.bus = ctx.createGain();
    this.bus.gain.value = 0.7;
    this.bus.connect(saturate);

    // Outdoor city reverb: early slap-back from buildings, then a long low tail.
    const reverb = ctx.createConvolver();
    reverb.buffer = this.cityImpulse(2.6);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.45;
    reverb.connect(reverbGain).connect(saturate);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 1;
    this.reverbSend.connect(reverb);
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  /** `power` 1 = standard charge; `pan` -1 (left) .. 1 (right). */
  explosion(power: number, pan = 0, at = this.ctx.currentTime): void {
    const r = this.rng;
    const p = Math.min(1.3, power);
    const out = this.voice(pan, 0.4);
    // 1. Snap: the supersonic crack at the front of the blast.
    this.noise(out, at, { color: 'white', filter: 'highpass', from: 1200, to: 900, attack: 0.001, decay: 0.03, gain: 0.8 * p });
    // 2. Body: a roar that loses its highs as the fireball expands.
    this.noise(out, at, { color: 'brown', filter: 'lowpass', from: 2600 + r() * 600, to: 160, sweep: 0.9, attack: 0.003, hold: 0.05, decay: 1.7, gain: 1.1 * p, q: 0.6 });
    // 3. Sub thump, saturated so it survives small speakers.
    this.tone(out, at, { type: 'sine', from: 78 + r() * 8, to: 30, sweep: 0.35, attack: 0.002, decay: 0.55, gain: 1.0 * p });
    // 4. Chest punch around 120 Hz.
    this.noise(out, at, { color: 'brown', filter: 'bandpass', from: 140, to: 90, attack: 0.002, decay: 0.3, gain: 0.9 * p, q: 1.2 });
    // 5. Rolling rumble that lingers between the buildings.
    this.noise(out, at + 0.04, { color: 'brown', filter: 'lowpass', from: 140, to: 70, attack: 0.08, decay: 2.8, gain: 0.55 * p });
    // 6. Debris raining down: sparse crackles that thin out over time.
    for (let i = 0; i < 28; i++) {
      const t = at + 0.06 + Math.pow(r(), 1.8) * 1.5;
      const f = 1500 + r() * 4000;
      const grain = this.voice(pan + (r() - 0.5) * 0.8, 0.5);
      this.noise(grain, t, { color: 'white', filter: 'bandpass', from: f, to: f, attack: 0.001, decay: 0.006 + r() * 0.02, gain: (0.06 + r() * 0.12) * p, q: 2 });
    }
  }

  /** A bomb's fall: a long whistle sliding down in pitch. */
  whistle(pan = 0): void {
    const at = this.ctx.currentTime;
    const out = this.voice(pan, 0.3);
    this.tone(out, at, { type: 'sine', from: 1500, to: 380, sweep: 1.6, attack: 0.05, decay: 1.6, gain: 0.06 });
  }

  carWreck(pan = 0): void {
    const at = this.ctx.currentTime;
    const out = this.voice(pan, 0.35);
    this.noise(out, at, { color: 'white', filter: 'bandpass', from: 1800, to: 600, sweep: 0.25, attack: 0.002, decay: 0.35, gain: 0.5, q: 1.5 });
    this.metal(out, at, 0.25, 180);
  }

  shatter(material: MaterialId, size: number, pan = 0): void {
    const at = this.ctx.currentTime;
    const r = this.rng;
    const out = this.voice(pan, 0.3);
    const s = Math.min(1, size);
    switch (material) {
      case 'wood':
        // Splintering crack and a hollow knock.
        this.noise(out, at, { color: 'white', filter: 'bandpass', from: 2200, to: 1200, attack: 0.001, decay: 0.09, gain: 0.35 + 0.3 * s, q: 1.4 });
        this.noise(out, at, { color: 'brown', filter: 'lowpass', from: 700, to: 250, attack: 0.002, decay: 0.22, gain: 0.5 * s + 0.1 });
        this.tone(out, at, { type: 'triangle', from: 150, to: 95, attack: 0.002, decay: 0.12, gain: 0.25 });
        break;
      case 'glass':
        this.noise(out, at, { color: 'white', filter: 'highpass', from: 5000, to: 3500, attack: 0.001, decay: 0.18, gain: 0.3 });
        for (let i = 0; i < 9; i++) {
          const f = 2600 + r() * 5000;
          this.tone(out, at + r() * 0.25, { type: 'sine', from: f, to: f * 0.99, attack: 0.001, decay: 0.08 + r() * 0.25, gain: 0.035 });
        }
        break;
      case 'concrete':
        // Crunch: a cluster of short low bursts.
        for (let i = 0; i < 5; i++) {
          this.noise(out, at + r() * 0.12, { color: 'brown', filter: 'lowpass', from: 1100, to: 300, attack: 0.002, decay: 0.08 + r() * 0.1, gain: 0.35 * s + 0.12 });
        }
        break;
      case 'metal':
      case 'vehicle':
        this.metal(out, at, 0.18, 220);
        break;
    }
  }

  impact(material: MaterialId, intensity: number, pan = 0): void {
    const at = this.ctx.currentTime;
    const out = this.voice(pan, 0.2);
    const i = Math.min(1, intensity);
    if (material === 'metal' || material === 'vehicle') return this.metal(out, at, 0.08 * i, 260);
    if (material === 'glass') {
      return this.tone(out, at, { type: 'sine', from: 3400, to: 3300, attack: 0.001, decay: 0.06, gain: 0.05 * i });
    }
    this.noise(out, at, { color: 'brown', filter: 'lowpass', from: 500, to: 160, attack: 0.002, decay: 0.12, gain: 0.45 * i });
    this.tone(out, at, { type: 'sine', from: 95, to: 60, attack: 0.002, decay: 0.1, gain: 0.3 * i });
  }

  /**
   * A heavy body hitting the ground: a deep "woomph" felt more than heard,
   * a burst of crushed material and gravel settling after it.
   */
  collapse(weight: number, pan = 0): void {
    const at = this.ctx.currentTime;
    const r = this.rng;
    const w = Math.min(1.5, weight);
    const out = this.voice(pan, 0.55);
    this.tone(out, at, { type: 'sine', from: 62 + r() * 8, to: 28, sweep: 0.5, attack: 0.004, decay: 0.7, gain: 0.75 * w });
    this.noise(out, at, { color: 'brown', filter: 'lowpass', from: 420, to: 70, sweep: 0.8, attack: 0.006, decay: 1.1, gain: 0.7 * w });
    this.noise(out, at, { color: 'brown', filter: 'bandpass', from: 220, to: 120, attack: 0.003, decay: 0.25, gain: 0.5 * w, q: 1.1 });
    for (let i = 0; i < 10; i++) {
      const f = 500 + r() * 1400;
      this.noise(this.voice(pan + (r() - 0.5) * 0.6, 0.4), at + 0.05 + Math.pow(r(), 1.5) * 0.6, {
        color: 'white', filter: 'bandpass', from: f, to: f * 0.8, attack: 0.001, decay: 0.02 + r() * 0.05, gain: (0.04 + r() * 0.08) * w, q: 2.5,
      });
    }
  }

  /** Structure under strain: a stick-slip groan through a resonant body. */
  creak(pan = 0): void {
    const at = this.ctx.currentTime;
    const r = this.rng;
    const out = this.voice(pan, 0.5);
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    const duration = 0.35 + r() * 0.25;
    // Stick-slip: the pitch stutters downwards instead of gliding.
    let f = 85 + r() * 40;
    osc.frequency.setValueAtTime(f, at);
    for (let t = 0.04; t < duration; t += 0.03 + r() * 0.05) {
      f *= 0.93 + r() * 0.1;
      osc.frequency.linearRampToValueAtTime(f, at + t);
    }
    const body = this.ctx.createBiquadFilter();
    body.type = 'bandpass';
    body.Q.value = 6;
    body.frequency.setValueAtTime(900 + r() * 400, at);
    body.frequency.exponentialRampToValueAtTime(500, at + duration);
    const env = this.envelope(at, 0.06, duration * 0.4, duration * 0.6, 0.16);
    osc.connect(body).connect(env).connect(out);
    osc.start(at);
    osc.stop(at + duration + 0.12);
  }

  /** Detonator-style arming click: mechanical, short, not musical. */
  arm(): void {
    const at = this.ctx.currentTime;
    const out = this.voice(0, 0.05);
    this.noise(out, at, { color: 'white', filter: 'bandpass', from: 3200, to: 3200, attack: 0.0005, decay: 0.006, gain: 0.35, q: 3 });
    this.tone(out, at + 0.012, { type: 'square', from: 1400, to: 1400, attack: 0.001, decay: 0.035, gain: 0.025 });
  }

  disarm(): void {
    const at = this.ctx.currentTime;
    const out = this.voice(0, 0.05);
    this.noise(out, at, { color: 'white', filter: 'bandpass', from: 1800, to: 1800, attack: 0.0005, decay: 0.008, gain: 0.3, q: 3 });
  }

  click(): void {
    const out = this.voice(0, 0);
    this.noise(out, this.ctx.currentTime, { color: 'white', filter: 'bandpass', from: 2600, to: 2600, attack: 0.0005, decay: 0.005, gain: 0.25, q: 2 });
  }

  denied(): void {
    const out = this.voice(0, 0);
    this.tone(out, this.ctx.currentTime, { type: 'sawtooth', from: 110, to: 100, attack: 0.002, decay: 0.12, gain: 0.05 });
  }

  /** A burning fuse: crackling hiss with random flicker. */
  fuse(duration = 0.3): void {
    const at = this.ctx.currentTime;
    const out = this.voice(0, 0.1);
    for (let t = 0; t < duration; t += 0.015) {
      this.noise(out, at + t, { color: 'white', filter: 'highpass', from: 4000, to: 4000, attack: 0.001, decay: 0.01, gain: 0.04 + this.rng() * 0.08 });
    }
  }

  /** Understated result stings: a low resolved interval, or a single dull note. */
  success(stars: number): void {
    const at = this.ctx.currentTime + 0.2;
    const out = this.voice(0, 0.4);
    const notes = [196, 294, 392].slice(0, Math.max(1, stars));
    notes.forEach((f, i) => this.tone(out, at + i * 0.09, { type: 'sine', from: f, to: f, attack: 0.02, decay: 1.2, gain: 0.07 }));
  }

  failure(): void {
    const out = this.voice(0, 0.3);
    this.tone(out, this.ctx.currentTime + 0.2, { type: 'sine', from: 147, to: 138, attack: 0.02, decay: 0.9, gain: 0.08 });
  }

  // ---- building blocks -----------------------------------------------------

  /** A voice: its own pan position and reverb amount, feeding the shared bus. */
  private voice(pan: number, reverb: number): AudioNode {
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(this.bus);
    if (reverb > 0) {
      const send = this.ctx.createGain();
      send.gain.value = reverb;
      panner.connect(send).connect(this.reverbSend);
    }
    return panner;
  }

  private metal(out: AudioNode, at: number, gain: number, base: number): void {
    const f = base * (0.85 + this.rng() * 0.3);
    // Inharmonic partials of a struck plate.
    for (const [ratio, decay] of [[1, 0.9], [2.32, 0.6], [4.25, 0.4], [6.63, 0.25]] as const) {
      this.tone(out, at, { type: 'sine', from: f * ratio, to: f * ratio * 0.995, attack: 0.001, decay, gain: gain / ratio });
    }
  }

  private tone(
    out: AudioNode,
    at: number,
    o: { type: OscillatorType; from: number; to: number; sweep?: number; attack: number; hold?: number; decay: number; gain: number },
  ): void {
    if (o.gain <= 0) return;
    const osc = this.ctx.createOscillator();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.from, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), at + (o.sweep ?? o.decay));
    const env = this.envelope(at, o.attack, o.hold ?? 0, o.decay, o.gain);
    osc.connect(env).connect(out);
    osc.start(at);
    osc.stop(at + o.attack + (o.hold ?? 0) + o.decay + 0.05);
  }

  private noise(
    out: AudioNode,
    at: number,
    o: {
      color: 'white' | 'brown';
      filter: BiquadFilterType;
      from: number;
      to: number;
      sweep?: number;
      attack: number;
      hold?: number;
      decay: number;
      gain: number;
      q?: number;
    },
  ): void {
    if (o.gain <= 0) return;
    const src = this.ctx.createBufferSource();
    src.buffer = o.color === 'white' ? this.white : this.brown;
    const filter = this.ctx.createBiquadFilter();
    filter.type = o.filter;
    filter.Q.value = o.q ?? 0.7;
    filter.frequency.setValueAtTime(o.from, at);
    filter.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), at + (o.sweep ?? o.decay));
    const env = this.envelope(at, o.attack, o.hold ?? 0, o.decay, o.gain);
    src.connect(filter).connect(env).connect(out);
    const length = src.buffer.duration;
    src.start(at, this.rng() * Math.max(0, length - 3));
    src.stop(at + o.attack + (o.hold ?? 0) + o.decay + 0.05);
  }

  private envelope(at: number, attack: number, hold: number, decay: number, gain: number): GainNode {
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + attack);
    env.gain.setValueAtTime(gain, at + attack + hold);
    env.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + decay);
    return env;
  }

  private noiseBuffer(color: 'white' | 'brown', seconds: number): AudioBuffer {
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * seconds), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = this.rng() * 2 - 1;
      if (color === 'white') {
        data[i] = white;
      } else {
        // Integrated (brown) noise: energy concentrated in the lows, like a real blast.
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
    }
    return buffer;
  }

  /** Stereo impulse response: discrete building reflections, then a darkening diffuse tail. */
  private cityImpulse(seconds: number): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let low = 0;
      for (let i = 0; i < length; i++) {
        const t = i / rate;
        low += 0.08 * ((this.rng() * 2 - 1) - low); // gentle low-pass: outdoor tails are dark
        data[i] = low * Math.exp(-t * 2.4) * 2.2;
      }
      for (const [delay, gain] of [[0.045, 0.5], [0.09, 0.35], [0.14, 0.28], [0.23, 0.2], [0.38, 0.12]] as const) {
        const i = Math.floor((delay + (ch ? 0.007 : 0)) * rate);
        if (i < length) data[i] = (data[i] ?? 0) + gain;
      }
    }
    return buffer;
  }
}

/** tanh-style soft clipper. */
const softClip = (drive: number): Float32Array<ArrayBuffer> => {
  const n = 2048;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  return curve;
};
