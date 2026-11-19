import type { LevelOutcome } from './scoring';

/**
 * A job's own third star: one thing done well beyond winning within par.
 * Each campaign job has one, chosen so its recorded solution does not meet it
 * by accident but a better play does (src/content/mastery.json, tested).
 */
export const MASTERY_KINDS = ['one-less', 'domino', 'chain', 'site', 'whole', 'quick'] as const;
export type MasteryKind = (typeof MASTERY_KINDS)[number];

export interface MasteryGoal {
  readonly kind: MasteryKind;
  /**
   * For 'whole' and 'site': the share (0..1) of the structure to bring down, or of the debris to keep on site.
   * For 'quick': the seconds from Fire within which everything must have settled.
   */
  readonly at?: number | undefined;
}

export const isMasteryKind = (v: unknown): v is MasteryKind => (MASTERY_KINDS as readonly unknown[]).includes(v);

/** Without a stated share: the whole structure, all the debris, with a few loose pieces forgiven. */
export const MASTERY_DEFAULT_SHARE = 0.95;

/** Whether an attempt met the job's mastery goal. Scoring only asks this of a won job. */
export const masteryMet = (goal: MasteryGoal, outcome: LevelOutcome, par: number): boolean => {
  const share = goal.at ?? MASTERY_DEFAULT_SHARE;
  switch (goal.kind) {
    case 'one-less':
      return outcome.chargesUsed <= par - 1;
    case 'domino':
      return outcome.dominoes > 0;
    case 'chain':
      return outcome.barrels.total > 0 && outcome.barrels.blown >= outcome.barrels.total;
    case 'site':
      return outcome.footprint !== undefined && outcome.footprint.achieved >= share;
    case 'whole':
      return outcome.blocksTotal > 0 && outcome.blocksCollapsed / outcome.blocksTotal >= share - 1e-9;
    case 'quick':
      return goal.at !== undefined && outcome.duration <= goal.at + 1e-9;
  }
};
