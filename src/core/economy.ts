import type { MaterialId } from './materials';
import { err, ok, type Result } from './result';
import type { LevelResult } from './scoring';

/**
 * The demolition company's books: every job pays in scrap for the material it
 * brought down, the career rank grows with lifetime earnings, and scrap buys
 * workshop items. Earnings never change how a job plays.
 */

/** Scrap per 1000 px² of material brought down. Vehicles are third-party property and pay nothing. */
export const SCRAP_VALUE: Readonly<Record<MaterialId, number>> = {
  wood: 2,
  brick: 3,
  glass: 3,
  concrete: 4,
  metal: 6,
  vehicle: 0,
};

export const PAYOUT = {
  /** Per play style met (surgical, demolition, domino). */
  perStyle: 20,
  /** The first time a job is won. */
  firstClear: 60,
  /** A replay that raises the job's stars pays this share; one that raises nothing pays nothing. */
  repeat: 0.5,
  /** A failed job pays for the salvage at this share, on the first attempt only. */
  failed: 0.25,
  /** Daily jobs pay this many times over. */
  daily: 2,
} as const;

export interface PayoutContext {
  /** The job had never been won in full before this attempt. */
  readonly firstClear: boolean;
  /** This win raised the job's stars (or is a daily's first win): replays pay only for this. */
  readonly improved: boolean;
  /** The job had never been attempted before: only that first failure pays its salvage. */
  readonly firstAttempt: boolean;
  readonly daily: boolean;
}

export interface Payout {
  readonly salvage: number;
  readonly styles: number;
  readonly firstClear: number;
  readonly total: number;
}

export const salvageOf = (demolished: LevelResult['demolished']): number => {
  let sum = 0;
  for (const [material, area] of Object.entries(demolished) as [MaterialId, number][]) {
    sum += (area / 1000) * SCRAP_VALUE[material];
  }
  return sum;
};

/**
 * What a job pays. A replay that raises no stars pays nothing, so the same
 * level cannot be farmed; a failure pays its salvage only on the first attempt.
 */
export const payout = (result: LevelResult, context: PayoutContext): Payout => {
  const raw = salvageOf(result.demolished);
  const share = result.cleared
    ? context.firstClear
      ? 1
      : context.improved
        ? PAYOUT.repeat
        : 0
    : context.firstAttempt
      ? PAYOUT.failed
      : 0;
  const multiplier = context.daily ? PAYOUT.daily : 1;
  const styleCount = Number(result.styles.surgical) + Number(result.styles.demolition) + Number(result.styles.domino);
  const salvage = Math.round(raw * share * multiplier);
  // Style and first-clear bonuses reward a won job; a failure pays its salvage only.
  const styles = result.cleared ? Math.round(styleCount * PAYOUT.perStyle * share * multiplier) : 0;
  const firstClear = result.cleared && context.firstClear && !context.daily ? PAYOUT.firstClear : 0;
  return { salvage, styles, firstClear, total: salvage + styles + firstClear };
};

export interface Wallet {
  readonly balance: number;
  /** Lifetime earnings: spending never lowers the career rank. */
  readonly earned: number;
}

export const credit = (wallet: Wallet, amount: number): Wallet =>
  amount <= 0 ? wallet : { balance: wallet.balance + amount, earned: wallet.earned + amount };

/** Bought scrap is spendable but not earned: the career rank only grows by playing. */
export const creditPurchase = (wallet: Wallet, amount: number): Wallet =>
  amount <= 0 ? wallet : { ...wallet, balance: wallet.balance + amount };

export const ADS = {
  /** Scrap for watching a rewarded ad in the workshop. */
  reward: 60,
  /** Rewarded ads a day, workshop and report together. */
  dailyCap: 5,
} as const;

/** Rewarded ads watched today (a new day starts at zero). */
export const adsToday = (watched: { readonly day: string; readonly count: number }, today: string): number =>
  watched.day === today ? watched.count : 0;

/** Lifetime scrap needed for each career rank, from the first. */
export const RANK_THRESHOLDS = [0, 250, 700, 1500, 3000, 6000] as const;

export interface Rank {
  /** 0-based index into RANK_THRESHOLDS. */
  readonly index: number;
  /** Lifetime scrap needed for the next rank, or undefined at the top. */
  readonly next: number | undefined;
}

export const rankOf = (earned: number): Rank => {
  let index = 0;
  for (let i = 0; i < RANK_THRESHOLDS.length; i++) if (earned >= (RANK_THRESHOLDS[i] ?? Infinity)) index = i;
  return { index, next: RANK_THRESHOLDS[index + 1] };
};

export interface ShopItem {
  readonly id: string;
  readonly cost: number;
}

export type PurchaseError = 'owned' | 'insufficient';

/** Buying spends scrap from the balance; lifetime earnings and the rank are untouched. */
export const purchase = (
  wallet: Wallet,
  owned: readonly string[],
  item: ShopItem,
): Result<{ readonly wallet: Wallet; readonly owned: readonly string[] }, PurchaseError> => {
  if (owned.includes(item.id)) return err('owned');
  if (wallet.balance < item.cost) return err('insufficient');
  return ok({ wallet: { ...wallet, balance: wallet.balance - item.cost }, owned: [...owned, item.id] });
};
