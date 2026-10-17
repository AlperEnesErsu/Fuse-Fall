/**
 * `plume` is smoke that starts lit by fire and cools to its own colour.
 * `dust` is a soft, slowly swelling cloud of pulverised material.
 */
export type ParticleStyle = 'spark' | 'smoke' | 'plume' | 'dust' | 'chip' | 'glint';

export interface ParticleSpawn {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
  style: ParticleStyle;
  gravity?: number;
  drag?: number;
  spin?: number;
  /** Bounce on the ground line instead of falling through it. */
  ground?: boolean;
}

interface Particle extends Required<ParticleSpawn> {
  age: number;
  angle: number;
  alive: boolean;
}

/**
 * Fixed-capacity pool: particles are recycled instead of allocated, so big
 * explosions do not trigger garbage-collection hitches (NFR-01).
 */
export class ParticlePool {
  private readonly items: Particle[];
  private cursor = 0;

  constructor(
    readonly capacity: number,
    private readonly groundY: number,
  ) {
    this.items = Array.from({ length: capacity }, () => ({
      x: 0, y: 0, vx: 0, vy: 0, life: 0, size: 0, color: '', style: 'spark' as ParticleStyle,
      gravity: 0, drag: 0, spin: 0, ground: false, age: 0, angle: 0, alive: false,
    }));
  }

  /** When full, the oldest slot is overwritten. */
  spawn(p: ParticleSpawn): void {
    const slot = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.capacity;
    if (!slot) return;
    Object.assign(slot, { gravity: 0, drag: 0, spin: 0, ground: false }, p, {
      age: 0,
      angle: Math.random() * Math.PI,
      alive: true,
    });
  }

  update(dt: number): void {
    for (const p of this.items) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.alive = false;
        continue;
      }
      const damping = Math.max(0, 1 - p.drag * dt);
      p.vx *= damping;
      p.vy = p.vy * damping + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      if (p.ground && p.y > this.groundY - p.size / 2) {
        p.y = this.groundY - p.size / 2;
        p.vy *= -0.3;
        p.vx *= 0.55;
        p.spin *= 0.5;
      }
    }
  }

  *alive(): Generator<Readonly<Particle>> {
    for (const p of this.items) if (p.alive) yield p;
  }

  clear(): void {
    for (const p of this.items) p.alive = false;
  }
}
