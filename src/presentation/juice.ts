import type { BlastSource, EventBus, GameEvents } from '../core/events';
import { WORLD } from '../core/level';
import type { MaterialId } from '../core/materials';
import type { Vec2 } from '../core/math';
import type { Settings } from '../core/progress';
import { DEBRIS_COLORS, PALETTE } from './palette';
import { ParticlePool } from './particles';

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  age: number;
  life: number;
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
}

/** A short-lived light that brightens everything around a blast. */
export interface BlastLight {
  x: number;
  y: number;
  radius: number;
  age: number;
  life: number;
}

/** A burn mark left behind on the ground or a wall. */
export interface Scorch {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Feel parameters. Tweak here; nothing else needs to change. */
const FEEL = {
  hitStop: { charge: 0.06, barrel: 0.04, vehicle: 0.045 },
  trauma: { explosion: 0.55, shatter: 0.06, hit: 0.05, decay: 1.5 },
  shakeMaxOffset: 16,
  shakeMaxAngle: 0.02,
  /** Whole-screen flash stays subtle; the local blast light does the heavy lifting. */
  flash: { explosion: 0.22, decay: 9 },
  zoomPunch: { explosion: 0.035, decay: 6 },
  slowMo: { scale: 0.3, duration: 0.9 },
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
  private hitStop = 0;
  private slowMoLeft = 0;
  private trauma = 0;
  private shakeTime = 0;
  flash = 0;
  zoom = 0;

  constructor(
    events: EventBus<GameEvents>,
    private readonly settings: () => Settings,
  ) {
    events.on('explosion', (e) => this.onExplosion(e.position, e.radius, e.power, e.source));
    events.on('blockShattered', (e) => this.onShatter(e.position, e.material, e.size));
    events.on('blockHit', (e) => {
      this.addTrauma(FEEL.trauma.hit * e.intensity);
      this.dust(e.position, Math.ceil(4 * e.intensity), DEBRIS_COLORS[e.material]);
    });
    events.on('carWrecked', (e) => this.burningWreck(e.position));
    events.on('targetDown', (e) => {
      this.dust(e.position, 10, ['#b9b2a6']);
      if (e.remaining === 0) this.slowMoLeft = FEEL.slowMo.duration;
    });
  }

  /** Converts real frame time into simulation time (hit-stop freezes, slow-mo stretches). */
  simDelta(realDt: number): number {
    if (this.hitStop > 0) {
      this.hitStop -= realDt;
      return 0;
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
    this.trauma = Math.max(0, this.trauma - FEEL.trauma.decay * realDt);
    this.shakeTime += realDt;
    this.flash = decay(this.flash, FEEL.flash.decay, realDt);
    this.zoom = decay(this.zoom, FEEL.zoomPunch.decay, realDt);
  }

  /** Camera offset from trauma². Smooth pseudo-noise instead of jitter feels heavier. */
  shake(): { x: number; y: number; angle: number } {
    if (!this.settings().screenShake || this.trauma <= 0) return { x: 0, y: 0, angle: 0 };
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
    this.hitStop = 0;
    this.slowMoLeft = 0;
    this.trauma = 0;
    this.flash = 0;
    this.zoom = 0;
  }

  private addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  private onExplosion(p: Vec2, radius: number, power: number, source: BlastSource): void {
    const r = Math.random;
    this.hitStop = Math.max(this.hitStop, FEEL.hitStop[source]);
    this.addTrauma(FEEL.trauma.explosion * power);
    this.flash = Math.max(this.flash, FEEL.flash.explosion * power);
    this.zoom = Math.max(this.zoom, FEEL.zoomPunch.explosion * power);
    this.lights.push({ x: p.x, y: p.y, radius: radius * 2.4, age: 0, life: 0.35 });
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
      });
    }

    // Smoke column: starts lit by the fire, cools to near black, rises and spreads.
    for (let i = 0; i < 22; i++) {
      const a = r() * Math.PI * 2;
      const speed = 30 + r() * 120;
      this.particles.spawn({
        x: p.x + (r() - 0.5) * size, y: p.y + (r() - 0.5) * size * 0.6,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * 0.4 - 50 - r() * 50,
        life: 2.2 + r() * 2.2, size: size * (0.7 + r() * 0.8), color: '#2a2827',
        style: 'plume', gravity: -18, drag: 0.9,
      });
    }

    // Embers: small, hot, falling with gravity and bouncing on the ground.
    for (let i = 0; i < 34; i++) {
      const a = r() * Math.PI * 2;
      const speed = 250 + r() * 650 * power;
      this.particles.spawn({
        x: p.x, y: p.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 150,
        life: 0.4 + r() * 0.9, size: 1 + r() * 1.6, color: r() < 0.6 ? '#ffb347' : '#fff1c4',
        style: 'spark', gravity: 950, drag: 1.6, ground: true,
      });
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
          x: p.x, y: WORLD.groundY - 4, vx: dir * (220 + r() * 420), vy: -r() * 40,
          life: 0.9 + r() * 0.7, size: 8 + r() * 12, color: '#8a8073', style: 'smoke', gravity: -6, drag: 2.6,
        });
      }
      this.scorch(p.x, WORLD.groundY, radius * 0.9, 10);
    } else {
      this.scorch(p.x, p.y, radius * 0.45, radius * 0.3);
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
    if (material === 'concrete' || material === 'wood') this.dust(p, 8, colors);
  }

  /** A wrecked car keeps burning: flames and a long column of dark smoke. */
  private burningWreck(p: Vec2): void {
    const r = Math.random;
    for (let i = 0; i < 8; i++) {
      this.flames.push({
        x: p.x + (r() - 0.5) * 30, y: p.y - 6, vx: (r() - 0.5) * 30, vy: -30 - r() * 40,
        radius: 8 + r() * 8, age: 0, life: 0.6 + r() * 0.5,
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
        life: 0.8 + r() * 0.8, size: 7 + r() * 9, color: colors[0] ?? PALETTE.smoke, style: 'smoke',
        gravity: -10, drag: 2,
      });
    }
  }
}

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
