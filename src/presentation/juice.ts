import type { BlastSource, EventBus, GameEvents } from '../core/events';
import { WORLD } from '../core/level';
import type { MaterialId } from '../core/materials';
import type { Vec2 } from '../core/math';
import type { Settings } from '../core/progress';
import { blastPalette, type Rgb } from './blast-styles';
import { DEBRIS_COLORS, PALETTE } from './palette';
import { ParticlePool } from './particles';

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  age: number;
  life: number;
  /** Implosions: the ring closes in on the centre instead of spreading out. */
  inward?: boolean;
}

/** One rolling ball of flame inside a fireball; many overlap to make a ragged shape. */
export interface Flame {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  age: number;
  life: number;
  /** Blast style the flame is drawn in. */
  style: string;
}

/** A short-lived light that brightens everything around a blast. */
export interface BlastLight {
  x: number;
  y: number;
  radius: number;
  age: number;
  life: number;
  color: Rgb;
}

/** A pigeon on a rooftop: perched on a body until the first blast, then off and away. */
export interface Bird {
  /** The body it sits on, and where along its top (body-local, unrotated). */
  readonly perch: { readonly id: string; readonly dx: number } | undefined;
  /** While perched, the renderer keeps this on the moving roof; in flight it is integrated here. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  flying: boolean;
  /** Wing-beat phase. */
  flap: number;
}

/** A burn mark left behind on the ground or a wall. */
export interface Scorch {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** How hard a body landed, scaled by its size: about 1 for a column slamming down. */
export const landingWeight = (e: GameEvents['blockHit']): number => e.intensity * (e.size / 50);

/** Landings heavier than this raise a ground-hugging dust cloud and a deep thud. */
export const HEAVY_LANDING = 0.25;

/** Feel parameters. Tweak here; nothing else needs to change. */
const FEEL = {
  hitStop: { charge: 0.06, implosion: 0.05, barrel: 0.04, vehicle: 0.045, bomb: 0.07, roller: 0.06 },
  trauma: { explosion: 0.55, shatter: 0.06, hit: 0.05, decay: 1.5 },
  shakeMaxOffset: 16,
  shakeMaxAngle: 0.02,
  /** Whole-screen flash stays subtle; the local blast light does the heavy lifting. */
  flash: { explosion: 0.22, decay: 9 },
  zoomPunch: { explosion: 0.035, decay: 6 },
  slowMo: { scale: 0.3, duration: 0.9 },
  /** The first big structural break of an attempt: a beat of slow motion and a push-in on it. */
  critical: { minSize: 40, slowScale: 0.3, slowFor: 0.22, zoom: 0.09, holdFor: 0.55, release: 3 },
  maxScorches: 24,
} as const;

/**
 * Turns game events into feel: hit-stop, slow motion, screen shake (trauma
 * model), blast light, fireball, smoke, debris and scorch marks. Game rules
 * never call this directly; it only listens.
 */
export class JuiceDirector {
  readonly particles = new ParticlePool(1100, WORLD.groundY);
  readonly shockwaves: Shockwave[] = [];
  readonly flames: Flame[] = [];
  readonly lights: BlastLight[] = [];
  readonly scorches: Scorch[] = [];
  readonly birds: Bird[] = [];
  private hitStop = 0;
  private slowMoLeft = 0;
  private criticalSlowLeft = 0;
  private criticalHold = 0;
  private criticalDone = false;
  private focusZoom = 0;
  private punch = 0;
  private trauma = 0;
  private shakeTime = 0;
  private lastCloudAt = -1;
  flash = 0;
  /** Where the camera pushes in, while it does. */
  focus: Vec2 | undefined;

  constructor(
    events: EventBus<GameEvents>,
    private readonly settings: () => Settings,
    /** The workshop blast style in use; only the look changes, never the physics. */
    private readonly style: () => string = () => 'classic',
  ) {
    events.on('explosion', (e) => this.onExplosion(e.position, e.radius, e.power, e.source));
    events.on('blockShattered', (e) => this.onShatter(e.position, e.material, e.size));
    events.on('blockHit', (e) => {
      this.addTrauma(FEEL.trauma.hit * e.intensity);
      this.dust(e.position, Math.ceil(4 * e.intensity), DEBRIS_COLORS[e.material]);
      const weight = landingWeight(e);
      if (weight > HEAVY_LANDING) this.landingCloud(e.position, weight, e.material);
    });
    events.on('carWrecked', (e) => this.burningWreck(e.position));
    events.on('jointBroken', (e) => this.dust(e.position, 2, ['#c9c2b6']));
    events.on('ropeCut', (e) => {
      this.addTrauma(FEEL.trauma.hit * 2);
      this.dust(e.position, 3, ['#9aa1aa']);
    });
    events.on('targetDown', (e) => {
      this.dust(e.position, 14, ['#b9b2a6']);
      if (e.remaining === 0) this.slowMoLeft = FEEL.slowMo.duration;
    });
  }

  /** Converts real frame time into simulation time (hit-stop freezes, slow-mo stretches). */
  simDelta(realDt: number): number {
    if (this.hitStop > 0) {
      this.hitStop -= realDt;
      return 0;
    }
    if (this.settings().reducedMotion) {
      // Reduced motion: time runs evenly, no dramatic slow-downs.
      this.criticalSlowLeft = 0;
      this.slowMoLeft = 0;
      return realDt;
    }
    if (this.criticalSlowLeft > 0) {
      this.criticalSlowLeft -= realDt;
      return realDt * FEEL.critical.slowScale;
    }
    if (this.slowMoLeft > 0) {
      this.slowMoLeft -= realDt;
      // Ease back to normal speed over the last third.
      const t = Math.min(1, this.slowMoLeft / (FEEL.slowMo.duration / 3));
      return realDt * (1 - (1 - FEEL.slowMo.scale) * t);
    }
    return realDt;
  }

  /** `simDt` moves effects that live in the world; `realDt` decays camera effects. */
  update(realDt: number, simDt: number): void {
    this.particles.update(simDt);
    advance(this.shockwaves, simDt);
    advance(this.lights, simDt);
    for (const f of this.flames) {
      // Flames rise with the heat and slow down as they expand.
      const drag = Math.exp(-4 * simDt);
      f.vx *= drag;
      f.vy = f.vy * drag - 90 * simDt;
      f.x += f.vx * simDt;
      f.y += f.vy * simDt;
    }
    advance(this.flames, simDt);
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      if (!b?.flying) continue;
      b.flap += simDt * 22;
      b.vy = Math.max(-260, b.vy - 40 * simDt);
      b.x += b.vx * simDt;
      b.y += b.vy * simDt;
      if (b.y < -60 || b.x < -60 || b.x > WORLD.width + 60) this.birds.splice(i, 1);
    }
    this.trauma = Math.max(0, this.trauma - FEEL.trauma.decay * realDt);
    this.shakeTime += realDt;
    this.flash = decay(this.flash, FEEL.flash.decay, realDt);
    this.punch = decay(this.punch, FEEL.zoomPunch.decay, realDt);
    if (this.criticalHold > 0) {
      this.criticalHold -= realDt;
      this.focusZoom += (FEEL.critical.zoom - this.focusZoom) * Math.min(1, realDt * 12);
    } else {
      this.focusZoom = decay(this.focusZoom, FEEL.critical.release, realDt);
      if (this.focusZoom === 0) this.focus = undefined;
    }
  }

  /** Extra camera zoom: the blast punch, or the push-in on a critical break. */
  get zoom(): number {
    const s = this.settings();
    if (s.reducedMotion) return 0;
    return Math.max(this.punch, s.screenShake ? this.focusZoom : 0);
  }

  /** Camera offset from trauma². Smooth pseudo-noise instead of jitter feels heavier. */
  shake(): { x: number; y: number; angle: number } {
    const s0 = this.settings();
    if (!s0.screenShake || s0.reducedMotion || this.trauma <= 0) return { x: 0, y: 0, angle: 0 };
    const s = this.trauma * this.trauma;
    const t = this.shakeTime * 38;
    return {
      x: (FEEL.shakeMaxOffset * s * (Math.sin(t * 1.1) + Math.sin(t * 2.3) * 0.5)) / 1.5,
      y: (FEEL.shakeMaxOffset * s * (Math.sin(t * 1.7 + 1) + Math.sin(t * 2.9) * 0.5)) / 1.5,
      angle: FEEL.shakeMaxAngle * s * Math.sin(t * 0.9 + 2),
    };
  }

  flashAlpha(): number {
    return this.settings().flashes ? Math.min(1, this.flash) : 0;
  }

  /** Blast lights honour the flash setting too (photosensitivity, FR-18). */
  lightScale(): number {
    return this.settings().flashes ? 1 : 0.35;
  }

  reset(): void {
    this.particles.clear();
    this.shockwaves.length = 0;
    this.flames.length = 0;
    this.lights.length = 0;
    this.scorches.length = 0;
    this.birds.length = 0;
    this.hitStop = 0;
    this.slowMoLeft = 0;
    this.criticalSlowLeft = 0;
    this.criticalHold = 0;
    this.criticalDone = false;
    this.focusZoom = 0;
    this.focus = undefined;
    this.punch = 0;
    this.trauma = 0;
    this.flash = 0;
    this.lastCloudAt = -1;
  }

  private addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /**
   * Sits a few pigeons on the highest rooftops of a fresh site. Purely for
   * show: they never touch the physics.
   */
  perchBirds(bodies: readonly { id: string; x: number; top: number; width: number }[]): void {
    this.birds.length = 0;
    const r = Math.random;
    const roofs = [...bodies].filter((b) => b.width >= 24).sort((a, b) => a.top - b.top).slice(0, 2);
    for (const roof of roofs) {
      const count = 1 + Math.floor(r() * 2);
      for (let i = 0; i < count; i++) {
        const dx = (r() - 0.5) * roof.width * 0.6;
        this.birds.push({ perch: { id: roof.id, dx }, x: roof.x + dx, y: roof.top, vx: 0, vy: 0, flying: false, flap: r() * 6 });
      }
    }
  }

  /** Startled: every perched bird takes off, away from the blast. */
  private scatterBirds(from: Vec2): void {
    const r = Math.random;
    for (const b of this.birds) {
      if (b.flying) continue;
      b.flying = true;
      const away = b.x >= from.x ? 1 : -1;
      b.vx = away * (90 + r() * 90);
      b.vy = -(140 + r() * 80);
    }
  }

  private onExplosion(p: Vec2, radius: number, power: number, source: BlastSource): void {
    const r = Math.random;
    this.scatterBirds(p);
    this.hitStop = Math.max(this.hitStop, FEEL.hitStop[source]);
    if (source === 'implosion') {
      this.onImplosion(p, radius, power);
      return;
    }
    this.addTrauma(FEEL.trauma.explosion * power);
    this.flash = Math.max(this.flash, FEEL.flash.explosion * power);
    this.punch = Math.max(this.punch, FEEL.zoomPunch.explosion * power);
    const style = this.style();
    const palette = blastPalette(style);
    this.lights.push({ x: p.x, y: p.y, radius: radius * 2.4, age: 0, life: 0.35, color: palette.light });
    this.shockwaves.push({ x: p.x, y: p.y, radius: radius * 1.25, age: 0, life: 0.3 });

    // Fireball: overlapping puffs thrown outwards, then rising and cooling.
    const size = radius * 0.22 * (0.8 + power * 0.3);
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2;
      const speed = 60 + r() * 220 * power;
      this.flames.push({
        x: p.x + Math.cos(a) * size * 0.3,
        y: p.y + Math.sin(a) * size * 0.3,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed * 0.7 - 40,
        radius: size * (0.6 + r() * 0.7),
        age: 0,
        life: 0.35 + r() * 0.35,
        style,
      });
    }

    // Smoke column: starts lit by the fire, cools to near black, rises and spreads.
    for (let i = 0; i < 22; i++) {
      const a = r() * Math.PI * 2;
      const speed = 30 + r() * 120;
      this.particles.spawn({
        x: p.x + (r() - 0.5) * size, y: p.y + (r() - 0.5) * size * 0.6,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * 0.4 - 50 - r() * 50,
        life: 2.2 + r() * 2.2, size: size * (0.7 + r() * 0.8), color: palette.smoke,
        style: 'plume', gravity: -18, drag: 0.9,
      });
    }

    // Embers: small, hot, falling with gravity and bouncing on the ground.
    for (let i = 0; i < 34; i++) {
      const a = r() * Math.PI * 2;
      const speed = 250 + r() * 650 * power;
      this.particles.spawn({
        x: p.x, y: p.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 150,
        life: 0.4 + r() * 0.9, size: 1 + r() * 1.6, color: r() < 0.6 ? palette.embers[0] : palette.embers[1],
        style: 'spark', gravity: 950, drag: 1.6, ground: true,
      });
    }

    // Confetti style: a shower of coloured paper that flutters down slowly.
    if (palette.confetti) {
      for (let i = 0; i < 40; i++) {
        const a = -Math.PI * (0.15 + r() * 0.7);
        const speed = 180 + r() * 380 * power;
        this.particles.spawn({
          x: p.x, y: p.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          life: 2.2 + r() * 1.6, size: 2.5 + r() * 2.5, color: palette.confetti[i % palette.confetti.length] ?? '#ffffff',
          style: 'chip', gravity: 260, drag: 2.2, spin: (r() - 0.5) * 24, ground: true,
        });
      }
    }

    // Rubble chunks thrown out of the crater.
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI * (0.1 + r() * 0.8);
      const speed = 200 + r() * 450 * power;
      this.particles.spawn({
        x: p.x, y: p.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        life: 1.4 + r() * 1.2, size: 2 + r() * 3.5, color: r() < 0.5 ? '#3a3633' : '#57514b',
        style: 'chip', gravity: 1150, drag: 0.4, spin: (r() - 0.5) * 18, ground: true,
      });
    }

    // Near the ground: a dust wave races out along it and leaves a scorch mark.
    const height = WORLD.groundY - p.y;
    if (height < radius * 0.5) {
      for (let i = 0; i < 18; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        this.particles.spawn({
          x: p.x, y: WORLD.groundY - 6, vx: dir * (220 + r() * 420), vy: -r() * 40,
          life: 1.6 + r() * 1.4, size: 10 + r() * 12, color: '#9a8f80', style: 'dust', gravity: -6, drag: 2.2,
        });
      }
      this.scorch(p.x, WORLD.groundY, radius * 0.9, 10);
    } else {
      this.scorch(p.x, p.y, radius * 0.45, radius * 0.3);
    }
  }

  /**
   * An implosion: a short, dull flash, then rings and a wall of dust drawn in
   * towards the centre, where the material piles up and smokes.
   */
  private onImplosion(p: Vec2, radius: number, power: number): void {
    const r = Math.random;
    this.addTrauma(FEEL.trauma.explosion * power * 0.8);
    this.flash = Math.max(this.flash, FEEL.flash.explosion * power * 0.5);
    this.punch = Math.max(this.punch, FEEL.zoomPunch.explosion * power);
    const style = this.style();
    const palette = blastPalette(style);
    this.lights.push({ x: p.x, y: p.y, radius: radius * 1.4, age: 0, life: 0.22, color: palette.light });
    this.shockwaves.push({ x: p.x, y: p.y, radius: radius * 1.1, age: 0, life: 0.35, inward: true });
    this.shockwaves.push({ x: p.x, y: p.y, radius: radius * 0.75, age: 0, life: 0.28, inward: true });
    for (let i = 0; i < 8; i++) {
      const a = r() * Math.PI * 2;
      this.flames.push({ x: p.x, y: p.y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 30 - 20, radius: radius * 0.1 * (0.6 + r() * 0.6), age: 0, life: 0.18 + r() * 0.15, style });
    }
    // Dust sucked in from a ring around the charge.
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2;
      const d = radius * (0.6 + r() * 0.4);
      const x = p.x + Math.cos(a) * d;
      const y = Math.min(WORLD.groundY - 4, p.y + Math.sin(a) * d * 0.7);
      const speed = (d / 0.45) * (0.8 + r() * 0.3);
      this.particles.spawn({
        x, y, vx: ((p.x - x) / d) * speed, vy: ((p.y - y) / d) * speed,
        life: 0.9 + r() * 0.8, size: 8 + r() * 10, color: '#a39a8c', style: 'dust', gravity: 0, drag: 2.4,
      });
    }
    // The material that piles up at the centre smokes for a while.
    for (let i = 0; i < 10; i++) {
      this.particles.spawn({
        x: p.x + (r() - 0.5) * 30, y: p.y, vx: (r() - 0.5) * 40, vy: -20 - r() * 40,
        life: 2 + r() * 1.6, size: 14 + r() * 12, color: '#3b3836', style: 'plume', gravity: -14, drag: 0.9,
      });
    }
  }

  private scorch(x: number, y: number, w: number, h: number): void {
    this.scorches.push({ x, y, w, h });
    if (this.scorches.length > FEEL.maxScorches) this.scorches.shift();
  }

  private onShatter(p: Vec2, material: MaterialId, size: number): void {
    this.addTrauma(FEEL.trauma.shatter);
    const colors = DEBRIS_COLORS[material];
    const glass = material === 'glass';
    const count = Math.round(size / (glass ? 2.5 : 4));
    const r = Math.random;
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2;
      const speed = 80 + r() * (glass ? 420 : 260);
      this.particles.spawn({
        x: p.x + (r() - 0.5) * size * 0.6, y: p.y + (r() - 0.5) * size * 0.6,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 100,
        life: 0.9 + r() * 1.1, size: glass ? 1.5 + r() * 2.5 : 2 + r() * 3,
        color: colors[i % colors.length] ?? PALETTE.accent, style: glass ? 'glint' : 'chip',
        gravity: 1100, drag: 0.8, spin: (r() - 0.5) * 20, ground: true,
      });
    }
    if (material !== 'glass' && material !== 'metal' && material !== 'vehicle') this.dust(p, 8, colors);
    if (!this.criticalDone && size >= FEEL.critical.minSize && material !== 'glass') this.criticalBreak(p, colors);
  }

  /** The structure lets go: a beat of slow motion, a push-in, and a burst of pulverised material. */
  private criticalBreak(p: Vec2, colors: readonly string[]): void {
    this.criticalDone = true;
    this.criticalSlowLeft = FEEL.critical.slowFor;
    this.criticalHold = FEEL.critical.holdFor;
    this.focus = { x: p.x, y: p.y };
    const r = Math.random;
    for (let i = 0; i < 12; i++) {
      const a = r() * Math.PI * 2;
      this.particles.spawn({
        x: p.x, y: p.y, vx: Math.cos(a) * (40 + r() * 90), vy: Math.sin(a) * 50 - 20,
        life: 1.8 + r() * 1.4, size: 10 + r() * 10, color: colors[0] ?? '#b9b2a6', style: 'dust', gravity: -8, drag: 1.4,
      });
    }
  }

  /**
   * A heavy body hits the ground: a cloud rolls out low along the ground in both
   * directions and slowly climbs, like the base of a collapse.
   */
  private landingCloud(p: Vec2, weight: number, material: MaterialId): void {
    // A collapsing pile lands many times a second; one cloud per beat is enough.
    if (this.shakeTime - this.lastCloudAt < 0.09) return;
    this.lastCloudAt = this.shakeTime;
    const r = Math.random;
    const w = Math.min(1.6, weight);
    const color = LANDING_DUST[material] ?? '#ada392';
    const nearGround = p.y > WORLD.groundY - 50;
    const count = Math.round(5 + 6 * w);
    for (let i = 0; i < count; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      this.particles.spawn({
        x: p.x + (r() - 0.5) * 20, y: (nearGround ? WORLD.groundY - 8 : p.y) - r() * 10,
        vx: dir * (30 + r() * 140) * w, vy: -10 - r() * 25,
        life: 2.4 + r() * 2, size: (12 + r() * 14) * (0.7 + 0.4 * w), color, style: 'dust', gravity: -5, drag: 1.1,
      });
    }
    this.addTrauma(0.08 * w);
  }

  /** A wrecked car keeps burning: flames and a long column of dark smoke. */
  private burningWreck(p: Vec2): void {
    const r = Math.random;
    for (let i = 0; i < 8; i++) {
      this.flames.push({
        x: p.x + (r() - 0.5) * 30, y: p.y - 6, vx: (r() - 0.5) * 30, vy: -30 - r() * 40,
        radius: 8 + r() * 8, age: 0, life: 0.6 + r() * 0.5, style: 'classic',
      });
    }
    for (let i = 0; i < 18; i++) {
      this.particles.spawn({
        x: p.x + (r() - 0.5) * 20, y: p.y - 10, vx: (r() - 0.5) * 30, vy: -30 - r() * 50,
        life: 2.5 + r() * 2.5, size: 10 + r() * 14, color: '#1f1f24', style: 'plume', gravity: -15, drag: 0.6,
      });
    }
  }

  private dust(p: Vec2, count: number, colors: readonly string[]): void {
    const r = Math.random;
    for (let i = 0; i < count; i++) {
      this.particles.spawn({
        x: p.x, y: p.y, vx: (r() - 0.5) * 110, vy: -r() * 60,
        life: 1.2 + r() * 1.2, size: 8 + r() * 10, color: colors[0] ?? PALETTE.smoke, style: 'dust',
        gravity: -10, drag: 2,
      });
    }
  }
}

/** Dust colours of pulverised material: lighter and greyer than the solid surface. */
const LANDING_DUST: Partial<Record<MaterialId, string>> = {
  brick: '#b8917c',
  wood: '#a89474',
  concrete: '#b3ab9f',
};

/** Exponential decay that snaps to zero once imperceptible. */
const decay = (value: number, rate: number, dt: number): number => {
  const next = value * Math.exp(-rate * dt);
  return next < 0.002 ? 0 : next;
};

const advance = (list: { age: number; life: number }[], dt: number): void => {
  for (let i = list.length - 1; i >= 0; i--) {
    const item = list[i];
    if (!item) continue;
    item.age += dt;
    if (item.age >= item.life) list.splice(i, 1);
  }
};
