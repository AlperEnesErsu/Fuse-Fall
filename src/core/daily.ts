import { hashString } from './math';
import { difficultyOf } from './difficulty';
import { leanLevel, mirrorLevel, type DailyModifier } from './daily-modifiers';
import type { LevelDefinition } from './level';
import type { Campaign } from './progress';

export interface DailyChallenge {
  /** Calendar day, YYYY-MM-DD (the player's local date). */
  readonly day: string;
  readonly base: LevelDefinition;
  /** The base mission with the daily rule applied: no spare charges, only par, and the day's modifier. */
  readonly level: LevelDefinition;
  /** The day's twist, if it has one: the site mirrored, or one charge fewer. */
  readonly modifier: DailyModifier | undefined;
}

/** Which twists a job can take: only the ones proven to keep it winnable (the caller knows which). */
export interface DailyOptions {
  readonly canMirror?: (level: LevelDefinition) => boolean;
  readonly canLean?: (level: LevelDefinition) => boolean;
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
export const dailyChallenge = (campaign: Campaign, day: string, options: DailyOptions = {}): DailyChallenge | undefined => {
  const pool = dailyPool(campaign);
  const base = pool[hashString(`daily:${day}`) % Math.max(1, pool.length)];
  if (!base) return undefined;
  // The day picks one of the twists the job can take, or none: a plain day stays in the mix.
  const twists: (DailyModifier | undefined)[] = [
    undefined,
    ...(options.canMirror?.(base) ? (['mirror'] as const) : []),
    ...(options.canLean?.(base) ? (['lean'] as const) : []),
  ];
  const modifier = twists[hashString(`twist:${day}`) % twists.length];
  // A daily is judged by its score, not its stars: it carries no third-star goal.
  const plain: LevelDefinition = {
    ...base,
    id: `daily-${day}`,
    seed: base.seed ?? base.id,
    charges: { max: base.charges.par, par: base.charges.par },
    hint: undefined,
    mastery: undefined,
  };
  const level = modifier === 'mirror' ? mirrorLevel(plain) : modifier === 'lean' ? leanLevel(plain) : plain;
  return { day, base, level, modifier };
};
