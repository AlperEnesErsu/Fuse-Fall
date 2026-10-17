import type { MaterialId } from './materials';

export type Stars = 0 | 1 | 2 | 3;

export interface LevelOutcome {
  readonly targetsDown: number;
  readonly targetsTotal: number;
  readonly chargesUsed: number;
  readonly chargesMax: number;
  readonly blocksCollapsed: number;
  readonly blocksTotal: number;
  /** Buildings that had to survive, and how many of them were damaged. */
  readonly protectedTotal: number;
  readonly protectedDamaged: number;
  /** Seconds from Fire until everything settled. */
  readonly duration: number;
  /** Targets brought down without any blast reaching them (toppled or struck by falling structure). */
  readonly dominoes: number;
  /** Area (px²) of structure brought down, by material. */
  readonly demolished: Readonly<Partial<Record<MaterialId, number>>>;
  /** For footprint jobs: the share of the structure's material that ended up inside the site, and the share required. */
  readonly footprint: { readonly achieved: number; readonly required: number } | undefined;
}

export interface ScoringRules {
  readonly par: number;
  readonly bonusCollapse: number;
}

/**
 * Three ways to play a job well. Each one met earns a star on top of success,
 * so any two of them give the full three stars.
 */
export interface PlayStyles {
  /** Within par: the fewest charges. */
  readonly surgical: boolean;
  /** The collapse bonus: bring the whole structure down. */
  readonly demolition: boolean;
  /** Let the structure do the work: a target brought down by falling structure, never touched by a blast. */
  readonly domino: boolean;
}

export type FailureReason = 'target-standing' | 'collateral-damage' | 'debris-outside';

export interface LevelResult extends LevelOutcome {
  /** The job counts: cleared, or a partial win. Progress opens on either. */
  readonly success: boolean;
  /** Every target down, nothing protected harmed, debris on site: the full contract. */
  readonly cleared: boolean;
  /** Not cleared, but most of the structure came down and nothing protected was harmed: one star. */
  readonly partial: boolean;
  readonly failure: FailureReason | undefined;
  readonly stars: Stars;
  readonly score: number;
  readonly collapseRatio: number;
  readonly underPar: boolean;
  readonly bonusMet: boolean;
  readonly styles: PlayStyles;
}

/** Share of the structure that must come down for a partial win. */
export const PARTIAL_COLLAPSE = 0.5;

export const SCORE = {
  base: 1000,
  perSpareCharge: 300,
  collapse: 500,
} as const;

/**
 * A job is cleared when every target is down and no protected building is
 * damaged; harming a neighbour breaks the contract, whatever else happened.
 * A job that is not cleared still counts as a partial win when most of the
 * structure came down and nothing protected was harmed: nobody should be stuck.
 *
 * Stars: a partial win earns 1. A cleared job earns 1, +1 for each play style
 * met (surgical, demolition, domino), at most 3.
 * Score: base + a bonus for each unused charge + the collapse ratio; half the base for a partial win.
 */
export const scoreLevel = (outcome: LevelOutcome, rules: ScoringRules): LevelResult => {
  const targetsMet = outcome.targetsTotal > 0 && outcome.targetsDown >= outcome.targetsTotal;
  // Collateral damage is reported first: it voids the contract whatever else happened.
  const spilled = outcome.footprint !== undefined && outcome.footprint.achieved < outcome.footprint.required;
  const failure: FailureReason | undefined =
    outcome.protectedDamaged > 0
      ? 'collateral-damage'
      : !targetsMet
        ? 'target-standing'
        : spilled
          ? 'debris-outside'
          : undefined;
  const cleared = failure === undefined;
  const collapseRatio = outcome.blocksTotal === 0 ? 0 : outcome.blocksCollapsed / outcome.blocksTotal;
  const partial = !cleared && failure !== 'collateral-damage' && outcome.blocksTotal > 0 && collapseRatio >= PARTIAL_COLLAPSE;
  const success = cleared || partial;
  const underPar = outcome.chargesUsed <= rules.par;
  const bonusMet = collapseRatio >= rules.bonusCollapse;
  const styles: PlayStyles = {
    surgical: underPar,
    demolition: bonusMet,
    domino: outcome.dominoes > 0,
  };
  const met = Number(styles.surgical) + Number(styles.demolition) + Number(styles.domino);
  const stars = (cleared ? 1 + Math.min(2, met) : partial ? 1 : 0) as Stars;
  const score = cleared
    ? SCORE.base +
      SCORE.perSpareCharge * Math.max(0, outcome.chargesMax - outcome.chargesUsed) +
      Math.round(SCORE.collapse * collapseRatio)
    : partial
      ? SCORE.base / 2 + Math.round(SCORE.collapse * collapseRatio)
      : 0;
  return { ...outcome, success, cleared, partial, failure, stars, score, collapseRatio, underPar, bonusMet, styles };
};
