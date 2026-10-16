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
}

export interface ScoringRules {
  readonly par: number;
  readonly bonusCollapse: number;
}

export type FailureReason = 'target-standing' | 'collateral-damage';

export interface LevelResult extends LevelOutcome {
  readonly success: boolean;
  readonly failure: FailureReason | undefined;
  readonly stars: Stars;
  readonly score: number;
  readonly collapseRatio: number;
  readonly underPar: boolean;
  readonly bonusMet: boolean;
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
 * Stars: 1 for success, +1 for staying within par, +1 for the collapse bonus.
 * Score: base + a bonus for each unused charge + the collapse ratio.
 */
export const scoreLevel = (outcome: LevelOutcome, rules: ScoringRules): LevelResult => {
  const targetsMet = outcome.targetsTotal > 0 && outcome.targetsDown >= outcome.targetsTotal;
  // Collateral damage is reported first: it voids the contract whatever else happened.
  const failure: FailureReason | undefined =
    outcome.protectedDamaged > 0 ? 'collateral-damage' : !targetsMet ? 'target-standing' : undefined;
  const success = failure === undefined;
  const collapseRatio = outcome.blocksTotal === 0 ? 0 : outcome.blocksCollapsed / outcome.blocksTotal;
  const underPar = outcome.chargesUsed <= rules.par;
  const bonusMet = collapseRatio >= rules.bonusCollapse;
  const stars = (success ? 1 + Number(underPar) + Number(bonusMet) : 0) as Stars;
  const score = success
    ? SCORE.base +
      SCORE.perSpareCharge * Math.max(0, outcome.chargesMax - outcome.chargesUsed) +
      Math.round(SCORE.collapse * collapseRatio)
    : 0;
  return { ...outcome, success, failure, stars, score, collapseRatio, underPar, bonusMet };
};
