import { newAchievements, type AchievementDef, type AttemptStats } from '../core/achievements';
import { weekOf, type ContractDef } from '../core/contracts';
import { dayOf } from '../core/daily';
import { payout, rankOf, type Payout, type UnpaidReason } from '../core/economy';
import type { ChargeKind, LevelDefinition } from '../core/level';
import type { Vec2 } from '../core/math';
import {
  currentStreak,
  earnScrap,
  recordCampaignRun,
  recordCareer,
  recordContracts,
  recordDailyPlayed,
  recordDailyWin,
  recordOneShot,
  recordScore,
  recordStars,
  unlockAchievements,
  type Campaign,
  type Progress,
} from '../core/progress';
import type { Draft } from '../core/editor';
import { assistedResult, type LevelResult } from '../core/scoring';
import type { SandboxVariant } from '../content/sandbox';

export type Mode =
  | { readonly kind: 'campaign' }
  | { readonly kind: 'daily'; readonly day: string; readonly baseId: string }
  | { readonly kind: 'sandbox'; readonly template: string; readonly variant: SandboxVariant; readonly traffic: boolean }
  /** A mission pasted as a code: played, reported and shared, but it never touches campaign progress. */
  | { readonly kind: 'shared' }
  /** A mission being built: played as a test; its winning charges become its solution. */
  | { readonly kind: 'editor'; readonly draft: Draft };

/** What the player did at Fire, so the same physics can be re-simulated for the replay. */
export interface Plan {
  readonly charges: readonly { position: Vec2; delay: number; kind: ChargeKind; direction: 1 | -1 }[];
  readonly fireSteps: number;
  /** Detonator presses, in fixed steps after Fire. */
  readonly presses: number[];
}

/** What happened during an attempt, counted from game events (never during a replay). */
export interface AttemptCounts {
  barrelsBlown: number;
  carsWrecked: number;
  blasts: number;
}

/** One go at a mission: what it is, what the player did, and how to show it again. */
export interface Attempt {
  readonly level: LevelDefinition;
  readonly mode: Mode;
  readonly replaying: boolean;
  /** Captured at Fire. */
  plan: Plan | undefined;
  stats: AttemptCounts;
  /** The player asked for a hint during this attempt: a win counts, but earns at most one star. */
  assisted: boolean;
  /** The attempt's result, once it has settled. */
  result: LevelResult | undefined;
  /** The report shown after the attempt, re-shown when a replay ends. */
  report: (() => void) | undefined;
}

export const newAttempt = (level: LevelDefinition, mode: Mode): Attempt => ({
  level,
  mode,
  replaying: false,
  plan: undefined,
  stats: { barrelsBlown: 0, carsWrecked: 0, blasts: 0 },
  assisted: false,
  result: undefined,
  report: undefined,
});

/** One Shot keeps a best collapse per structure. */
export const settleOneShot = (
  progress: Progress,
  template: string,
  result: LevelResult,
): { progress: Progress; best: number; isNew: boolean } => {
  const before = progress.oneShot[template];
  const after = recordOneShot(progress, template, result.collapseRatio * 100);
  const best = after.oneShot[template] ?? 0;
  return { progress: after, best, isNew: best !== before };
};

/** A campaign or daily job, once it has been booked into the save. */
export interface JobSettlement {
  readonly progress: Progress;
  /** The result as booked: a hint-assisted win is capped here. The report shows this one. */
  readonly result: LevelResult;
  readonly payout: Payout;
  /** Why the job paid nothing by rule (not for lack of salvage), so the report can say so. */
  readonly unpaid: UnpaidReason | undefined;
  /** Best score before this attempt. */
  readonly previousBest: number;
  /** The new rank index, when the job's pay brought a promotion. */
  readonly promotedTo: number | undefined;
  readonly earned: readonly AchievementDef[];
  readonly finishedContracts: readonly ContractDef[];
}

/**
 * Books a finished campaign or daily job: pay, career, stars or daily win,
 * weekly contracts and achievements, in that order. Pure: the caller saves.
 */
export const settleJob = (
  progress: Progress,
  campaign: Campaign,
  attempt: Pick<Attempt, 'level' | 'mode' | 'plan' | 'stats'> & Partial<Pick<Attempt, 'assisted'>>,
  played: LevelResult,
  now: Date,
): JobSettlement => {
  const { level, mode } = attempt;
  const assisted = attempt.assisted === true;
  const result = assisted ? assistedResult(played) : played;
  const today = dayOf(now);
  const daily = mode.kind === 'daily';
  const previousBest = progress.best[level.id] ?? 0;
  // The company is paid for what came down; the first full win of a job (or of the day's daily) pays in full.
  const firstClear = daily ? progress.daily.lastWon !== mode.day : !progress.cleared[level.id];
  // A replay pays only when it raises the job's stars, so the same job cannot be farmed.
  const improved = daily ? firstClear : result.stars > (progress.stars[level.id] ?? 0);
  const firstAttempt = daily ? progress.daily.lastPlayed !== mode.day : !progress.played[level.id];
  // Only fresh results move the contracts: a replay that gains nothing is not new work.
  // A hint-assisted win is not the player's own work: it moves no contract.
  const counts = !assisted && (daily ? firstClear : firstClear || improved);
  const pay = payout(result, { firstClear, improved, firstAttempt, daily, assisted });
  const paysNothing = result.cleared ? !firstClear && !improved : !firstAttempt;
  const unpaid: UnpaidReason | undefined = !paysNothing ? undefined : daily ? 'daily' : result.cleared ? 'replay' : 'retry';
  const rankBefore = rankOf(progress.wallet.earned).index;
  let p = recordCareer(progress, {
    cleared: result.cleared,
    blasts: attempt.stats.blasts,
    area: Object.values(result.demolished).reduce((sum, a) => sum + a, 0),
    barrels: attempt.stats.barrelsBlown,
    cars: attempt.stats.carsWrecked,
  });
  p = earnScrap(p, pay.total);
  const rankAfter = rankOf(p.wallet.earned).index;
  if (mode.kind === 'daily') {
    p = recordDailyPlayed(recordScore(p, level.id, result.score), mode.day);
    if (result.cleared) p = recordDailyWin(p, mode.day);
  } else {
    p = recordCampaignRun(recordScore(recordStars(p, level.id, result.stars), level.id, result.score), level.id, result.cleared);
  }
  const stats: AttemptStats = {
    ...attempt.stats,
    implosions: attempt.plan?.charges.filter((c) => c.kind === 'implosion').length ?? 0,
    detonations: attempt.plan?.presses.length ?? 0,
  };
  const contracts = recordContracts(p, weekOf(now), {
    cleared: result.cleared,
    stars: result.stars,
    underPar: result.underPar,
    // A daily counts once a day: its first win, not replays of it.
    daily: daily && firstClear,
    counts,
    barrels: attempt.stats.barrelsBlown,
    cars: attempt.stats.carsWrecked,
    implosions: stats.implosions,
    domino: result.styles.domino,
  });
  p = contracts.progress;
  const earned = newAchievements({ progress: p, campaign, result, stats, streak: currentStreak(p, today) });
  p = unlockAchievements(
    p,
    earned.map((a) => a.id),
  );
  return {
    progress: p,
    result,
    payout: pay,
    unpaid,
    previousBest,
    promotedTo: rankAfter > rankBefore ? rankAfter : undefined,
    earned,
    finishedContracts: contracts.finished,
  };
};
