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
export type EditorTool = 'block' | 'target' | 'protected' | 'zone' | 'remove';

/** One thing a tap or drag asks for, before the draft's rules decide whether it happens. */
export type EditAction =
  | { readonly type: 'block'; readonly kind: DraftKind; readonly at: Vec2 }
  | { readonly type: 'zone'; readonly rect: Rect }
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
}

/** Limits that keep a player's mission small enough to share and to simulate quickly. */
export const DRAFT_LIMITS = {
  blocks: 60,
  zones: 4,
  minZone: { w: 60, h: 30 },
  maxSize: 240,
  minSize: 16,
} as const;

export const emptyDraft = (): Draft => ({ blocks: [], zones: [] });

/** The block materials a player can choose, in the order the builder cycles them. */
export type DraftMaterial = 'wood' | 'concrete' | 'metal';
export const DRAFT_MATERIALS: readonly DraftMaterial[] = ['wood', 'concrete', 'metal'];

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

/** Removes what is under the tap: the top-most block first, then a zone. */
export const removeAt = (draft: Draft, p: Vec2): Draft => {
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
    level.barrels.length === 0 &&
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
  return ok({ blocks, zones: level.zones.map((z) => ({ x: z.x, y: z.y, w: z.w, h: z.h })) });
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
    barrels: [],
    cars: [],
    balls: [],
    chargeKinds: ['standard'],
    footprint: undefined,
    solution: { charges: [], detonateAt: [], fireAt: 0 },
  } as unknown as LevelDefinition;
};
