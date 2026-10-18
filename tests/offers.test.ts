import { describe, expect, it } from 'vitest';
import { AdmobConsentStatus, type AdmobConsentInfo } from '@capacitor-community/admob';
import { rewardedAds, type RewardedAdApi, type ShowOutcome } from '../src/infrastructure/rewarded-ads';
import { playPacks, type BillingApi, type BillingRefusal, type StorePayment } from '../src/infrastructure/play-billing';

const consent = (status: AdmobConsentStatus, canRequestAds: boolean, privacy = 'NOT_REQUIRED'): AdmobConsentInfo =>
  ({ status, canRequestAds, isConsentFormAvailable: true, privacyOptionsRequirementStatus: privacy }) as AdmobConsentInfo;

const fakeAds = (o: { info: AdmobConsentInfo; afterForm?: AdmobConsentInfo; show?: ShowOutcome[]; loadFails?: number }) => {
  const calls = { form: 0, prepare: 0, shown: 0 };
  let fails = o.loadFails ?? 0;
  const api: RewardedAdApi = {
    initialize: () => Promise.resolve(),
    requestConsentInfo: () => Promise.resolve(o.info),
    showConsentForm: () => {
      calls.form++;
      return Promise.resolve(o.afterForm ?? o.info);
    },
    showPrivacyOptionsForm: () => Promise.resolve(),
    prepare: () => {
      calls.prepare++;
      return fails-- > 0 ? Promise.reject(new Error('no fill')) : Promise.resolve();
    },
    show: () => Promise.resolve(o.show?.[calls.shown++] ?? 'rewarded'),
  };
  return { api, calls };
};

describe('rewarded ads', () => {
  it('shows the consent form where it is required, and asks for no ad until consent allows it', async () => {
    const refused = fakeAds({ info: consent(AdmobConsentStatus.REQUIRED, false), afterForm: consent(AdmobConsentStatus.OBTAINED, false) });
    expect(await rewardedAds(refused.api, 'id', true).adReady()).toBe(false);
    expect(refused.calls).toMatchObject({ form: 1, prepare: 0 });

    const given = fakeAds({ info: consent(AdmobConsentStatus.REQUIRED, false), afterForm: consent(AdmobConsentStatus.OBTAINED, true, 'REQUIRED') });
    const ads = rewardedAds(given.api, 'id', true);
    expect(await ads.adReady()).toBe(true);
    expect(ads.privacyChoicesRequired()).toBe(true);
  });

  it('rewards only an ad watched to the end, and loads the next one after each', async () => {
    const { api, calls } = fakeAds({ info: consent(AdmobConsentStatus.NOT_REQUIRED, true), show: ['dismissed', 'rewarded'] });
    const ads = rewardedAds(api, 'id', true);
    expect(await ads.adReady()).toBe(true);
    expect(calls.form).toBe(0);
    expect(await ads.showRewardedAd()).toEqual({ ok: false, error: 'cancelled' });
    expect(await ads.adReady()).toBe(true);
    expect(await ads.showRewardedAd()).toEqual({ ok: true, value: true });
    expect(calls.prepare).toBe(3);
  });

  it('offers no ad when none loaded, and tries again on the next visit', async () => {
    const { api } = fakeAds({ info: consent(AdmobConsentStatus.NOT_REQUIRED, true), loadFails: 1 });
    const ads = rewardedAds(api, 'id', true);
    expect(await ads.adReady()).toBe(false);
    expect(await ads.showRewardedAd()).toEqual({ ok: false, error: 'unavailable' });
    expect(await ads.adReady()).toBe(true);
  });
});

const fakeBilling = (o: { purchase?: StorePayment | BillingRefusal; owned?: StorePayment[]; prices?: Record<string, string> }) => {
  const consumed: string[] = [];
  const api: BillingApi = {
    supported: () => Promise.resolve(true),
    prices: () => Promise.resolve(new Map(Object.entries(o.prices ?? {}))),
    purchase: () => Promise.resolve(o.purchase ?? 'failed'),
    owned: () => Promise.resolve(o.owned ?? []),
    consume: (token) => {
      consumed.push(token);
      return Promise.resolve();
    },
  };
  return { api, consumed };
};

const PACKS = [
  { id: 'scrap_small', scrap: 500 },
  { id: 'scrap_large', scrap: 4000 },
];

describe('scrap packs on Google Play', () => {
  it('lists only the packs the store prices, in our order, at its prices', async () => {
    const { api } = fakeBilling({ prices: { scrap_large: '149,99 TL', other: '1 TL' } });
    expect(await playPacks(api, PACKS).packs()).toEqual([{ id: 'scrap_large', scrap: 4000, price: '149,99 TL' }]);
  });

  it('hands back a paid pack unsettled, and tells pending and cancelled payments apart', async () => {
    const paid = fakeBilling({ purchase: { productId: 'scrap_small', token: 't1', state: '1' } });
    const shop = playPacks(paid.api, PACKS);
    expect(await shop.buy('scrap_small')).toEqual({ ok: true, value: { packId: 'scrap_small', token: 't1' } });
    expect(paid.consumed).toEqual([]);
    await shop.settle({ packId: 'scrap_small', token: 't1' });
    expect(paid.consumed).toEqual(['t1']);

    expect(await playPacks(fakeBilling({ purchase: { productId: 'scrap_small', token: 't2', state: '0' } }).api, PACKS).buy('scrap_small')).toEqual({ ok: false, error: 'pending' });
    expect(await playPacks(fakeBilling({ purchase: 'cancelled' }).api, PACKS).buy('scrap_small')).toEqual({ ok: false, error: 'cancelled' });
  });

  it('finds paid packs left unsettled, but not pending payments or other products', async () => {
    const { api } = fakeBilling({
      owned: [
        { productId: 'scrap_small', token: 'done', state: '1' },
        { productId: 'scrap_large', token: 'waiting', state: '0' },
        { productId: 'not_ours', token: 'x', state: '1' },
      ],
    });
    expect(await playPacks(api, PACKS).unsettled()).toEqual([{ packId: 'scrap_small', token: 'done' }]);
  });
});
