import { isMaterialId, type MaterialId } from './materials';
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
}

export interface SolutionCharge extends Vec2 {
  /** Detonation delay in seconds; omitted means the default sequence. */
  readonly delay: number | undefined;
}

export interface LevelSolution {
  readonly charges: readonly SolutionCharge[];
  /** Seconds after the level starts to press Fire (matters when cars move). */
  readonly fireAt: number;
}

export interface LevelDefinition {
  readonly id: string;
  readonly name: string;
  readonly world: number;
  readonly order: number;
  readonly hint: string | undefined;
  /** Charges the player may place, and the par for the second star. */
  readonly charges: { readonly max: number; readonly par: number };
  /** Fraction of blocks that must collapse for the third star. */
  readonly bonusCollapse: number;
  readonly zones: readonly Rect[];
  readonly blocks: readonly BlockDef[];
  readonly barrels: readonly Vec2[];
  readonly cars: readonly CarDef[];
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
    x: num(o.x, `${path}.x`, 0, WORLD.width),
    y: num(o.y, `${path}.y`, 0, WORLD.groundY),
    w: num(o.w, `${path}.w`, 20, 200),
    h: num(o.h, `${path}.h`, 10, 100),
    from: num(o.from, `${path}.from`, 0, WORLD.width),
    to: num(o.to, `${path}.to`, 0, WORLD.width),
    speed: num(o.speed, `${path}.speed`, 0, 400),
    target: o.target === undefined ? false : o.target === true || fail(`${path}.target`, 'expected boolean'),
    mode: o.mode === undefined || o.mode === 'patrol' ? 'patrol' : o.mode === 'flow' ? 'flow' : fail(`${path}.mode`, 'expected patrol or flow'),
  };
  if (def.from > def.to) fail(path, 'from must not exceed to');
  if (def.x < def.from || def.x > def.to) fail(`${path}.x`, 'car must start on its route');
  if (def.target && !startsClear(def.y, def.w, def.h)) fail(path, 'target must start clear of the ground');
  return def;
};

const solution = (v: unknown, path: string, maxCharges: number): LevelSolution => {
  const o = obj(v, path);
  const charges = arr(o.charges, `${path}.charges`).map((s, i): SolutionCharge => {
    const at = `${path}.charges[${i}]`;
    const delay = obj(s, at).delay;
    return { ...point(s, at), delay: delay === undefined ? undefined : num(delay, `${at}.delay`, 0, 2) };
  });
  if (charges.length === 0 || charges.length > maxCharges) fail(`${path}.charges`, 'solution must use 1..max charges');
  return { charges, fireAt: o.fireAt === undefined ? 0 : num(o.fireAt, `${path}.fireAt`, 0, 30) };
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
    if (!blocks.some((b) => b.target) && !cars.some((c) => c.target)) fail(`${p}.blocks`, 'level needs at least one target');
    const zones = arr(o.zones, `${p}.zones`).map((z, i) => rect(z, `${p}.zones[${i}]`));
    if (zones.length === 0) fail(`${p}.zones`, 'level needs at least one placement zone');
    return ok({
      id,
      name: str(o.name, `${p}.name`),
      world: int(o.world, `${p}.world`, 1, 99),
      order: int(o.order, `${p}.order`, 1, 99),
      hint: o.hint === undefined ? undefined : str(o.hint, `${p}.hint`),
      charges: { max, par },
      bonusCollapse: num(o.bonusCollapse, `${p}.bonusCollapse`, 0, 1),
      zones,
      blocks,
      barrels: o.barrels === undefined ? [] : arr(o.barrels, `${p}.barrels`).map((b, i) => point(b, `${p}.barrels[${i}]`)),
      cars,
      solution: solution(o.solution, `${p}.solution`, max),
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
