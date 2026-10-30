import { hashString } from './math';
import { difficultyOf } from './difficulty';
import type { LevelDefinition } from './level';
import type { Campaign } from './progress';

export interface DailyChallenge {
  /** Calendar day, YYYY-MM-DD (the player's local date). */
  readonly day: string;
  readonly base: LevelDefinition;
  /** The base mission with the daily rule applied: no spare charges, only par. */
  readonly level: LevelDefinition;
}

/** Local calendar day for a timestamp, as YYYY-MM-DD. */
export const dayOf = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Missions a daily may be drawn from: every easy and medium job, in campaign order. */
export const dailyPool = (campaign: Campaign): LevelDefinition[] =>
  campaign.levels.filter((l) => {
    const d = difficultyOf(l);
    return d === 'easy' || d === 'medium';
  });

/**
 * Today's mission, generated offline and the same for everyone on that day:
 * it depends on the date alone, never on how far the player has come, so it
 * cannot change mid-day either. It must be finished with exactly par charges.
 * Every shipped solution fits within par (tested), so a daily is always solvable.
 */
export const dailyChallenge = (campaign: Campaign, day: string): DailyChallenge | undefined => {
  const pool = dailyPool(campaign);
  const base = pool[hashString(`daily:${day}`) % Math.max(1, pool.length)];
  if (!base) return undefined;
  return {
    day,
    base,
    level: {
      ...base,
      id: `daily-${day}`,
      charges: { max: base.charges.par, par: base.charges.par },
      hint: undefined,
    },
  };
};
