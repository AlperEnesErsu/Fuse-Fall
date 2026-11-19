import { WORLD, type LevelDefinition, type SolutionCharge } from './level';
import type { Rect, Vec2 } from './math';

/**
 * What makes a day's job more than a replay of a job already won. Each is a pure
 * change to the job's data, and each is offered only where it is proven to keep the
 * job winnable (tests/daily-modifiers.test.ts plays every one).
 *
 *  - 'mirror': the whole site flipped left to right. The same idea, a new picture
 *    to read: every plan learnt by heart has to be worked out again.
 *  - 'lean': one charge fewer than par. Offered only for jobs with a proven
 *    one-charge-fewer win (their mastery goal, src/content/mastery.json).
 */
export const DAILY_MODIFIERS = ['mirror', 'lean'] as const;
export type DailyModifier = (typeof DAILY_MODIFIERS)[number];

const mx = (x: number) => WORLD.width - x;
const mirrorPoint = <T extends Vec2>(p: T): T => ({ ...p, x: mx(p.x) });
const mirrorRect = <T extends Rect>(r: T): T => ({ ...r, x: WORLD.width - r.x - r.w });

/**
 * Jobs a mirror cannot carry: traffic. A car's route has a direction of travel and
 * one-way traffic only runs rightwards, so the mirrored job would not be the same job.
 */
export const canMirror = (level: LevelDefinition): boolean => level.cars.length === 0;

const mirrorCharge = (c: SolutionCharge): SolutionCharge => {
  const mirrored = mirrorPoint(c);
  // A rolling or directional charge points the other way in the mirror.
  return c.direction === undefined ? mirrored : { ...mirrored, direction: c.direction === 1 ? -1 : 1 };
};

/** The job flipped left to right: structure, zones, barrels, cranes, site and the recorded solution with it. */
export const mirrorLevel = (level: LevelDefinition): LevelDefinition => ({
  ...level,
  zones: level.zones.map(mirrorRect),
  dropZones: level.dropZones.map(mirrorRect),
  blocks: level.blocks.map((b) => ({ ...b, x: mx(b.x), angle: -b.angle })),
  barrels: level.barrels.map(mirrorPoint),
  balls: level.balls.map((b) => ({ ...b, hook: mirrorPoint(b.hook), angle: -b.angle })),
  footprint: level.footprint && { ...level.footprint, from: mx(level.footprint.to), to: mx(level.footprint.from) },
  solution: { ...level.solution, charges: level.solution.charges.map(mirrorCharge) },
});

/** One charge fewer than par, and par moves with it: the lean day's rule. */
export const leanLevel = (level: LevelDefinition): LevelDefinition => {
  const n = Math.max(1, level.charges.par - 1);
  return { ...level, charges: { ...level.charges, max: n, par: n } };
};
