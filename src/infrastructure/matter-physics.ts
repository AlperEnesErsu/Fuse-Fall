import Matter from 'matter-js';
import { MATERIALS } from '../core/materials';
import type { Vec2 } from '../core/math';
import type { BodySpec, BodyState, Impact, PhysicsWorld } from '../core/ports';

/** Matter.js expresses velocity per base step of 1000/60 ms. */
const STEPS_PER_SECOND = 60;

/** Adapts Matter.js to the core PhysicsWorld port; all unit conversion lives here. */
export class MatterPhysicsWorld implements PhysicsWorld {
  private readonly engine: Matter.Engine;
  private readonly bodies = new Map<string, Matter.Body>();
  private impacts: Impact[] = [];

  constructor() {
    this.engine = Matter.Engine.create({
      enableSleeping: true,
      positionIterations: 10,
      velocityIterations: 8,
    });
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) this.recordImpact(pair);
    });
  }

  add(spec: BodySpec): void {
    const material = MATERIALS[spec.material];
    const options: Matter.IChamferableBodyDefinition = {
      label: spec.id,
      angle: spec.angle,
      isStatic: spec.isStatic,
      density: material.density,
      friction: material.friction,
      frictionStatic: material.friction * 1.2,
      restitution: material.restitution,
      slop: 0.02,
    };
    const body =
      spec.shape.kind === 'rect'
        ? Matter.Bodies.rectangle(spec.position.x, spec.position.y, spec.shape.w, spec.shape.h, options)
        : Matter.Bodies.circle(spec.position.x, spec.position.y, spec.shape.r, options);
    if (spec.velocity) Matter.Body.setVelocity(body, toStep(spec.velocity));
    if (spec.angularVelocity !== undefined) {
      Matter.Body.setAngularVelocity(body, spec.angularVelocity / STEPS_PER_SECOND);
    }
    this.bodies.set(spec.id, body);
    Matter.Composite.add(this.engine.world, body);
  }

  remove(id: string): void {
    const body = this.bodies.get(id);
    if (!body) return;
    Matter.Composite.remove(this.engine.world, body);
    this.bodies.delete(id);
  }

  state(id: string): BodyState | undefined {
    const body = this.bodies.get(id);
    if (!body) return undefined;
    return {
      position: { x: body.position.x, y: body.position.y },
      angle: body.angle,
      velocity: fromStep(body.velocity),
      angularVelocity: body.angularVelocity * STEPS_PER_SECOND,
      mass: body.mass,
    };
  }

  kick(id: string, dv: Vec2, dAngular: number): void {
    const body = this.bodies.get(id);
    if (!body || body.isStatic) return;
    Matter.Sleeping.set(body, false);
    const step = toStep(dv);
    Matter.Body.setVelocity(body, { x: body.velocity.x + step.x, y: body.velocity.y + step.y });
    Matter.Body.setAngularVelocity(body, body.angularVelocity + dAngular / STEPS_PER_SECOND);
  }

  setPose(id: string, position: Vec2, velocity: Vec2): void {
    const body = this.bodies.get(id);
    if (!body) return;
    Matter.Sleeping.set(body, false);
    Matter.Body.setPosition(body, position);
    Matter.Body.setVelocity(body, toStep(velocity));
  }

  step(dtSeconds: number): void {
    Matter.Engine.update(this.engine, dtSeconds * 1000);
  }

  drainImpacts(): Impact[] {
    const drained = this.impacts;
    this.impacts = [];
    return drained;
  }

  private recordImpact(pair: Matter.Pair): void {
    const a = pair.bodyA.parent;
    const b = pair.bodyB.parent;
    const relative = { x: a.velocity.x - b.velocity.x, y: a.velocity.y - b.velocity.y };
    const support = pair.collision.supports[0];
    this.impacts.push({
      a: a.label,
      b: b.label,
      speed: Math.hypot(relative.x, relative.y) * STEPS_PER_SECOND,
      point: support
        ? { x: support.x, y: support.y }
        : { x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2 },
    });
  }
}

const toStep = (v: Vec2): Vec2 => ({ x: v.x / STEPS_PER_SECOND, y: v.y / STEPS_PER_SECOND });
const fromStep = (v: Vec2): Vec2 => ({ x: v.x * STEPS_PER_SECOND, y: v.y * STEPS_PER_SECOND });
