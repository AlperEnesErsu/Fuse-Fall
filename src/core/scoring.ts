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
  /** The job is won: every target down, nothing protected harmed, debris on site. The only way to earn stars and open the next job. */
  readonly cleared: boolean;
  readonly failure: FailureReason | undefined;
  readonly stars: Stars;
  readonly score: number;
  readonly collapseRatio: number;
  readonly underPar: boolean;
  readonly bonusMet: boolean;
  readonly styles: PlayStyles;
}

export const SCORE = {
  base: 1000,
  perSpareCharge: 300,
  collapse: 500,
} as const;

/**
 * A job is cleared when every target is down, no protected building is
 * damaged and the debris stays on site; harming a neighbour breaks the
 * contract, whatever else happened. Anything less is a failure: bringing most
 * of the structure down while a target still stands does not win the job.
 *
 * Stars: a cleared job earns 1, +1 for each play style met (surgical,
 * demolition, domino), at most 3. A failure earns none.
 * Score: base + a bonus for each unused charge + the collapse ratio; 0 for a failure.
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
  const underPar = outcome.chargesUsed <= rules.par;
  const bonusMet = collapseRatio >= rules.bonusCollapse;
  const styles: PlayStyles = {
    surgical: underPar,
    demolition: bonusMet,
    domino: outcome.dominoes > 0,
  };
  const met = Number(styles.surgical) + Number(styles.demolition) + Number(styles.domino);
  const stars = (cleared ? 1 + Math.min(2, met) : 0) as Stars;
  const score = cleared
    ? SCORE.base +
      SCORE.perSpareCharge * Math.max(0, outcome.chargesMax - outcome.chargesUsed) +
      Math.round(SCORE.collapse * collapseRatio)
    : 0;
  return { ...outcome, cleared, failure, stars, score, collapseRatio, underPar, bonusMet, styles };
};
