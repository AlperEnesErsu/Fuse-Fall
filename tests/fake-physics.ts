import type { Vec2 } from '../src/core/math';
import type { BodySpec, BodyState, Impact, PhysicsWorld } from '../src/core/ports';

/** Physics stand-in for rule tests: bodies only move when a test moves them. */
export class FakePhysics implements PhysicsWorld {
  readonly bodies = new Map<string, { spec: BodySpec; state: BodyState }>();
  readonly kicks: { id: string; dv: Vec2 }[] = [];
  pendingImpacts: Impact[] = [];

  add(spec: BodySpec): void {
    this.bodies.set(spec.id, {
      spec,
      state: {
        position: spec.position,
        angle: spec.angle,
        velocity: spec.velocity ?? { x: 0, y: 0 },
        angularVelocity: spec.angularVelocity ?? 0,
        mass: 1,
      },
    });
  }

  remove(id: string): void {
    this.bodies.delete(id);
  }

  state(id: string): BodyState | undefined {
    return this.bodies.get(id)?.state;
  }

  kick(id: string, dv: Vec2): void {
    this.kicks.push({ id, dv });
  }

  setPose(id: string, position: Vec2, velocity: Vec2): void {
    this.place(id, { position, velocity });
  }

  step(): void {}

  drainImpacts(): Impact[] {
    const out = this.pendingImpacts;
    this.pendingImpacts = [];
    return out;
  }

  /** Teleports a body, as if physics had moved it. */
  place(id: string, patch: Partial<BodyState>): void {
    const body = this.bodies.get(id);
    if (body) body.state = { ...body.state, ...patch };
  }

  idsOf(prefix: string): string[] {
    return [...this.bodies.keys()].filter((k) => k.startsWith(prefix));
  }
}
