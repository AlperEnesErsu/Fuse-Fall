import type { OfferStore, ScrapPack } from '../core/ports';
import { err, ok } from '../core/result';
import { SCRAP_PACKS } from '../content/offers';

/** A build without an ad network or billing: nothing is offered. */
export const noOffers: OfferStore = {
  adReady: () => Promise.resolve(false),
  showRewardedAd: () => Promise.resolve(err('unavailable')),
  packs: () => Promise.resolve([]),
  buy: () => Promise.resolve(err('unavailable')),
};

/**
 * Development stand-in: ads "play" for a moment and always reward, packs carry
 * placeholder prices and every purchase succeeds. Lets the whole flow be tried
 * before a real ad network and billing are connected. Never ship this.
 */
export const demoOffers = (): OfferStore => ({
  adReady: () => Promise.resolve(true),
  showRewardedAd: () => new Promise((resolve) => window.setTimeout(() => resolve(ok(true)), 1200)),
  packs: () => Promise.resolve(SCRAP_PACKS.map((p, i): ScrapPack => ({ ...p, price: `DEMO ${['29,99', '69,99', '149,99'][i] ?? '0'} ₺` }))),
  buy: () => new Promise((resolve) => window.setTimeout(() => resolve(ok(true)), 600)),
});
