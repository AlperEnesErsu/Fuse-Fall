import { ADS, adsToday } from '../core/economy';
import type { OfferStore, PackPurchase } from '../core/ports';
import { addBoughtScrap, rewardAd, type Progress } from '../core/progress';
import { SCRAP_PACKS } from '../content/offers';
import type { WorkshopOffers } from '../presentation/ui';

/** What the desk tells the player; the game turns these into text. */
export type OfferNotice =
  | { readonly kind: 'capped' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'pending' }
  | { readonly kind: 'unsaved' }
  | { readonly kind: 'thanks'; readonly scrap: number };

/** The game's progress as the desk sees it: read it, and replace it (true once it is safely stored). */
export interface Ledger {
  get(): Progress;
  set(progress: Progress): boolean;
}

/**
 * Rewarded ads and scrap packs between the offer store and the save.
 *
 * A paid pack is credited and stored before the store is told to settle
 * (consume) it. If the save cannot be written, the payment is left
 * unsettled: the store offers it again on the next launch, and the
 * payment token in the save keeps it from being credited twice.
 */
export class OfferDesk {
  /** Whether a rewarded ad could be shown at the last check. */
  adsAvailable = false;

  constructor(
    private readonly store: OfferStore,
    private readonly ledger: Ledger,
    private readonly notify: (notice: OfferNotice) => void,
    private readonly today: () => string,
    private readonly demo: boolean,
  ) {
    // Asking at launch also lets the ad network show its consent form before anything else.
    void store.adReady().then((ready) => (this.adsAvailable = ready));
  }

  /** What the store offers now: a rewarded ad (with today's count) and packs at store prices. */
  async load(): Promise<WorkshopOffers> {
    void this.settle();
    const [ready, packs] = await Promise.all([this.store.adReady(), this.store.packs()]);
    this.adsAvailable = ready;
    return {
      ad: ready ? { reward: ADS.reward, watched: adsToday(this.ledger.get().ads, this.today()), cap: ADS.dailyCap } : undefined,
      packs,
      demo: this.demo,
    };
  }

  /** Whether the report may offer to double a job's scrap with an ad. */
  canDouble(scrap: number): boolean {
    return this.adsAvailable && scrap > 0 && adsToday(this.ledger.get().ads, this.today()) < ADS.dailyCap;
  }

  /** Shows a rewarded ad; true once its scrap is credited. `scrap` defaults to the workshop reward. */
  async watchAd(scrap: number = ADS.reward): Promise<boolean> {
    const today = this.today();
    if (adsToday(this.ledger.get().ads, today) >= ADS.dailyCap) {
      this.notify({ kind: 'capped' });
      return false;
    }
    const watched = await this.store.showRewardedAd();
    if (!watched.ok) {
      if (watched.error !== 'cancelled') this.notify({ kind: 'failed' });
      return false;
    }
    this.ledger.set(rewardAd(this.ledger.get(), today, scrap));
    this.notify({ kind: 'thanks', scrap });
    return true;
  }

  /** Buys a pack; true once its scrap is credited. */
  async buy(id: string): Promise<boolean> {
    if (!SCRAP_PACKS.some((p) => p.id === id)) return false;
    const bought = await this.store.buy(id);
    if (!bought.ok) {
      if (bought.error === 'pending') this.notify({ kind: 'pending' });
      else if (bought.error !== 'cancelled') this.notify({ kind: 'failed' });
      // A refusal can mean an earlier payment is still waiting to be credited.
      await this.settle();
      return false;
    }
    return this.credit(bought.value);
  }

  /** Credits payments the store confirmed but the game never settled; true if any scrap was added. */
  async settle(): Promise<boolean> {
    let credited = false;
    for (const p of await this.store.unsettled()) credited = this.credit(p) || credited;
    return credited;
  }

  /** Stores the scrap, then settles the payment, but only once the save holds it. */
  private credit(p: PackPurchase): boolean {
    const pack = SCRAP_PACKS.find((k) => k.id === p.packId);
    if (!pack) return false; // not ours to credit: left unsettled
    const before = this.ledger.get();
    const after = addBoughtScrap(before, pack.scrap, p.token);
    // Saved even when the token was already credited: that confirms it is on disk before settling.
    const stored = this.ledger.set(after);
    if (after !== before) this.notify({ kind: 'thanks', scrap: pack.scrap });
    if (stored) void this.store.settle(p);
    else this.notify({ kind: 'unsaved' });
    return after !== before;
  }
}
