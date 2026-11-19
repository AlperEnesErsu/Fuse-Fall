import { canMirror } from '../core/daily-modifiers';
import type { DailyOptions } from '../core/daily';
import type { LevelDefinition } from '../core/level';
import { MASTERY } from './mastery';

/**
 * Jobs whose mirror does not play like the original: the physics is close to symmetric,
 * not exactly. Found by tests/daily-modifiers.test.ts, which plays every mirrored daily.
 */
const NO_MIRROR: ReadonlySet<string> = new Set(['w4-05']);

/** The twists each daily job can take, as proven by the tests. */
export const DAILY_OPTIONS: DailyOptions = {
  canMirror: (level: LevelDefinition) => canMirror(level) && !NO_MIRROR.has(level.id),
  // One charge fewer only where a one-charge-fewer win is on record (the job's mastery play).
  canLean: (level: LevelDefinition) => MASTERY[level.id]?.goal.kind === 'one-less',
};
