import { masteryMet, type MasteryGoal } from './mastery';
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
  /** Explosive barrels on site, and how many went off. */
  readonly barrels: { readonly blown: number; readonly total: number };
}

export interface ScoringRules {
  readonly par: number;
  readonly bonusCollapse: number;
  /** The job's own goal for the third star; a job without one (Free Site, a shared mission) tops out at two. */
  readonly mastery?: MasteryGoal | undefined;
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
  /** The job's mastery goal was met (always false without one, or on a failure). */
  readonly masteryMet: boolean;
  readonly styles: PlayStyles;
}

/**
 * The score is shown only in the daily job, where everyone plays the same mission:
 * it rewards spare charges, a full collapse, a long chain, a domino and a quick finish,
 * so two wins with the same stars still compare.
 */
export const SCORE = {
  base: 1000,
  perSpareCharge: 300,
  collapse: 500,
  perBarrel: 150,
  perDomino: 200,
  /** Per second the collapse settles under `quickWithin`. */
  perQuickSecond: 100,
  quickWithin: 6,
} as const;

/**
 * A job is cleared when every target is down, no protected building is
 * damaged and the debris stays on site; harming a neighbour breaks the
 * contract, whatever else happened. Anything less is a failure: bringing most
 * of the structure down while a target still stands does not win the job.
 *
 * Stars: a cleared job earns 1, +1 within par, +1 for the job's own mastery
 * goal. A failure earns none. The play styles (surgical, demolition, domino)
 * no longer give stars; they still pay scrap and move contracts.
 * Score: base + a bonus for each unused charge + the collapse ratio; 0 for a failure.
 */
/**
 * A job won by copying the hints: it counts as cleared (the next job opens),
 * but earns at most one star and no play styles. The stars are the player's own work.
 */
export const assistedResult = (result: LevelResult): LevelResult =>
  result.cleared
    ? { ...result, stars: Math.min(result.stars, 1) as Stars, masteryMet: false, styles: { surgical: false, demolition: false, domino: false } }
    : result;

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
  const mastered = cleared && rules.mastery !== undefined && masteryMet(rules.mastery, outcome, rules.par);
  const stars = (cleared ? 1 + Number(underPar) + Number(mastered) : 0) as Stars;
  const score = cleared
    ? SCORE.base +
      SCORE.perSpareCharge * Math.max(0, outcome.chargesMax - outcome.chargesUsed) +
      Math.round(SCORE.collapse * collapseRatio) +
      SCORE.perBarrel * outcome.barrels.blown +
      SCORE.perDomino * outcome.dominoes +
      Math.round(SCORE.perQuickSecond * Math.max(0, SCORE.quickWithin - outcome.duration))
    : 0;
  return { ...outcome, cleared, failure, stars, score, collapseRatio, underPar, bonusMet, masteryMet: mastered, styles };
};
