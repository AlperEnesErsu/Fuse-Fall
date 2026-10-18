import type { OfferStore, ScrapPack } from '../core/ports';
import { err, ok } from '../core/result';
import { SCRAP_PACKS } from '../content/offers';

/** The ad half of an offer store. */
export type AdSource = Pick<OfferStore, 'adReady' | 'showRewardedAd' | 'privacyChoicesRequired' | 'showPrivacyChoices'>;
/** The scrap pack half of an offer store. */
export type PackShop = Pick<OfferStore, 'packs' | 'buy' | 'unsettled' | 'settle'>;

/** A build without an ad network or billing: nothing is offered. */
export const noOffers: OfferStore = {
  adReady: () => Promise.resolve(false),
  showRewardedAd: () => Promise.resolve(err('unavailable')),
  packs: () => Promise.resolve([]),
  buy: () => Promise.resolve(err('unavailable')),
  unsettled: () => Promise.resolve([]),
  settle: () => Promise.resolve(),
  privacyChoicesRequired: () => false,
  showPrivacyChoices: () => Promise.resolve(),
};

/** Ads from one adapter, packs from another. */
export const combineOffers = (ads: AdSource, shop: PackShop): OfferStore => ({
  adReady: () => ads.adReady(),
  showRewardedAd: () => ads.showRewardedAd(),
  privacyChoicesRequired: () => ads.privacyChoicesRequired(),
  showPrivacyChoices: () => ads.showPrivacyChoices(),
  packs: () => shop.packs(),
  buy: (id) => shop.buy(id),
  unsettled: () => shop.unsettled(),
  settle: (p) => shop.settle(p),
});

/**
 * Development stand-in: ads "play" for a moment and always reward, packs carry
 * placeholder prices and every purchase succeeds. Lets the whole flow be tried
 * before a real ad network and billing are connected. Never ship this.
 */
export const demoOffers = (): OfferStore => {
  let sold = 0;
  return {
    ...noOffers,
    adReady: () => Promise.resolve(true),
    showRewardedAd: () => new Promise((resolve) => window.setTimeout(() => resolve(ok(true)), 1200)),
    packs: () => Promise.resolve(SCRAP_PACKS.map((p, i): ScrapPack => ({ ...p, price: `DEMO ${['29,99', '69,99', '149,99'][i] ?? '0'} ₺` }))),
    buy: (id) => new Promise((resolve) => window.setTimeout(() => resolve(ok({ packId: id, token: `demo-${Date.now()}-${++sold}` })), 600)),
  };
};
