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
  private readonly joints = new Map<string, Matter.Constraint>();

  constructor() {
    this.engine = Matter.Engine.create({
      enableSleeping: true,
      positionIterations: 10,
      velocityIterations: 8,
      constraintIterations: 6,
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
      // Matter has no kinematic type: a static body that is repositioned each step behaves as one.
      isStatic: spec.isStatic || spec.kinematic === true,
      density: material.density,
      friction: material.friction,
      frictionStatic: material.friction * 1.2,
      restitution: material.restitution,
      slop: 0.02,
      ...(spec.airDrag !== undefined ? { frictionAir: spec.airDrag } : {}),
    };
    const shape = spec.shape;
    const body =
      shape.kind === 'rect'
        ? Matter.Bodies.rectangle(spec.position.x, spec.position.y, shape.w, shape.h, options)
        : shape.kind === 'circle'
          ? Matter.Bodies.circle(spec.position.x, spec.position.y, shape.r, options)
          : Matter.Bodies.fromVertices(spec.position.x, spec.position.y, [shape.vertices.map((v) => ({ ...v }))], options);
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

  addJoint(id: string, a: string, b: string, at: Vec2): void {
    const bodyA = this.bodies.get(a);
    const bodyB = this.bodies.get(b);
    if (!bodyA || !bodyB) return;
    const constraint = Matter.Constraint.create({
      bodyA,
      bodyB,
      pointA: { x: at.x - bodyA.position.x, y: at.y - bodyA.position.y },
      pointB: { x: at.x - bodyB.position.x, y: at.y - bodyB.position.y },
      length: 0,
      stiffness: 0.9,
      damping: 0.1,
    });
    this.joints.set(id, constraint);
    Matter.Composite.add(this.engine.world, constraint);
  }

  addRope(id: string, body: string, hook: Vec2, length: number): void {
    const bodyA = this.bodies.get(body);
    if (!bodyA) return;
    const constraint = Matter.Constraint.create({ bodyA, pointA: { x: 0, y: 0 }, pointB: { x: hook.x, y: hook.y }, length, stiffness: 1, damping: 0 });
    this.joints.set(id, constraint);
    Matter.Composite.add(this.engine.world, constraint);
  }

  removeJoint(id: string): void {
    const constraint = this.joints.get(id);
    if (!constraint) return;
    Matter.Composite.remove(this.engine.world, constraint);
    this.joints.delete(id);
  }

  jointStretch(id: string): number | undefined {
    const j = this.joints.get(id);
    if (!j?.bodyA || !j.bodyB) return undefined;
    // Matter keeps pointA/pointB rotated with their bodies.
    const ax = j.bodyA.position.x + j.pointA.x;
    const ay = j.bodyA.position.y + j.pointA.y;
    const bx = j.bodyB.position.x + j.pointB.x;
    const by = j.bodyB.position.y + j.pointB.y;
    return Math.hypot(ax - bx, ay - by);
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
