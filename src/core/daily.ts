import { hashString } from './math';
import type { LevelDefinition } from './level';
import { levelsOf, worldStatus, type Campaign, type Progress } from './progress';

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

/**
 * Today's mission, the same for everyone on that day and generated offline.
 * It is drawn from the cities the player has opened and must be finished with
 * exactly par charges. Every shipped solution fits within par (tested), so a
 * daily is always solvable.
 */
export const dailyChallenge = (campaign: Campaign, progress: Progress, day: string): DailyChallenge | undefined => {
  const pool = campaign.worlds
    .filter((w) => worldStatus(progress, campaign, w.world).kind === 'open')
    .flatMap((w) => levelsOf(campaign, w.world));
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
