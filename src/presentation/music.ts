/**
 * Procedural background music on plain Web Audio: no files, works offline.
 *
 * The score is a few soft layers over a slow four-chord loop in each city's
 * own scale. It follows the job: warm in the menus, sparse while planning,
 * a ticking pulse once the fuse is lit, and silence the moment anything
 * blows up, so the blasts still land on a quiet street (see SoundDirector).
 */

/** What the music is doing: the screen or phase of the job it plays under. */
export type Mood = 'off' | 'menu' | 'plan' | 'tension' | 'result';

export type Instrument = 'pad' | 'pluck' | 'bass' | 'hat';

/** One note to play, `step` sixteenths from the start of the loop. */
export interface NoteEvent {
  readonly instrument: Instrument;
  /** MIDI note number (hats ignore it). */
  readonly midi: number;
  /** Length in sixteenths. */
  readonly steps: number;
  readonly gain: number;
}

/** A city's sound: the scale its melodies use and the root they sit on. */
interface Key {
  readonly root: number;
  readonly scale: readonly number[];
}

const MENU_KEY: Key = { root: 48, scale: [0, 2, 4, 5, 7, 9, 11] }; // C major

const KEYS: Readonly<Record<string, Key>> = {
  ankara: { root: 50, scale: [0, 2, 3, 5, 7, 9, 10] }, // D dorian
  london: { root: 45, scale: [0, 2, 3, 5, 7, 8, 10] }, // A minor
  paris: { root: 48, scale: [0, 2, 4, 6, 7, 9, 11] }, // C lydian
  rome: { root: 47, scale: [0, 2, 4, 5, 7, 9, 10] }, // B mixolydian
  tokyo: { root: 52, scale: [0, 1, 5, 7, 8] }, // E in-sen
  istanbul: { root: 50, scale: [0, 1, 4, 5, 7, 8, 10] }, // D hijaz
  berlin: { root: 45, scale: [0, 1, 3, 5, 7, 8, 10] }, // A phrygian
  madrid: { root: 52, scale: [0, 1, 4, 5, 7, 8, 10] }, // E phrygian dominant
  newyork: { root: 46, scale: [0, 2, 3, 5, 7, 9, 10] }, // B-flat dorian: a little jazz
};

export const BPM = 92;
export const STEPS_PER_BAR = 16;
/** Each chord lasts two bars; four chords make the loop. */
const CHORD_STEPS = 2 * STEPS_PER_BAR;
/** Scale degrees of the loop's chord roots: i, VI, iv, v in a minor scale. */
const PROGRESSION = [0, 5, 3, 4];
export const LOOP_STEPS = PROGRESSION.length * CHORD_STEPS;

/** The city's key; menus and unknown cities use the menu's. */
export const keyOf = (city: string | undefined): Key => (city === undefined ? undefined : KEYS[city]) ?? MENU_KEY;

/** The note `degree` steps up the scale (negative goes down), across octaves. */
export const degreeNote = (key: Key, degree: number): number => {
  const n = key.scale.length;
  const octave = Math.floor(degree / n);
  const index = ((degree % n) + n) % n;
  return key.root + 12 * octave + (key.scale[index] ?? 0);
};

/** A small deterministic hash, so the same city and bar always play the same tune. */
const chance = (seed: number): number => {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};

/** Notes that start on loop step `step` for this mood, in this key. Pure: the same inputs always give the same notes. */
export const notesAt = (mood: Mood, key: Key, step: number): NoteEvent[] => {
  if (mood === 'off') return [];
  const s = ((step % LOOP_STEPS) + LOOP_STEPS) % LOOP_STEPS;
  const chord = PROGRESSION[Math.floor(s / CHORD_STEPS)] ?? 0;
  const inChord = s % CHORD_STEPS;
  const seed = key.root * 7919 + s;
  const out: NoteEvent[] = [];
  const triad = [chord, chord + 2, chord + 4];

  // Pad: the chord, held for its two bars (a short swell under the result).
  if (inChord === 0 && mood !== 'tension') {
    const level = mood === 'plan' ? 0.16 : 0.22;
    for (const d of triad) out.push({ instrument: 'pad', midi: degreeNote(key, d) + 12, steps: CHORD_STEPS, gain: level });
  }
  if (mood === 'result') return out;

  // Bass: the chord root, on the bar in the menu, every half bar while planning, eighths under the fuse.
  const every = mood === 'tension' ? 2 : mood === 'plan' ? 8 : 16;
  if (inChord % every === 0) {
    out.push({ instrument: 'bass', midi: degreeNote(key, chord) - 12, steps: Math.min(every, 6), gain: mood === 'tension' ? 0.32 : 0.4 });
  }

  if (mood === 'tension') {
    // Ticking hats, accented on the beat, and an ostinato that climbs through the chord.
    out.push({ instrument: 'hat', midi: 0, steps: 1, gain: s % 4 === 0 ? 0.12 : 0.06 });
    if (s % 4 === 2) out.push({ instrument: 'pluck', midi: degreeNote(key, triad[(s >> 2) % 3] ?? chord) + 12, steps: 2, gain: 0.16 });
    return out;
  }

  // Melody: sparse plucks on eighths, mostly chord tones, never two leaps in a row.
  if (s % 2 === 0) {
    const odds = mood === 'menu' ? 0.42 : 0.24;
    if (chance(seed) < odds) {
      const pick = chance(seed + 1);
      const degree = pick < 0.7 ? (triad[Math.floor(pick * 4.3)] ?? chord) : chord + 1 + Math.floor(chance(seed + 2) * 3);
      // Folded into one octave and a bit above the root, so the tune never wanders off the top.
      const n = key.scale.length;
      out.push({ instrument: 'pluck', midi: degreeNote(key, degree >= n + 2 ? degree - n : degree) + 12, steps: 3, gain: mood === 'menu' ? 0.2 : 0.14 });
    }
  }
  return out;
};

const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** How far ahead notes are scheduled, and how often the scheduler wakes. */
const LOOKAHEAD = 0.25;
const TICK_MS = 60;
/** Music sits well below the effects at the same slider position. */
const MUSIC_LEVEL = 0.32;

/** Plays the score on an AudioContext; quiet until a mood is set. */
export class MusicPlayer {
  private readonly master: GainNode;
  private readonly duckGain: GainNode;
  private readonly noise: AudioBuffer;
  private mood: Mood = 'off';
  private key: Key = keyOf(undefined);
  private step = 0;
  private nextTime = 0;
  private timer: number | undefined;
  private volume = 0.5;

  constructor(private readonly ctx: AudioContext) {
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.duckGain = ctx.createGain();
    this.duckGain.connect(this.master).connect(ctx.destination);
    this.noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.25), ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.master.gain.setTargetAtTime(this.mood === 'off' ? 0 : this.volume * MUSIC_LEVEL, this.ctx.currentTime, 0.3);
    this.run();
  }

  /** Changes what the music plays; the new mood starts on the next sixteenth, the city's key on the next loop. */
  setMood(mood: Mood, city?: string): void {
    if (city !== undefined || mood === 'menu') this.key = keyOf(mood === 'menu' ? undefined : city);
    if (mood === this.mood) return;
    // A new job starts its loop from the top.
    if (mood === 'plan' || mood === 'menu') this.step = 0;
    this.mood = mood;
    this.setVolume(this.volume);
  }

  /** Cuts the music for a blast; it comes back by itself once things go quiet. */
  duck(): void {
    const t = this.ctx.currentTime;
    const g = this.duckGain.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0, t, 0.02);
    g.setTargetAtTime(1, t + 2.6, 1.2);
  }

  /** Starts or stops the scheduler: it only runs while there is something audible to play. */
  private run(): void {
    const audible = this.mood !== 'off' && this.volume > 0;
    if (audible && this.timer === undefined) {
      this.nextTime = this.ctx.currentTime + 0.05;
      this.timer = window.setInterval(() => this.schedule(), TICK_MS);
    } else if (!audible && this.timer !== undefined) {
      window.clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private schedule(): void {
    if (this.ctx.state !== 'running') return;
    const sixteenth = 60 / BPM / 4;
    // After a long stall (backgrounded tab), skip ahead rather than play a burst.
    if (this.nextTime < this.ctx.currentTime - 0.5) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD) {
      for (const n of notesAt(this.mood, this.key, this.step)) this.play(n, this.nextTime, n.steps * sixteenth);
      this.step = (this.step + 1) % LOOP_STEPS;
      this.nextTime += sixteenth;
    }
  }

  private play(n: NoteEvent, at: number, length: number): void {
    const c = this.ctx;
    const env = c.createGain();
    env.connect(this.duckGain);
    const g = env.gain;
    g.setValueAtTime(0, at);
    const sources: AudioScheduledSourceNode[] = [];
    let end: number;
    if (n.instrument === 'pad') {
      // Two detuned saws through a dark filter, slow in and slow out.
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 760;
      filter.connect(env);
      for (const detune of [-7, 7]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(n.midi);
        o.detune.value = detune;
        o.connect(filter);
        sources.push(o);
      }
      g.linearRampToValueAtTime(n.gain * 0.5, at + 1.2);
      g.setValueAtTime(n.gain * 0.5, at + length);
      end = at + length + 1.6;
      g.linearRampToValueAtTime(0, end);
    } else if (n.instrument === 'hat') {
      const src = c.createBufferSource();
      src.buffer = this.noise;
      const filter = c.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 7000;
      src.connect(filter).connect(env);
      sources.push(src);
      g.linearRampToValueAtTime(n.gain, at + 0.002);
      end = at + 0.05;
      g.exponentialRampToValueAtTime(0.0001, end);
    } else {
      const o = c.createOscillator();
      o.type = n.instrument === 'bass' ? 'sine' : 'triangle';
      o.frequency.value = hz(n.midi);
      o.connect(env);
      sources.push(o);
      g.linearRampToValueAtTime(n.gain, at + 0.006);
      end = at + Math.min(length, n.instrument === 'bass' ? 0.5 : 0.45) + 0.05;
      g.exponentialRampToValueAtTime(0.0001, end);
    }
    for (const s of sources) {
      s.start(at);
      s.stop(end + 0.05);
    }
  }
}
