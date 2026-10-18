import { isMaterialId, type MaterialId } from './materials';

export const CHARGE_KINDS = ['standard', 'precision', 'implosion', 'bomb', 'roller', 'directional'] as const;
export type ChargeKind = (typeof CHARGE_KINDS)[number];
const isChargeKind = (v: unknown): v is ChargeKind => typeof v === 'string' && (CHARGE_KINDS as readonly string[]).includes(v);
import type { Rect, Vec2 } from './math';
import { err, ok, type Result } from './result';

/** Fixed logical world. The renderer scales it to the screen. */
export const WORLD = { width: 960, height: 540, groundY: 480 } as const;

/** Distance above the ground a target's centre must start, so it is not "down" at spawn. */
export const TARGET_MIN_CLEARANCE = 24;

export interface BlockDef {
  /** Centre position. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly angle: number;
  readonly material: MaterialId;
  readonly target: boolean;
  /** A neighbouring building that must come through the job undamaged. */
  readonly protected: boolean;
  /** Fixed infrastructure (road decks, bridge piers): immovable, indestructible, not part of the job. */
  readonly anchored: boolean;
}

/** A car that drives back and forth between `from` and `to` (centre x) at `speed` px/s. */
export interface CarDef {
  readonly x: number;
  /** Centre y; the car rests on whatever is below it. */
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly from: number;
  readonly to: number;
  readonly speed: number;
  readonly target: boolean;
  /** `patrol` drives back and forth; `flow` is one-way traffic that re-enters at `from` after reaching `to`. */
  readonly mode: 'patrol' | 'flow';
  /** Third-party traffic (a scheduled train): must come through the job untouched. */
  readonly protected: boolean;
  /** Trains and trams run on rails: scripted all the way, immune to pushes, stopped only by damage. */
  readonly style: VehicleStyle;
}

export const VEHICLE_STYLES = ['car', 'train', 'tram'] as const;
export type VehicleStyle = (typeof VEHICLE_STYLES)[number];

/** Rail vehicles keep to their track whatever hits them; cars are driven physically after Fire. */
export const onRails = (c: Pick<CarDef, 'style'>): boolean => c.style !== 'car';

/** Vehicles may run on past the screen edges, so traffic enters and leaves naturally. */
export const ROUTE_OVERRUN = 400;

export interface SolutionCharge extends Vec2 {
  /** Detonation delay in seconds; omitted means the default sequence. */
  readonly delay: number | undefined;
  readonly kind: ChargeKind;
  /** Which way a rolling charge drives; omitted means toward the targets. */
  readonly direction?: 1 | -1;
}

/** How many charges of each kind a job hands out, when it limits them by kind (a loadout). */
export type ChargeStock = Readonly<Partial<Record<ChargeKind, number>>>;

/** The ground strip the collapse must stay inside, and the share of the material that must end up there. */
export interface Footprint {
  readonly from: number;
  readonly to: number;
  readonly ratio: number;
}

export interface LevelSolution {
  readonly charges: readonly SolutionCharge[];
  /** Seconds after Fire at which the detonator is pressed (free-fall bombs). */
  readonly detonateAt: readonly number[];
  /** Seconds after the level starts to press Fire (matters when cars move). */
  readonly fireAt: number;
}

/**
 * A wrecking ball on a crane: hangs from `hook` on a rope of `length`, pulled
 * back to `angle` (radians from straight down; positive swings to the right).
 * It swings once the job is fired; a blast at the hook cuts the rope.
 */
export interface WreckingBallDef {
  readonly hook: Vec2;
  readonly length: number;
  readonly angle: number;
  readonly radius: number;
}

export interface LevelDefinition {
  readonly id: string;
  readonly name: string;
  readonly world: number;
  readonly order: number;
  readonly hint: string | undefined;
  /**
   * Charges the player may place, and the par for the second star. With a
   * `stock`, each kind has its own count (and `max` is their sum): the player
   * has to choose which of the handed-out charges to use, and where.
   */
  readonly charges: { readonly max: number; readonly par: number; readonly stock?: ChargeStock };
  /** Fraction of blocks that must collapse for the third star. */
  readonly bonusCollapse: number;
  readonly zones: readonly Rect[];
  /** Where free-fall bombs may be hung (usually sky above the structure). */
  readonly dropZones: readonly Rect[];
  readonly blocks: readonly BlockDef[];
  readonly barrels: readonly Vec2[];
  readonly cars: readonly CarDef[];
  readonly balls: readonly WreckingBallDef[];
  /** Charge types the player may use here. */
  readonly chargeKinds: readonly ChargeKind[];
  readonly footprint: Footprint | undefined;
  /** Smash play (Free Site only): a tap sets off a blast at once, and the job never ends by itself. */
  readonly instantBlasts?: true;
  /** A known winning placement and timing, used by tests to prove the level is solvable. */
  readonly solution: LevelSolution;
}

export interface LevelError {
  readonly kind: 'invalid-level';
  readonly path: string;
  readonly message: string;
}

type Obj = Record<string, unknown>;

class Invalid {
  constructor(
    readonly path: string,
    readonly message: string,
  ) {}
}

const fail = (path: string, message: string): never => {
  throw new Invalid(path, message);
};

const obj = (v: unknown, path: string): Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Obj) : fail(path, 'expected object');

const arr = (v: unknown, path: string): unknown[] => (Array.isArray(v) ? v : fail(path, 'expected array'));

const num = (v: unknown, path: string, min = -Infinity, max = Infinity): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
    ? v
    : fail(path, `expected number in [${min}, ${max}]`);

const int = (v: unknown, path: string, min: number, max: number): number =>
  Number.isInteger(num(v, path, min, max)) ? (v as number) : fail(path, 'expected integer');

const str = (v: unknown, path: string): string =>
  typeof v === 'string' && v.length > 0 ? v : fail(path, 'expected non-empty string');

const point = (v: unknown, path: string): Vec2 => {
  const o = obj(v, path);
  return {
    x: num(o.x, `${path}.x`, 0, WORLD.width),
    y: num(o.y, `${path}.y`, 0, WORLD.groundY),
  };
};

const rect = (v: unknown, path: string): Rect => {
  const o = obj(v, path);
  return {
    x: num(o.x, `${path}.x`, 0, WORLD.width),
    y: num(o.y, `${path}.y`, 0, WORLD.groundY),
    w: num(o.w, `${path}.w`, 1, WORLD.width),
    h: num(o.h, `${path}.h`, 1, WORLD.height),
  };
};

const block = (v: unknown, path: string): BlockDef => {
  const o = obj(v, path);
  const material = isMaterialId(o.material) ? o.material : fail(`${path}.material`, 'unknown material');
  const target = o.target === undefined ? false : o.target === true || fail(`${path}.target`, 'expected boolean');
  const guarded =
    o.protected === undefined ? false : o.protected === true || fail(`${path}.protected`, 'expected boolean');
  const anchored =
    o.anchored === undefined ? false : o.anchored === true || fail(`${path}.anchored`, 'expected boolean');
  if (Number(target) + Number(guarded) + Number(anchored) > 1) {
    fail(path, 'a block is at most one of target, protected or anchored');
  }
  const def: BlockDef = {
    x: num(o.x, `${path}.x`, 0, WORLD.width),
    y: num(o.y, `${path}.y`, 0, WORLD.groundY),
    w: num(o.w, `${path}.w`, 4, 600),
    h: num(o.h, `${path}.h`, 4, 400),
    angle: o.angle === undefined ? 0 : num(o.angle, `${path}.angle`, -Math.PI, Math.PI),
    material,
    target,
    protected: guarded,
    anchored,
  };
  if (def.target && !startsClear(def.y, def.w, def.h)) fail(path, 'target must start clear of the ground');
  return def;
};

const startsClear = (y: number, w: number, h: number): boolean =>
  y <= WORLD.groundY - Math.max(w, h) / 2 - TARGET_MIN_CLEARANCE;

const car = (v: unknown, path: string): CarDef => {
  const o = obj(v, path);
  const def: CarDef = {
    x: num(o.x, `${path}.x`, -ROUTE_OVERRUN, WORLD.width + ROUTE_OVERRUN),
    y: num(o.y, `${path}.y`, 0, WORLD.groundY),
    w: num(o.w, `${path}.w`, 20, 320),
    h: num(o.h, `${path}.h`, 10, 100),
    from: num(o.from, `${path}.from`, -ROUTE_OVERRUN, WORLD.width + ROUTE_OVERRUN),
    to: num(o.to, `${path}.to`, -ROUTE_OVERRUN, WORLD.width + ROUTE_OVERRUN),
    speed: num(o.speed, `${path}.speed`, 0, 400),
    target: o.target === undefined ? false : o.target === true || fail(`${path}.target`, 'expected boolean'),
    mode: o.mode === undefined || o.mode === 'patrol' ? 'patrol' : o.mode === 'flow' ? 'flow' : fail(`${path}.mode`, 'expected patrol or flow'),
    protected: o.protected === undefined ? false : o.protected === true || fail(`${path}.protected`, 'expected boolean'),
    style: o.style === undefined ? 'car' : (VEHICLE_STYLES as readonly unknown[]).includes(o.style) ? (o.style as VehicleStyle) : fail(`${path}.style`, 'expected car, train or tram'),
  };
  if (def.target && def.protected) fail(path, 'a vehicle cannot be both a target and protected');
  if (def.from > def.to) fail(path, 'from must not exceed to');
  if (def.x < def.from || def.x > def.to) fail(`${path}.x`, 'car must start on its route');
  if (def.target && !startsClear(def.y, def.w, def.h)) fail(path, 'target must start clear of the ground');
  return def;
};

const wreckingBall = (v: unknown, path: string): WreckingBallDef => {
  const o = obj(v, path);
  return {
    hook: point(o.hook, `${path}.hook`),
    length: num(o.length, `${path}.length`, 40, 420),
    angle: o.angle === undefined ? 0 : num(o.angle, `${path}.angle`, -1.5, 1.5),
    radius: o.radius === undefined ? 24 : num(o.radius, `${path}.radius`, 10, 40),
  };
};

const solution = (v: unknown, path: string, maxCharges: number, minCharges: number): LevelSolution => {
  const o = obj(v, path);
  const charges = arr(o.charges, `${path}.charges`).map((s, i): SolutionCharge => {
    const at = `${path}.charges[${i}]`;
    const o = obj(s, at);
    const kind = o.kind === undefined ? 'standard' : isChargeKind(o.kind) ? o.kind : fail(`${at}.kind`, 'unknown charge kind');
    const direction = o.dir === undefined ? undefined : o.dir === 1 || o.dir === -1 ? o.dir : fail(`${at}.dir`, 'dir must be 1 or -1');
    const base = { ...point(s, at), delay: o.delay === undefined ? undefined : num(o.delay, `${at}.delay`, 0, 2), kind };
    return direction === undefined ? base : { ...base, direction };
  });
  if (charges.length < minCharges || charges.length > maxCharges) fail(`${path}.charges`, `solution must use ${minCharges}..max charges`);
  const detonateAt =
    o.detonateAt === undefined ? [] : arr(o.detonateAt, `${path}.detonateAt`).map((t, i) => num(t, `${path}.detonateAt[${i}]`, 0, 10));
  return { charges, detonateAt, fireAt: o.fireAt === undefined ? 0 : num(o.fireAt, `${path}.fireAt`, 0, 30) };
};

/** A loadout: a count for each offered kind, adding up to the job's charge limit. */
const chargeStock = (v: unknown, path: string, kinds: readonly ChargeKind[], max: number): ChargeStock => {
  const o = obj(v, path);
  const stock: Partial<Record<ChargeKind, number>> = {};
  for (const [k, n] of Object.entries(o)) {
    if (!isChargeKind(k) || !kinds.includes(k)) fail(`${path}.${k}`, 'stock kind must be one of chargeKinds');
    stock[k as ChargeKind] = int(n, `${path}.${k}`, 1, 6);
  }
  const total = Object.values(stock).reduce((a, b) => a + b, 0);
  if (total !== max) fail(path, `stock must add up to charges.max (${max}), got ${total}`);
  return stock;
};

/** The shipped solution must fit the loadout too. */
const withinStock = (s: LevelSolution, stock: ChargeStock | undefined, path: string): LevelSolution => {
  if (!stock) return s;
  for (const k of CHARGE_KINDS) {
    const used = s.charges.filter((c) => c.kind === k).length;
    if (used > (stock[k] ?? 0)) fail(`${path}.charges`, `uses ${used} ${k} but the stock has ${stock[k] ?? 0}`);
  }
  return s;
};

const footprint = (v: unknown, path: string): Footprint => {
  const o = obj(v, path);
  const def = {
    from: num(o.from, `${path}.from`, 0, WORLD.width),
    to: num(o.to, `${path}.to`, 0, WORLD.width),
    ratio: num(o.ratio, `${path}.ratio`, 0, 1),
  };
  if (def.from >= def.to) fail(path, 'from must be left of to');
  return def;
};

/** Parses untrusted level data at the content boundary. */
export const parseLevel = (input: unknown): Result<LevelDefinition, LevelError> => {
  try {
    const o = obj(input, '$');
    const id = str(o.id, '$.id');
    const p = `level(${id})`;
    const chargesObj = obj(o.charges, `${p}.charges`);
    const max = int(chargesObj.max, `${p}.charges.max`, 1, 6);
    const par = int(chargesObj.par, `${p}.charges.par`, 1, max);
    const blocks = arr(o.blocks, `${p}.blocks`).map((b, i) => block(b, `${p}.blocks[${i}]`));
    const cars = o.cars === undefined ? [] : arr(o.cars, `${p}.cars`).map((c, i) => car(c, `${p}.cars[${i}]`));
    const chargeKinds =
      o.chargeKinds === undefined
        ? (['standard'] as const)
        : arr(o.chargeKinds, `${p}.chargeKinds`).map((k, i) =>
            isChargeKind(k) ? k : fail(`${p}.chargeKinds[${i}]`, 'unknown charge kind'),
          );
    if (chargeKinds.length === 0) fail(`${p}.chargeKinds`, 'at least one charge kind');
    const stock = chargesObj.stock === undefined ? undefined : chargeStock(chargesObj.stock, `${p}.charges.stock`, chargeKinds, max);
    if (!blocks.some((b) => b.target) && !cars.some((c) => c.target)) fail(`${p}.blocks`, 'level needs at least one target');
    const zones = arr(o.zones, `${p}.zones`).map((z, i) => rect(z, `${p}.zones[${i}]`));
    const balls = o.balls === undefined ? [] : arr(o.balls, `${p}.balls`).map((b, i) => wreckingBall(b, `${p}.balls[${i}]`));
    if (zones.length === 0) fail(`${p}.zones`, 'level needs at least one placement zone');
    return ok({
      id,
      name: str(o.name, `${p}.name`),
      world: int(o.world, `${p}.world`, 1, 99),
      order: int(o.order, `${p}.order`, 1, 99),
      hint: o.hint === undefined ? undefined : str(o.hint, `${p}.hint`),
      charges: stock ? { max, par, stock } : { max, par },
      bonusCollapse: num(o.bonusCollapse, `${p}.bonusCollapse`, 0, 1),
      zones,
      dropZones: o.dropZones === undefined ? [] : arr(o.dropZones, `${p}.dropZones`).map((z, i) => rect(z, `${p}.dropZones[${i}]`)),
      blocks,
      barrels: o.barrels === undefined ? [] : arr(o.barrels, `${p}.barrels`).map((b, i) => point(b, `${p}.barrels[${i}]`)),
      cars,
      balls,
      chargeKinds,
      footprint: o.footprint === undefined ? undefined : footprint(o.footprint, `${p}.footprint`),
      // A wrecking ball can do a job alone (Fire releases it), so its solution may place no charges.
      solution: withinStock(solution(o.solution, `${p}.solution`, max, balls.length > 0 ? 0 : 1), stock, `${p}.solution`),
    });
  } catch (e) {
    if (e instanceof Invalid) return err({ kind: 'invalid-level', path: e.path, message: e.message });
    throw e;
  }
};

export const parseLevelPack = (input: unknown): Result<LevelDefinition[], LevelError> => {
  if (!Array.isArray(input)) return err({ kind: 'invalid-level', path: '$', message: 'expected array' });
  const levels: LevelDefinition[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const parsed = parseLevel(raw);
    if (!parsed.ok) return parsed;
    if (seen.has(parsed.value.id)) {
      return err({ kind: 'invalid-level', path: parsed.value.id, message: 'duplicate level id' });
    }
    seen.add(parsed.value.id);
    levels.push(parsed.value);
  }
  levels.sort((a, b) => a.world - b.world || a.order - b.order);
  return ok(levels);
};
