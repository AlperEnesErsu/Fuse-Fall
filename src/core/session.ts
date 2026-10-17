import type { BlastSource, EventBus, GameEvents } from './events';
import { WORLD, type CarDef, type ChargeKind, type LevelDefinition } from './level';
import { MATERIALS, type MaterialId } from './materials';
import { createRng, distance, hashString, rectContains, rotate, sub, length, scale, vec, type Vec2 } from './math';
import type { BodyState, PhysicsWorld, Shape } from './ports';
import { err, ok, type Result } from './result';
import { scoreLevel, type LevelResult } from './scoring';
import { shatter } from './shatter';
import { TUNING } from './tuning';

export type Phase = 'placing' | 'running' | 'finished';
export type EntityKind = 'block' | 'debris' | 'barrel' | 'car';

export interface Charge {
  readonly id: number;
  readonly position: Vec2;
  /** Seconds after Fire that this charge detonates. */
  readonly delay: number;
  readonly kind: ChargeKind;
}

/** Snaps a delay to the blasting machine's step and range. */
export const quantizeDelay = (seconds: number): number => {
  const { step, max } = TUNING.charge.delay;
  // Round to whole milliseconds so 7 × 0.05 is exactly 0.35, as the player reads it.
  const snapped = Math.round(Math.round(seconds / step) * step * 1000) / 1000;
  return Math.min(max, Math.max(0, snapped));
};

export interface EntityView {
  readonly id: string;
  readonly kind: EntityKind;
  readonly shape: Shape;
  readonly material: MaterialId;
  readonly target: boolean;
  readonly down: boolean;
  readonly protected: boolean;
  /** A protected building that has been damaged. */
  readonly compromised: boolean;
  readonly anchored: boolean;
  /** 0 = intact, 1 = about to break. */
  readonly damage: number;
  readonly state: BodyState;
  /** Cars only. */
  readonly car: CarView | undefined;
}

export interface CarView {
  readonly style: 'car' | 'train';
  readonly driving: boolean;
  readonly wrecked: boolean;
  readonly direction: 1 | -1;
  readonly route: { readonly from: number; readonly to: number; readonly y: number; readonly oneWay: boolean };
}

interface Driver {
  readonly def: CarDef;
  direction: 1 | -1;
  engine: boolean;
  wrecked: boolean;
}

export type PlacementError =
  | 'not-placing'
  | 'no-charges-left'
  | 'outside-zone'
  | 'too-close'
  | 'unknown-charge'
  | 'kind-unavailable';
export type FireError = 'not-placing' | 'no-charges';

interface Entity {
  readonly id: string;
  readonly kind: EntityKind;
  readonly shape: Shape;
  readonly material: MaterialId;
  readonly target: boolean;
  /** Counts toward the collapse ratio (an original block to demolish, not debris, a barrel or a protected building). */
  readonly structural: boolean;
  readonly guarded: boolean;
  readonly anchored: boolean;
  readonly fromStructure: boolean;
  compromised: boolean;
  readonly origin: { readonly position: Vec2; readonly angle: number };
  hp: number;
  readonly maxHp: number;
  down: boolean;
  readonly driver: Driver | undefined;
}

/** What exploded: each charge kind has its own blast; barrels and wrecks have theirs. */
type BlastKind = ChargeKind | 'barrel' | 'vehicle';

interface Detonation {
  readonly at: number;
  readonly position: Vec2;
  readonly blast: BlastKind;
}

/** Everything needed to create an entity; roles are explicit, never inferred from each other. */
interface SpawnSpec {
  readonly kind: EntityKind;
  readonly shape: Shape;
  readonly position: Vec2;
  readonly angle: number;
  readonly material: MaterialId;
  readonly target?: boolean;
  readonly structural?: boolean;
  readonly guarded?: boolean;
  readonly anchored?: boolean;
  readonly motion?: { readonly velocity: Vec2; readonly angularVelocity: number };
  readonly driver?: Driver;
  /** Debris broken off a structure to demolish: still counts as its material for the footprint. */
  readonly fromStructure?: boolean;
  readonly kinematic?: boolean;
}

const BLASTS: Readonly<Record<BlastKind, { radius: number; pressure: number; damage: number }>> = {
  standard: { radius: TUNING.charge.radius, pressure: TUNING.charge.pressure, damage: TUNING.charge.damage },
  precision: { radius: TUNING.precision.radius, pressure: TUNING.precision.pressure, damage: TUNING.precision.damage },
  barrel: { radius: TUNING.barrel.blastRadius, pressure: TUNING.barrel.pressure, damage: TUNING.barrel.damage },
  vehicle: { radius: TUNING.vehicle.blastRadius, pressure: TUNING.vehicle.pressure, damage: TUNING.vehicle.damage },
};

const sourceOf = (blast: BlastKind): BlastSource => (blast === 'standard' || blast === 'precision' ? 'charge' : blast);

/** Blast radius of a charge kind, for the placement preview. */
export const chargeRadius = (kind: ChargeKind): number => BLASTS[kind].radius;

const GROUND_ID = 'ground';

const area = (shape: Shape): number => (shape.kind === 'rect' ? shape.w * shape.h : Math.PI * shape.r * shape.r);
const halfExtent = (shape: Shape): number => (shape.kind === 'rect' ? Math.max(shape.w, shape.h) / 2 : shape.r);
/** Gap between the ground and a body's lowest possible point (any orientation). */
const clearance = (shape: Shape, position: Vec2): number => WORLD.groundY - halfExtent(shape) - position.y;
const innerRadius = (shape: Shape): number => (shape.kind === 'rect' ? Math.min(shape.w, shape.h) / 2 : shape.r);
/**
 * Whether a blast circle touches a body's actual outline (rotated rectangle or
 * circle). This is the contract rule for protected property, and the preview
 * uses the same function, so what the player sees is what is judged.
 */
export const circleTouches = (center: Vec2, radius: number, shape: Shape, position: Vec2, angle: number): boolean => {
  const local = rotate(sub(center, position), -angle);
  if (shape.kind === 'circle') return length(local) < radius + shape.r;
  const dx = Math.max(Math.abs(local.x) - shape.w / 2, 0);
  const dy = Math.max(Math.abs(local.y) - shape.h / 2, 0);
  return dx * dx + dy * dy < radius * radius;
};

/** How far a blast travels past `center` before it starts to hurt a body (damage falloff). */
const blastReach = (center: Vec2, shape: Shape, position: Vec2): number =>
  Math.max(0, length(sub(position, center)) - innerRadius(shape));

/**
 * One attempt at one level. Owns the game rules: placement, detonation,
 * damage, shattering, chain reactions, settling and scoring. It drives physics
 * only through the PhysicsWorld port and reports through events.
 */
export class LevelSession {
  private readonly entities = new Map<string, Entity>();
  private readonly chargeList: Charge[] = [];
  private readonly pending: Detonation[] = [];
  private readonly rng: () => number;
  private nextChargeId = 1;
  private nextEntityId = 1;
  private time = 0;
  private firedAt = 0;
  private calmFor = 0;
  private currentPhase: Phase = 'placing';
  private finalResult: LevelResult | undefined;
  private readonly structuralTotal: number;
  private readonly targetTotal: number;
  private lostStructural = 0;
  private compromisedCount = 0;
  /** Footprint material area from debris removed by the debris budget while inside the site. */
  private retiredInside = 0;
  private finishedAt = 0;

  constructor(
    readonly level: LevelDefinition,
    private readonly physics: PhysicsWorld,
    private readonly events: EventBus<GameEvents>,
  ) {
    this.rng = createRng(hashString(level.id));
    physics.add({
      id: GROUND_ID,
      shape: { kind: 'rect', w: WORLD.width + TUNING.outOfBoundsMargin * 4, h: 120 },
      position: vec(WORLD.width / 2, WORLD.groundY + 60),
      angle: 0,
      material: 'concrete',
      isStatic: true,
    });
    for (const b of level.blocks) {
      this.spawn({
        kind: 'block',
        shape: { kind: 'rect', w: b.w, h: b.h },
        position: vec(b.x, b.y),
        angle: b.angle,
        material: b.material,
        target: b.target,
        guarded: b.protected,
        anchored: b.anchored,
        structural: !b.protected && !b.anchored,
      });
    }
    for (const p of level.barrels) {
      this.spawn({ kind: 'barrel', shape: { kind: 'circle', r: TUNING.barrel.radius }, position: p, angle: 0, material: 'metal' });
    }
    for (const c of level.cars) {
      const direction = c.mode === 'flow' || c.x < c.to ? 1 : -1;
      this.spawn({
        kind: 'car',
        shape: { kind: 'rect', w: c.w, h: c.h },
        position: vec(c.x, c.y),
        angle: 0,
        material: 'vehicle',
        target: c.target,
        guarded: c.protected,
        // Trains run on rails.
        kinematic: c.style === 'train',
        driver: { def: c, direction, engine: c.speed > 0, wrecked: false },
      });
    }
    this.structuralTotal = level.blocks.filter((b) => !b.protected && !b.anchored).length;
    this.targetTotal = level.blocks.filter((b) => b.target).length + level.cars.filter((c) => c.target).length;
  }

  get phase(): Phase {
    return this.currentPhase;
  }

  get charges(): readonly Charge[] {
    return this.chargeList;
  }

  get chargesLeft(): number {
    return this.level.charges.max - this.chargeList.length;
  }

  /** Charges that were fired but whose fuse is still burning. */
  get armedCharges(): { readonly position: Vec2; readonly kind: ChargeKind }[] {
    const armed: { position: Vec2; kind: ChargeKind }[] = [];
    for (const d of this.pending) {
      if (d.blast === 'standard' || d.blast === 'precision') armed.push({ position: d.position, kind: d.blast });
    }
    return armed;
  }

  get result(): LevelResult | undefined {
    return this.finalResult;
  }

  /** Protected property in this job: buildings and third-party vehicles. */
  get protectedTotal(): number {
    return this.level.blocks.filter((b) => b.protected).length + this.level.cars.filter((c) => c.protected).length;
  }

  /** Simulated seconds since the session began (placing included). */
  get clock(): number {
    return this.time;
  }

  get elapsedSinceFire(): number {
    return this.currentPhase === 'placing' ? 0 : this.time - this.firedAt;
  }

  get targetsRemaining(): number {
    let n = 0;
    for (const e of this.entities.values()) if (e.target && !e.down) n++;
    return n;
  }

  *view(): Generator<EntityView> {
    for (const e of this.entities.values()) {
      const state = this.physics.state(e.id);
      if (!state) continue;
      yield {
        id: e.id,
        kind: e.kind,
        shape: e.shape,
        material: e.material,
        target: e.target,
        down: e.down,
        protected: e.guarded,
        compromised: e.compromised,
        anchored: e.anchored,
        damage: Number.isFinite(e.maxHp) ? 1 - Math.max(0, e.hp) / e.maxHp : 0,
        state,
        car: e.driver && {
          style: e.driver.def.style,
          driving: e.driver.engine,
          wrecked: e.driver.wrecked,
          direction: e.driver.direction,
          route: { from: e.driver.def.from, to: e.driver.def.to, y: e.driver.def.y, oneWay: e.driver.def.mode === 'flow' },
        },
      };
    }
  }

  /** Protected buildings a charge at `center` would reach — the preview of the contract rule in `explode`. */
  protectedReachedFrom(center: Vec2, kind: ChargeKind = 'standard'): string[] {
    const reached: string[] = [];
    for (const e of this.entities.values()) {
      if (!e.guarded) continue;
      const s = this.physics.state(e.id);
      if (s && circleTouches(center, chargeRadius(kind), e.shape, s.position, s.angle)) reached.push(e.id);
    }
    return reached;
  }

  /** `radius` lets touch input use a bigger, finger-sized pick area. */
  chargeAt(position: Vec2, radius: number = TUNING.charge.pickRadius): Charge | undefined {
    return this.chargeList.find((c) => distance(c.position, position) <= radius);
  }

  canPlaceAt(position: Vec2, ignore?: number): Result<void, PlacementError> {
    if (this.currentPhase !== 'placing') return err('not-placing');
    if (!this.level.zones.some((z) => rectContains(z, position))) return err('outside-zone');
    const crowded = this.chargeList.some(
      (c) => c.id !== ignore && distance(c.position, position) < TUNING.charge.placementSpacing,
    );
    return crowded ? err('too-close') : ok(undefined);
  }

  /** Without an explicit delay, a new charge fires one step after the latest one. */
  placeCharge(position: Vec2, delay?: number, kind: ChargeKind = 'standard'): Result<Charge, PlacementError> {
    if (this.currentPhase === 'placing' && this.chargesLeft <= 0) return err('no-charges-left');
    if (this.currentPhase === 'placing' && !this.level.chargeKinds.includes(kind)) return err('kind-unavailable');
    const allowed = this.canPlaceAt(position);
    if (!allowed.ok) return allowed;
    const latest = this.chargeList.reduce((m, c) => Math.max(m, c.delay), -TUNING.charge.delay.defaultStep);
    const charge = {
      id: this.nextChargeId++,
      position,
      delay: quantizeDelay(delay ?? latest + TUNING.charge.delay.defaultStep),
      kind,
    };
    this.chargeList.push(charge);
    this.events.emit('chargePlaced', { position });
    return ok(charge);
  }

  moveCharge(id: number, position: Vec2): Result<Charge, PlacementError> {
    const index = this.chargeList.findIndex((c) => c.id === id);
    const current = this.chargeList[index];
    if (!current) return err('unknown-charge');
    const allowed = this.canPlaceAt(position, id);
    if (!allowed.ok) return allowed;
    const moved = { ...current, position };
    this.chargeList[index] = moved;
    return ok(moved);
  }

  setChargeDelay(id: number, seconds: number): Result<Charge, PlacementError> {
    if (this.currentPhase !== 'placing') return err('not-placing');
    const index = this.chargeList.findIndex((c) => c.id === id);
    const current = this.chargeList[index];
    if (!current) return err('unknown-charge');
    const updated = { ...current, delay: quantizeDelay(seconds) };
    this.chargeList[index] = updated;
    return ok(updated);
  }

  removeCharge(id: number): void {
    if (this.currentPhase !== 'placing') return;
    const index = this.chargeList.findIndex((c) => c.id === id);
    const [removed] = index >= 0 ? this.chargeList.splice(index, 1) : [];
    if (removed) this.events.emit('chargeRemoved', { position: removed.position });
  }

  fire(): Result<void, FireError> {
    if (this.currentPhase !== 'placing') return err('not-placing');
    if (this.chargeList.length === 0) return err('no-charges');
    this.currentPhase = 'running';
    this.firedAt = this.time;
    for (const c of this.chargeList) {
      this.pending.push({ at: this.time + c.delay, position: c.position, blast: c.kind });
    }
    return ok(undefined);
  }

  /**
   * Advances by a fixed step. While placing, the world is frozen except for
   * cars, which drive along their routes so the player can time the fire.
   */
  step(dt: number): void {
    if (this.currentPhase === 'finished') return;
    this.time += dt;
    if (this.currentPhase === 'placing') {
      this.cruise(dt);
      return;
    }
    this.detonateDue();
    this.drive();
    this.cruise(dt, true);
    this.physics.step(dt);
    this.applyImpacts();
    this.removeOutOfBounds();
    this.updateTargets();
    this.updateProtected();
    this.enforceDebrisBudget();
    this.checkSettled(dt);
  }

  // ---- detonation --------------------------------------------------------

  private detonateDue(): void {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const d = this.pending[i];
      if (d && d.at <= this.time) {
        this.pending.splice(i, 1);
        this.explode(d.position, d.blast);
      }
    }
  }

  private explode(center: Vec2, blast: BlastKind): void {
    const spec = BLASTS[blast];
    const source = sourceOf(blast);
    const radius = spec.radius;
    this.events.emit('explosion', {
      position: center,
      radius,
      power: spec.pressure / TUNING.charge.pressure,
      source,
    });

    const broken: Entity[] = [];
    for (const e of [...this.entities.values()]) {
      const state = this.physics.state(e.id);
      if (!state) continue;
      const offset = sub(state.position, center);
      const reach = blastReach(center, e.shape, state.position);
      // Contract rule, shown to the player as the blast circle: no blast may touch protected property.
      if (e.guarded && circleTouches(center, radius, e.shape, state.position, state.angle)) this.compromise(e, state.position);
      if (reach >= radius) continue;
      const falloff = Math.pow(1 - reach / radius, 1.2);
      const dir = length(offset) > 0.001 ? scale(offset, 1 / length(offset)) : vec(0, -1);
      const speed = (spec.pressure * falloff) / MATERIALS[e.material].density;
      const dv = vec(dir.x * speed, (dir.y - TUNING.charge.lift) * speed);
      // Bodies spin away from the side the blast struck; lighter materials spin more.
      const spin = (offset.x >= 0 ? 1 : -1) * falloff * 4 * (0.5 + this.rng());
      this.physics.kick(e.id, dv, spin * (MATERIALS.wood.density / MATERIALS[e.material].density));
      const amount = spec.damage * falloff;
      if (e.driver && amount > TUNING.vehicle.stallDamage) e.driver.engine = false;
      if (this.damage(e, amount)) broken.push(e);
    }
    for (const e of broken) this.breakEntity(e, center);
  }

  /** Returns true when the entity just reached zero hit points. */
  private damage(e: Entity, amount: number): boolean {
    if (amount <= 0 || e.hp <= 0 || !Number.isFinite(e.hp)) return false;
    e.hp -= amount;
    return e.hp <= 0;
  }

  private breakEntity(e: Entity, blastOrigin: Vec2 | undefined): void {
    const state = this.physics.state(e.id);
    if (!state) return;
    if (e.kind === 'barrel') {
      this.removeEntity(e);
      this.pending.push({ at: this.time + TUNING.barrel.delay, position: state.position, blast: 'barrel' });
      return;
    }
    if (e.driver) {
      // Cars are wrecked, not shattered: the engine dies and the fuel tank goes up.
      this.compromise(e, state.position);
      e.driver.engine = false;
      e.driver.wrecked = true;
      this.events.emit('carWrecked', { position: state.position });
      this.pending.push({ at: this.time + TUNING.vehicle.delay, position: state.position, blast: 'vehicle' });
      if (e.target) this.markDown(e, state.position);
      return;
    }
    if (e.shape.kind !== 'rect') return;
    const shards = shatter(
      { ...state, w: e.shape.w, h: e.shape.h, material: e.material },
      blastOrigin,
      this.rng,
    );
    this.compromise(e, state.position);
    this.removeEntity(e);
    if (e.structural) this.lostStructural++;
    this.events.emit('blockShattered', {
      position: state.position,
      material: e.material,
      size: Math.sqrt(area(e.shape)),
    });
    if (e.target) this.markDown(e, state.position);
    for (const s of shards) {
      this.spawn({
        kind: 'debris',
        shape: { kind: 'rect', w: s.w, h: s.h },
        position: s.position,
        angle: s.angle,
        material: e.material,
        motion: { velocity: s.velocity, angularVelocity: s.angularVelocity },
        fromStructure: e.structural,
      });
    }
  }

  // ---- cars --------------------------------------------------------------

  /**
   * Scripted driving: every vehicle while the world is frozen (exact, so timing
   * is learnable), and trains always, because trains run on rails.
   */
  private cruise(dt: number, railOnly = false): void {
    for (const e of this.entities.values()) {
      const d = e.driver;
      const s = this.physics.state(e.id);
      if (!d?.engine || !s) continue;
      if (railOnly && d.def.style !== 'train') continue;
      let x = s.position.x + d.direction * d.def.speed * dt;
      if (d.def.mode === 'flow') {
        if (x >= d.def.to) x = d.def.from + (x - d.def.to);
      } else if (x >= d.def.to || x <= d.def.from) {
        x = Math.min(d.def.to, Math.max(d.def.from, x));
        d.direction = d.direction === 1 ? -1 : 1;
      }
      this.physics.setPose(e.id, vec(x, d.def.y), vec(d.direction * d.def.speed, 0));
    }
  }

  /** Physical driving after Fire: hold cruising speed until stalled, tipped or off the road. */
  private drive(): void {
    for (const e of this.entities.values()) {
      const d = e.driver;
      const s = this.physics.state(e.id);
      if (!d?.engine || !s || d.def.style === 'train') continue;
      if (Math.abs(s.angle) > TUNING.vehicle.maxTilt || s.position.y > d.def.y + 8) {
        d.engine = false;
        continue;
      }
      if (d.def.mode === 'flow' && s.position.x >= d.def.to) {
        this.physics.setPose(e.id, vec(d.def.from, d.def.y), vec(d.def.speed, 0));
        continue;
      }
      if ((d.direction === 1 && s.position.x >= d.def.to) || (d.direction === -1 && s.position.x <= d.def.from)) {
        d.direction = d.direction === 1 ? -1 : 1;
      }
      // Hold cruising speed and keep the body level, as a driver would.
      this.physics.kick(e.id, vec(d.direction * d.def.speed - s.velocity.x, 0), -s.angularVelocity);
    }
  }

  // ---- per-step rules ----------------------------------------------------

  private applyImpacts(): void {
    const broken = new Map<Entity, Vec2>();
    for (const impact of this.physics.drainImpacts()) {
      const over = impact.speed - TUNING.impact.threshold;
      if (over <= 0) continue;
      const amount = over * TUNING.impact.damagePerSpeed;
      for (const id of [impact.a, impact.b]) {
        const e = this.entities.get(id);
        if (!e || e.kind === 'debris') continue;
        const intensity = Math.min(1, over / 900);
        if (intensity >= TUNING.impact.reportAbove) {
          this.events.emit('blockHit', { position: impact.point, material: e.material, intensity });
        }
        if (this.damage(e, amount)) broken.set(e, impact.point);
      }
    }
    for (const [e] of broken) this.breakEntity(e, undefined);
  }

  private removeOutOfBounds(): void {
    const m = TUNING.outOfBoundsMargin;
    for (const e of [...this.entities.values()]) {
      const s = this.physics.state(e.id);
      if (!s) continue;
      const p = s.position;
      // Traffic still on its route may run past the edges; it comes back.
      const onRoute = e.driver?.engine === true;
      if (p.y > WORLD.height + m || (!onRoute && (p.x < -m || p.x > WORLD.width + m))) {
        if (e.target) this.markDown(e, p);
        this.compromise(e, p);
        if (e.structural) this.lostStructural++;
        this.removeEntity(e);
      }
    }
  }

  private updateTargets(): void {
    for (const e of this.entities.values()) {
      if (!e.target || e.down) continue;
      const s = this.physics.state(e.id);
      if (!s) continue;
      // A target lying on rubble counts as down once it has lost most of its height.
      const start = clearance(e.shape, e.origin.position);
      const now = clearance(e.shape, s.position);
      if (now <= Math.max(TUNING.downTolerance, start * TUNING.downFraction)) this.markDown(e, s.position);
    }
  }

  private updateProtected(): void {
    const p = TUNING.protection;
    for (const e of this.entities.values()) {
      if (!e.guarded || e.compromised) continue;
      const s = this.physics.state(e.id);
      if (!s) continue;
      // A moving vehicle travels by design: judge it by leaving its track, tilting, stalling or damage.
      const moved = e.driver
        ? Math.abs(s.position.y - e.driver.def.y) >= p.displacement || !e.driver.engine
        : distance(s.position, e.origin.position) >= p.displacement;
      if (
        moved ||
        Math.abs(s.angle - e.origin.angle) >= p.rotation ||
        e.hp <= e.maxHp * (1 - p.strengthLoss)
      ) {
        this.compromise(e, s.position);
      }
    }
  }

  private compromise(e: Entity, position: Vec2): void {
    if (!e.guarded || e.compromised) return;
    e.compromised = true;
    this.compromisedCount++;
    this.events.emit('protectedDamaged', { position });
  }

  private enforceDebrisBudget(): void {
    let debris = 0;
    for (const e of this.entities.values()) if (e.kind === 'debris') debris++;
    if (debris <= TUNING.debrisBudget) return;
    // Map iteration follows insertion order, so the oldest debris goes first.
    for (const e of [...this.entities.values()]) {
      if (debris <= TUNING.debrisBudget) break;
      if (e.kind === 'debris') {
        // Old debris has settled: remember whether its material ended up inside the site.
        const s = this.physics.state(e.id);
        if (e.fromStructure && s && this.insideFootprint(s.position.x)) this.retiredInside += area(e.shape);
        this.removeEntity(e);
        debris--;
      }
    }
  }

  private checkSettled(dt: number): void {
    if (this.pending.length > 0) {
      this.calmFor = 0;
      return;
    }
    let calm = true;
    for (const e of this.entities.values()) {
      if (e.driver?.engine) continue; // a car driving its route never settles, by design
      const s = this.physics.state(e.id);
      if (s && (length(s.velocity) > TUNING.settle.linear || Math.abs(s.angularVelocity) > TUNING.settle.angular)) {
        calm = false;
        break;
      }
    }
    this.calmFor = calm ? this.calmFor + dt : 0;
    if (this.calmFor >= TUNING.settle.hold || this.elapsedSinceFire >= TUNING.settle.timeout) this.finish();
  }

  private finish(): void {
    let collapsed = this.lostStructural;
    for (const e of this.entities.values()) {
      if (!e.structural) continue;
      const s = this.physics.state(e.id);
      if (!s) continue;
      if (
        distance(s.position, e.origin.position) >= TUNING.collapse.displacement ||
        Math.abs(s.angle - e.origin.angle) >= TUNING.collapse.rotation
      ) {
        collapsed++;
      }
    }
    this.currentPhase = 'finished';
    this.finishedAt = this.time;
    this.finalResult = scoreLevel(
      {
        targetsDown: this.targetTotal - this.targetsRemaining,
        targetsTotal: this.targetTotal,
        chargesUsed: this.chargeList.length,
        chargesMax: this.level.charges.max,
        blocksCollapsed: Math.min(collapsed, this.structuralTotal),
        blocksTotal: this.structuralTotal,
        protectedTotal: this.protectedTotal,
        protectedDamaged: this.compromisedCount,
        duration: this.finishedAt - this.firedAt,
        footprint: this.level.footprint && {
          achieved: this.containment(),
          required: this.level.footprint.ratio,
        },
      },
      { par: this.level.charges.par, bonusCollapse: this.level.bonusCollapse },
    );
    this.events.emit('levelFinished', { result: this.finalResult });
  }

  // ---- footprint ---------------------------------------------------------

  private insideFootprint(x: number): boolean {
    const f = this.level.footprint;
    return f !== undefined && x >= f.from && x <= f.to;
  }

  /**
   * Share of the structure's material (by area) inside the site: standing
   * blocks, their debris, and debris retired while inside. Anything thrown
   * out of the world counts as outside.
   */
  private containment(): number {
    const total = this.level.blocks
      .filter((b) => !b.protected && !b.anchored)
      .reduce((sum, b) => sum + b.w * b.h, 0);
    if (total === 0) return 1;
    let inside = this.retiredInside;
    for (const e of this.entities.values()) {
      if (!e.structural && !e.fromStructure) continue;
      const s = this.physics.state(e.id);
      if (s && this.insideFootprint(s.position.x)) inside += area(e.shape);
    }
    return Math.min(1, inside / total);
  }

  // ---- entity bookkeeping ------------------------------------------------

  private markDown(e: Entity, position: Vec2): void {
    if (!e.target || e.down) return;
    e.down = true;
    this.events.emit('targetDown', { position, remaining: this.targetsRemaining });
  }

  private spawn(spec: SpawnSpec): void {
    const id = `${spec.kind}-${this.nextEntityId++}`;
    const maxHp =
      spec.kind === 'barrel'
        ? TUNING.barrel.trigger
        : spec.kind === 'debris' || spec.anchored
          ? Infinity
          : MATERIALS[spec.material].strength;
    this.entities.set(id, {
      id,
      kind: spec.kind,
      shape: spec.shape,
      material: spec.material,
      target: spec.target ?? false,
      structural: spec.structural ?? false,
      guarded: spec.guarded ?? false,
      anchored: spec.anchored ?? false,
      fromStructure: spec.fromStructure ?? false,
      compromised: false,
      origin: { position: spec.position, angle: spec.angle },
      hp: maxHp,
      maxHp,
      down: false,
      driver: spec.driver,
    });
    this.physics.add({
      id,
      shape: spec.shape,
      position: spec.position,
      angle: spec.angle,
      material: spec.material,
      isStatic: spec.anchored ?? false,
      ...(spec.kinematic ? { kinematic: true } : {}),
      ...(spec.motion ? { velocity: spec.motion.velocity, angularVelocity: spec.motion.angularVelocity } : {}),
    });
  }

  private removeEntity(e: Entity): void {
    this.entities.delete(e.id);
    this.physics.remove(e.id);
  }
}
