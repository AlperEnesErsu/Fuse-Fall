import { rankOf } from './economy';
import { levelsOf, type Campaign, type Progress } from './progress';
import type { LevelResult } from './scoring';

/** What happened in the attempt that just ended, beyond its result. */
export interface AttemptStats {
  readonly barrelsBlown: number;
  readonly carsWrecked: number;
  /** Implosion charges fired, and detonator presses that set off falling bombs. */
  readonly implosions: number;
  readonly detonations: number;
}

/** Career rank index that earns the Foreman achievement. */
export const FOREMAN_RANK = 2;

export interface AchievementContext {
  readonly progress: Progress;
  readonly campaign: Campaign;
  readonly result: LevelResult;
  readonly stats: AttemptStats;
  readonly streak: number;
}

export const ACHIEVEMENT_IDS = [
  'first-job',
  'lean',
  'chain',
  'traffic',
  'clean',
  'total',
  'perfect-city',
  'streak-3',
  'streak-7',
  'domino',
  'implosion',
  'airburst',
  'foreman',
] as const;
export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

/** Rules only; titles and descriptions are display text and live in the presentation string tables. */
export interface AchievementDef {
  readonly id: AchievementId;
  readonly earned: (c: AchievementContext) => boolean;
}

const cityPerfect = (c: AchievementContext): boolean =>
  c.campaign.worlds.some((w) => {
    const levels = levelsOf(c.campaign, w.world);
    return levels.length > 0 && levels.every((l) => c.progress.stars[l.id] === 3);
  });

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first-job', earned: (c) => c.result.success },
  {
    id: 'lean',
    earned: (c) => c.result.cleared && c.result.chargesMax > 1 && c.result.chargesUsed === 1,
  },
  {
    id: 'chain',
    earned: (c) => c.stats.barrelsBlown >= 3,
  },
  {
    id: 'traffic',
    earned: (c) => c.result.cleared && c.stats.carsWrecked >= 2,
  },
  {
    id: 'clean',
    earned: (c) => c.result.cleared && c.result.protectedTotal > 0 && c.result.stars === 3,
  },
  {
    id: 'total',
    earned: (c) => c.result.cleared && c.result.blocksTotal > 0 && c.result.collapseRatio >= 1,
  },
  { id: 'perfect-city', earned: cityPerfect },
  { id: 'streak-3', earned: (c) => c.streak >= 3 },
  { id: 'streak-7', earned: (c) => c.streak >= 7 },
  { id: 'domino', earned: (c) => c.result.cleared && c.result.styles.domino },
  { id: 'implosion', earned: (c) => c.result.cleared && c.stats.implosions > 0 },
  { id: 'airburst', earned: (c) => c.result.cleared && c.stats.detonations > 0 },
  { id: 'foreman', earned: (c) => rankOf(c.progress.wallet.earned).index >= FOREMAN_RANK },
];

/** Achievements earned by this attempt that the player does not have yet. */
export const newAchievements = (c: AchievementContext): AchievementDef[] =>
  ACHIEVEMENTS.filter((a) => !c.progress.achievements.includes(a.id) && a.earned(c));
