import type { EventBus, GameEvents } from '../core/events';
import { WORLD } from '../core/level';
import type { Vec2 } from '../core/math';
import type { Settings } from '../core/progress';
import { HEAVY_LANDING, landingWeight } from './juice';
import { SoundSynth } from './sound-synth';

/** Stereo position from the world x: sounds come from where things happen. */
const panOf = (p: Vec2): number => ((p.x / WORLD.width) * 2 - 1) * 0.7;

/**
 * Wires game events to the synthesiser and owns the live AudioContext.
 * There is deliberately no background drone: silence between blasts makes
 * the blasts land harder.
 */
export class SoundDirector {
  private ctx: AudioContext | undefined;
  private volume: GainNode | undefined;
  private synth: SoundSynth | undefined;
  private tap: MediaStreamAudioDestinationNode | undefined;
  private lastHit = 0;
  /** Targets down so far in this attempt: each ding is pitched a step higher. */
  private targetsDown = 0;
  private lastCrack = 0;
  private lastCreak = 0;
  private lastCollapse = 0;

  constructor(
    events: EventBus<GameEvents>,
    private readonly settings: () => Settings,
  ) {
    events.on('explosion', (e) =>
      e.source === 'implosion' ? this.synth?.implosion(panOf(e.position)) : this.synth?.explosion(e.power, panOf(e.position)),
    );
    events.on('blockShattered', (e) => this.synth?.shatter(e.material, e.size / 60, panOf(e.position)));
    events.on('blockHit', (e) => this.hit(e));
    events.on('jointBroken', (e) => this.jointBroken(e.position));
    events.on('targetDown', (e) => this.synth?.targetDown(this.targetsDown++, panOf(e.position)));
    events.on('chargePlaced', () => (this.targetsDown = 0));
    events.on('ropeCut', (e) => this.synth?.ropeSnap(panOf(e.position)));
    events.on('carWrecked', (e) => this.synth?.carWreck(panOf(e.position)));
    events.on('bombReleased', (e) => this.synth?.whistle(panOf(e.position)));
    events.on('chargePlaced', () => this.synth?.arm());
    events.on('chargeRemoved', () => this.synth?.disarm());
    events.on('levelFinished', (e) => (e.result.success ? this.synth?.success(e.result.stars) : this.synth?.failure()));
  }

  /** Browsers only allow audio after a user gesture; call from the first tap. */
  unlock(): void {
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.volume = ctx.createGain();
      this.volume.connect(ctx.destination);
      this.synth = new SoundSynth(ctx, this.volume);
      this.ctx = ctx;
    }
    void this.ctx.resume();
    this.applyVolumes();
  }

  applyVolumes(): void {
    if (this.volume) this.volume.gain.value = this.settings().sfxVolume;
  }

  /** The game's sound as a stream, for recording clips; undefined until audio is unlocked. */
  captureStream(): MediaStream | undefined {
    if (!this.ctx || !this.volume) return undefined;
    if (!this.tap) {
      this.tap = this.ctx.createMediaStreamDestination();
      this.volume.connect(this.tap);
    }
    return this.tap.stream;
  }

  /** Lets the player audition the explosion from the settings screen. */
  test(): void {
    this.unlock();
    this.synth?.explosion(1, 0);
  }

  fuse(): void {
    this.synth?.fuse();
  }

  click(): void {
    this.synth?.click();
  }

  denied(): void {
    this.synth?.denied();
  }

  private hit(e: GameEvents['blockHit']): void {
    const now = this.ctx?.currentTime ?? 0;
    // A heavy body landing gets the full ground-shaking thud, at most a few per second.
    const weight = landingWeight(e);
    if (weight > HEAVY_LANDING && now - this.lastCollapse > 0.16) {
      this.lastCollapse = now;
      this.synth?.collapse(weight, panOf(e.position));
      return;
    }
    // Rate-limit thuds so a collapsing pile does not turn into white noise.
    if (now - this.lastHit < 0.035) return;
    this.lastHit = now;
    this.synth?.impact(e.material, e.intensity, panOf(e.position));
  }

  /** A snapping joint: a dry crack; the first ones in a while also groan under the load. */
  private jointBroken(p: Vec2): void {
    const now = this.ctx?.currentTime ?? 0;
    if (now - this.lastCreak > 0.7) {
      this.lastCreak = now;
      this.synth?.creak(panOf(p));
    }
    if (now - this.lastCrack < 0.035) return;
    this.lastCrack = now;
    this.synth?.impact('concrete', 0.3, panOf(p));
  }
}
