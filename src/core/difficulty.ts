import type { LevelDefinition } from './level';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

const TIERS: readonly Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

/**
 * How demanding a job is, for the mission card: its place in its city (each city
 * starts gently and ends on its hardest job), one step up from the fifth city on,
 * and one more for a job that needs two or more charges timed against each other.
 */
export const difficultyOf = (level: LevelDefinition): Difficulty => {
  let tier = level.order <= 3 ? 0 : level.order <= 7 ? 1 : 2;
  if (level.world >= 5) tier++;
  const timed = level.solution.charges.filter((c) => c.delay !== undefined && c.delay > 0).length;
  if (timed >= 2) tier++;
  return TIERS[Math.min(TIERS.length - 1, tier)] ?? 'expert';
};
