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

/** What the camera closes in on after Fire: a slice of the world and the highest point worth keeping in frame. */
export interface ActionView extends View {
  /** World y of the top of the frame. */
  readonly top: number;
}

const ACTION_PAD = 90;
const ACTION_MIN_WIDTH = 300;
/** Sky kept above the tallest thing, for what a blast throws up. */
const ACTION_HEADROOM = 80;
/** The frame never gets flatter than this, however low the structure. */
const ACTION_MIN_HEIGHT = 220;

/**
 * Where the collapse happens. While placing, the frame has to hold the charge zones;
 * once the charges are fired only the structure matters, so the camera can close in
 * on it: everything that can fall, be hit or must be kept safe, and the debris site.
 * Undefined when the player keeps tapping the field (smash play), where the frame
 * must hold still. Whether closing in is worth a camera move depends on the screen
 * (a landscape screen starts from the whole world), so the renderer decides that.
 */
export const actionOf = (level: LevelDefinition): ActionView | undefined => {
  if (level.instantBlasts) return undefined;
  const spans: [number, number][] = [];
  let top = WORLD.groundY - ACTION_MIN_HEIGHT;
  for (const b of level.blocks) {
    // Fixed infrastructure (roads, viaducts, crane masts) runs far past the job; it frames nothing.
    if (b.anchored) continue;
    spans.push([b.x - b.w / 2, b.x + b.w / 2]);
    top = Math.min(top, b.y - b.h / 2);
  }
  for (const b of level.barrels) spans.push([b.x - 16, b.x + 16]);
  for (const c of level.cars) {
    spans.push([c.from - c.w / 2, c.to + c.w / 2]);
    top = Math.min(top, c.y - c.h / 2);
  }
  for (const b of level.balls) {
    // The ball, wherever its swing takes it, and the hook it hangs from.
    spans.push([b.hook.x - b.length - b.radius, b.hook.x + b.length + b.radius]);
    top = Math.min(top, b.hook.y);
  }
  // Bombs fall from the sky and rolling charges drive out of their zone: both start inside the frame.
  if (level.chargeKinds.includes('bomb')) {
    for (const z of level.dropZones) {
      spans.push([z.x, z.x + z.w]);
      top = Math.min(top, z.y);
    }
  }
  if (level.chargeKinds.includes('roller')) for (const z of level.zones) spans.push([z.x, z.x + z.w]);
  if (level.footprint) spans.push([level.footprint.from, level.footprint.to]);
  if (spans.length === 0) return undefined;
  const whole = focusOf(level);
  let x0 = Math.max(whole.x0, Math.min(...spans.map((sp) => sp[0])) - ACTION_PAD);
  let x1 = Math.min(whole.x1, Math.max(...spans.map((sp) => sp[1])) + ACTION_PAD);
  if (x1 - x0 < ACTION_MIN_WIDTH) {
    const mid = (x0 + x1) / 2;
    x0 = Math.max(whole.x0, mid - ACTION_MIN_WIDTH / 2);
    x1 = Math.min(whole.x1, x0 + ACTION_MIN_WIDTH);
    x0 = Math.max(whole.x0, x1 - ACTION_MIN_WIDTH);
  }
  return { x0, x1, top: Math.max(0, top - ACTION_HEADROOM) };
};
