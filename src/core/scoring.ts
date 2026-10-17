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
  /** Barrels, wrecks and bombs set off by another blast. */
  readonly chainBlasts: number;
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
  /** Let the structure do the work: a target toppled by falling structure, or a chain of blasts. */
  readonly domino: boolean;
}

/** Blasts setting off blasts: this many make a chain reaction. */
export const CHAIN_FOR_DOMINO = 2;

export type FailureReason = 'target-standing' | 'collateral-damage' | 'debris-outside';

export interface LevelResult extends LevelOutcome {
  readonly success: boolean;
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
 * A job succeeds when every target is down and no protected building is
 * damaged; harming a neighbour breaks the contract, whatever else happened.
 *
 * Stars: 1 for success, +1 for each play style met (surgical, demolition, domino), at most 3.
 * Score: base + a bonus for each unused charge + the collapse ratio.
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
  const success = failure === undefined;
  const collapseRatio = outcome.blocksTotal === 0 ? 0 : outcome.blocksCollapsed / outcome.blocksTotal;
  const underPar = outcome.chargesUsed <= rules.par;
  const bonusMet = collapseRatio >= rules.bonusCollapse;
  const styles: PlayStyles = {
    surgical: underPar,
    demolition: bonusMet,
    domino: outcome.dominoes > 0 || outcome.chainBlasts >= CHAIN_FOR_DOMINO,
  };
  const met = Number(styles.surgical) + Number(styles.demolition) + Number(styles.domino);
  const stars = (success ? 1 + Math.min(2, met) : 0) as Stars;
  const score = success
    ? SCORE.base +
      SCORE.perSpareCharge * Math.max(0, outcome.chargesMax - outcome.chargesUsed) +
      Math.round(SCORE.collapse * collapseRatio)
    : 0;
  return { ...outcome, success, failure, stars, score, collapseRatio, underPar, bonusMet, styles };
};
