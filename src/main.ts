import './styles.css';
import { Capacitor } from '@capacitor/core';
import { Game } from './app/game';
import { loadCampaign } from './content/levels';
import { LocalSaveRepository, type KeyValueStore } from './infrastructure/local-save';
import { combineOffers, demoOffers, noOffers } from './infrastructure/offers';
import { admobRewarded, rewardedAds, TEST_REWARDED_ID } from './infrastructure/rewarded-ads';
import { playBilling, playPacks } from './infrastructure/play-billing';

const memoryStore = (): KeyValueStore => {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

/** Some private modes throw on access to localStorage; fall back to memory. */
const deviceStore = (): KeyValueStore => {
  try {
    return window.localStorage;
  } catch {
    return memoryStore();
  }
};

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const uiRoot = document.querySelector<HTMLElement>('#ui');
if (!canvas || !uiRoot) throw new Error('Missing #game or #ui element');

/**
 * Rewarded ads and scrap packs. The browser dev server uses a stand-in. On a
 * device, ads use VITE_ADMOB_REWARDED_ID when it is set and Google's test ad
 * otherwise, except in store builds, which show no ads without a real id.
 */
const nativeOffers = () => {
  const adId: string | undefined = import.meta.env.VITE_ADMOB_REWARDED_ID || undefined;
  const testAds = import.meta.env.MODE !== 'release' && !adId;
  const ads = adId || testAds ? rewardedAds(admobRewarded(), adId ?? TEST_REWARDED_ID, testAds) : noOffers;
  return combineOffers(ads, playPacks(playBilling()));
};
const offers = Capacitor.isNativePlatform() ? nativeOffers() : import.meta.env.DEV ? demoOffers() : noOffers;

new Game(canvas, uiRoot, loadCampaign(), new LocalSaveRepository(deviceStore()), (ms) => {
  navigator.vibrate?.(ms);
}, offers).start();

// Offline support (NFR-02) for the web build. The native app already ships its files, so it needs none.
if (import.meta.env.PROD && 'serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js');
  });
}
