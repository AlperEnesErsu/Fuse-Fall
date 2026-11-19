import { WORLD, parseLevel, startsClear, type LevelDefinition, type SolutionCharge } from './level';
import type { Rect, Vec2 } from './math';
import { err, ok, type Result } from './result';

/**
 * A player's mission under construction: blocks, targets, protected buildings
 * and charge zones, placed by tapping. It becomes a level only when a test run
 * wins: the charges that won are recorded as its solution, then the whole thing
 * goes through the same validation as shipped data.
 */

export type DraftKind = 'block' | 'target' | 'protected';

/** What the editor's toolbar does with a tap or a drag. */
export type EditorTool = 'block' | 'target' | 'protected' | 'zone' | 'barrel' | 'remove';

/** One thing a tap or drag asks for, before the draft's rules decide whether it happens. */
export type EditAction =
  | { readonly type: 'block'; readonly kind: DraftKind; readonly at: Vec2 }
  | { readonly type: 'zone'; readonly rect: Rect }
  | { readonly type: 'barrel'; readonly at: Vec2 }
  | { readonly type: 'remove'; readonly at: Vec2 };

export interface DraftBlock {
  readonly kind: DraftKind;
  readonly material: DraftMaterial;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Draft {
  readonly blocks: readonly DraftBlock[];
  readonly zones: readonly Rect[];
  /** Explosive barrels, by their centre: each rests on the ground or on a block top. */
  readonly barrels: readonly Vec2[];
}

/** Limits that keep a player's mission small enough to share and to simulate quickly. */
export const DRAFT_LIMITS = {
  blocks: 60,
  zones: 4,
  barrels: 8,
  minZone: { w: 60, h: 30 },
  maxSize: 240,
  minSize: 16,
} as const;

export const emptyDraft = (): Draft => ({ blocks: [], zones: [], barrels: [] });

/** The block materials a player can choose, in the order the builder cycles them. */
export type DraftMaterial = 'wood' | 'concrete' | 'metal' | 'brick' | 'glass';
export const DRAFT_MATERIALS: readonly DraftMaterial[] = ['wood', 'concrete', 'metal', 'brick', 'glass'];
/** Everyone's from the start; the others are workshop parts. */
export const BASIC_MATERIALS: readonly DraftMaterial[] = ['wood', 'concrete', 'metal'];

/** A barrel's radius, as the session builds it. */
const BARREL_R = 16;

/** Blocks are placed on a 10 px grid, so the mission lines up when shared. */
export const snap = (v: number): number => Math.round(v / 10) * 10;

const inWorld = (r: Rect): boolean => r.x >= 0 && r.y >= 0 && r.x + r.w <= WORLD.width && r.y + r.h <= WORLD.groundY;

/** A target must start clear of the ground, or it would count as down before Fire. */
const targetTooLow = (b: DraftBlock): boolean => b.kind === 'target' && !startsClear(b.y + b.h / 2, b.w, b.h);

export const addBlock = (draft: Draft, block: DraftBlock): Result<Draft, 'full' | 'size' | 'outside' | 'overlap' | 'low-target'> => {
  if (draft.blocks.length >= DRAFT_LIMITS.blocks) return err('full');
  if (block.w < DRAFT_LIMITS.minSize || block.h < DRAFT_LIMITS.minSize || block.w > DRAFT_LIMITS.maxSize || block.h > DRAFT_LIMITS.maxSize) return err('size');
  if (!inWorld(block)) return err('outside');
  if (targetTooLow(block)) return err('low-target');
  // Blocks may touch, not overlap: an overlap would push them apart on the first step.
  const overlaps = draft.blocks.some(
    (b) => block.x < b.x + b.w && b.x < block.x + block.w && block.y < b.y + b.h && b.y < block.y + block.h,
  );
  if (overlaps) return err('overlap');
  return ok({ ...draft, blocks: [...draft.blocks, block] });
};

export const addZone = (draft: Draft, zone: Rect): Result<Draft, 'full' | 'size' | 'outside'> => {
  if (draft.zones.length >= DRAFT_LIMITS.zones) return err('full');
  if (zone.w < DRAFT_LIMITS.minZone.w || zone.h < DRAFT_LIMITS.minZone.h) return err('size');
  if (!inWorld(zone)) return err('outside');
  return ok({ ...draft, zones: [...draft.zones, zone] });
};

const contains = (r: Rect, p: Vec2): boolean => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/**
 * A barrel for a tap: it drops onto the first surface below the tap, the ground or the top
 * of a block wide enough to hold it, so it stands still until something sets it off.
 */
export const addBarrel = (draft: Draft, at: Vec2): Result<Draft, 'full' | 'outside' | 'overlap'> => {
  if (draft.barrels.length >= DRAFT_LIMITS.barrels) return err('full');
  if (at.x < BARREL_R || at.x > WORLD.width - BARREL_R || at.y > WORLD.groundY) return err('outside');
  const x = snap(at.x);
  const holders = draft.blocks.filter((b) => b.x <= x - BARREL_R / 2 && x + BARREL_R / 2 <= b.x + b.w && b.y >= at.y - BARREL_R);
  const surface = Math.min(WORLD.groundY, ...holders.map((b) => b.y));
  const p = { x, y: surface - BARREL_R };
  if (p.y - BARREL_R < 0) return err('outside');
  // A barrel may sit on a block, never inside one or another barrel.
  const inBlock = draft.blocks.some((b) => p.x + BARREL_R > b.x && p.x - BARREL_R < b.x + b.w && p.y + BARREL_R > b.y + 0.5 && p.y - BARREL_R < b.y + b.h);
  const crowded = draft.barrels.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < BARREL_R * 2);
  if (inBlock || crowded) return err('overlap');
  return ok({ ...draft, barrels: [...draft.barrels, p] });
};

/** Removes what is under the tap: a barrel first, then the top-most block, then a zone. */
export const removeAt = (draft: Draft, p: Vec2): Draft => {
  const barrel = draft.barrels.findIndex((b) => Math.hypot(b.x - p.x, b.y - p.y) <= BARREL_R);
  if (barrel >= 0) return { ...draft, barrels: draft.barrels.filter((_, j) => j !== barrel) };
  for (let i = draft.blocks.length - 1; i >= 0; i--) {
    const b = draft.blocks[i];
    if (b && contains(b, p)) return { ...draft, blocks: draft.blocks.filter((_, j) => j !== i) };
  }
  for (let i = draft.zones.length - 1; i >= 0; i--) {
    const z = draft.zones[i];
    if (z && contains(z, p)) return { ...draft, zones: draft.zones.filter((_, j) => j !== i) };
  }
  return draft;
};

/** The level a draft becomes once a test run won with `solution`. Validated like shipped data. */
export const draftToLevel = (
  draft: Draft,
  solution: readonly SolutionCharge[],
  options: { readonly id: string; readonly name: string; readonly world: number; readonly budget?: number },
): Result<LevelDefinition, string> => {
  const blocks = draft.blocks.map((b) => ({
    x: b.x + b.w / 2,
    y: b.y + b.h / 2,
    w: b.w,
    h: b.h,
    material: b.material,
    ...(b.kind === 'target' ? { target: true } : {}),
    ...(b.kind === 'protected' ? { protected: true } : {}),
  }));
  const parsed = parseLevel({
    id: options.id,
    name: options.name,
    world: options.world,
    order: 1,
    // The charges a player gets: the winning count unless a test run asks for a bigger budget.
    charges: { max: Math.max(1, options.budget ?? solution.length), par: Math.max(1, solution.length) },
    bonusCollapse: 0.5,
    zones: draft.zones,
    blocks,
    barrels: draft.barrels,
    solution: { charges: solution, detonateAt: [], fireAt: 0 },
  });
  if (!parsed.ok) return err(parsed.error.message);
  return ok(parsed.value);
};

/** Why a draft is not a mission yet, in plain words, for the editor to show before a test run. */
export const draftProblem = (draft: Draft): 'zone' | 'target' | 'low-target' | undefined => {
  if (draft.zones.length === 0) return 'zone';
  if (!draft.blocks.some((b) => b.kind === 'target')) return 'target';
  if (draft.blocks.some(targetTooLow)) return 'low-target';
  return undefined;
};

const isDraftMaterial = (m: string): m is DraftMaterial => (DRAFT_MATERIALS as readonly string[]).includes(m);

/** A mission as a draft, for changing it in the builder. Only missions made of plain blocks and zones can be opened there. */
export const levelToDraft = (level: LevelDefinition): Result<Draft, 'not-editable'> => {
  const plain =
    level.balls.length === 0 &&
    level.barrels.length <= DRAFT_LIMITS.barrels &&
    level.cars.length === 0 &&
    level.dropZones.length === 0 &&
    level.footprint === undefined &&
    level.instantBlasts === undefined &&
    level.blocks.every((b) => b.angle === 0 && !b.anchored && isDraftMaterial(b.material));
  if (!plain || level.blocks.length > DRAFT_LIMITS.blocks || level.zones.length > DRAFT_LIMITS.zones) return err('not-editable');
  const blocks: DraftBlock[] = level.blocks.map((b) => ({
    kind: b.target ? 'target' : b.protected ? 'protected' : 'block',
    material: isDraftMaterial(b.material) ? b.material : 'wood',
    x: b.x - b.w / 2,
    y: b.y - b.h / 2,
    w: b.w,
    h: b.h,
  }));
  return ok({ blocks, zones: level.zones.map((z) => ({ x: z.x, y: z.y, w: z.w, h: z.h })), barrels: level.barrels.map((b) => ({ x: b.x, y: b.y })) });
};

/** How the editor draws a draft before it is valid: the same shapes, without the rules a finished mission must pass.
 * Only the renderer reads it; it is never shared or played. */
export const previewLevel = (draft: Draft): LevelDefinition => {
  const blocks = draft.blocks.map((b) => ({
    x: b.x + b.w / 2,
    y: b.y + b.h / 2,
    w: b.w,
    h: b.h,
    angle: 0,
    material: b.material,
    target: b.kind === 'target',
    protected: b.kind === 'protected',
    anchored: false,
  }));
  return {
    id: 'preview',
    name: '',
    world: 9,
    order: 1,
    hint: undefined,
    charges: { max: 3, par: 3 },
    bonusCollapse: 0.5,
    zones: draft.zones,
    dropZones: [],
    blocks,
    barrels: draft.barrels,
    cars: [],
    balls: [],
    chargeKinds: ['standard'],
    footprint: undefined,
    solution: { charges: [], detonateAt: [], fireAt: 0 },
  } as unknown as LevelDefinition;
};
