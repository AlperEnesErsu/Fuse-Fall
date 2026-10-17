import { WORLD, type LevelDefinition } from '../core/level';

/** A horizontal slice of the world, in world pixels. The world's full height always fits. */
export interface View {
  readonly x0: number;
  readonly x1: number;
}

export const FULL_VIEW: View = { x0: 0, x1: WORLD.width };

/** Room around the action, and the narrowest slice worth showing (so small jobs are not blown up). */
const PAD = 60;
const MIN_WIDTH = 440;

/**
 * Where a job happens: everything the player looks at or touches (structures,
 * barrels, charge and drop zones, car routes, the debris site). A portrait
 * screen frames this slice instead of the whole 960-px world, so the job fills
 * the width of a phone held upright.
 */
export const focusOf = (level: LevelDefinition): View => {
  const spans: [number, number][] = [];
  for (const b of level.blocks) spans.push([b.x - b.w / 2, b.x + b.w / 2]);
  for (const b of level.barrels) spans.push([b.x - 16, b.x + 16]);
  for (const z of [...level.zones, ...level.dropZones]) spans.push([z.x, z.x + z.w]);
  for (const c of level.cars) spans.push([c.from - c.w / 2, c.to + c.w / 2]);
  if (level.footprint) spans.push([level.footprint.from, level.footprint.to]);
  if (spans.length === 0) return FULL_VIEW;
  let x0 = Math.min(...spans.map((s) => s[0])) - PAD;
  let x1 = Math.max(...spans.map((s) => s[1])) + PAD;
  if (x1 - x0 < MIN_WIDTH) {
    const mid = (x0 + x1) / 2;
    x0 = mid - MIN_WIDTH / 2;
    x1 = mid + MIN_WIDTH / 2;
  }
  // Stay inside the world; shift rather than shrink where possible.
  if (x0 < 0) [x0, x1] = [0, Math.min(WORLD.width, x1 - x0)];
  if (x1 > WORLD.width) [x0, x1] = [Math.max(0, x0 - (x1 - WORLD.width)), WORLD.width];
  return { x0, x1 };
};
