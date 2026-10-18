import { AdMob, AdmobConsentStatus, RewardAdPluginEvents, type AdmobConsentInfo } from '@capacitor-community/admob';
import type { PluginListenerHandle } from '@capacitor/core';
import { err, ok } from '../core/result';
import type { AdSource } from './offers';

/** Google's sample rewarded ad unit for Android: always fills, never pays. */
export const TEST_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917';

/** How long a workshop visit waits for an ad to load before showing the offers without it. */
const LOAD_WAIT_MS = 6000;

export type ShowOutcome = 'rewarded' | 'dismissed' | 'failed';

/** The part of the ad network the game uses. */
export interface RewardedAdApi {
  initialize(): Promise<void>;
  requestConsentInfo(): Promise<AdmobConsentInfo>;
  showConsentForm(): Promise<AdmobConsentInfo>;
  showPrivacyOptionsForm(): Promise<void>;
  prepare(adId: string, testing: boolean): Promise<void>;
  /** Shows the prepared ad and resolves once it is closed (or could not be shown). */
  show(): Promise<ShowOutcome>;
}

/** AdMob through its Capacitor plugin. */
export const admobRewarded = (): RewardedAdApi => ({
  initialize: () => AdMob.initialize(),
  requestConsentInfo: () => AdMob.requestConsentInfo(),
  showConsentForm: () => AdMob.showConsentForm(),
  showPrivacyOptionsForm: () => AdMob.showPrivacyOptionsForm(),
  prepare: async (adId, testing) => {
    await AdMob.prepareRewardVideoAd({ adId, isTesting: testing });
  },
  // The plugin's show call only settles when a reward is earned, so the
  // outcome comes from its events: rewarded, then dismissed, or failed to show.
  show: () =>
    new Promise<ShowOutcome>((resolve) => {
      let rewarded = false;
      let settled = false;
      const handles: Promise<PluginListenerHandle>[] = [];
      const finish = (outcome: ShowOutcome): void => {
        if (settled) return;
        settled = true;
        for (const h of handles) void h.then((l) => l.remove());
        resolve(outcome);
      };
      handles.push(AdMob.addListener(RewardAdPluginEvents.Rewarded, () => (rewarded = true)));
      handles.push(AdMob.addListener(RewardAdPluginEvents.Dismissed, () => finish(rewarded ? 'rewarded' : 'dismissed')));
      handles.push(AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => finish('failed')));
      AdMob.showRewardVideoAd().then(
        () => (rewarded = true),
        () => finish('failed'),
      );
    }),
});

/**
 * Rewarded ads behind the consent rules: the consent form comes first where
 * the law asks for it, and no ad is requested until the network says it may
 * be. One ad is kept loaded so the button only shows when it can play.
 */
export const rewardedAds = (api: RewardedAdApi, adId: string, testing: boolean): AdSource => {
  let setup: Promise<boolean> | undefined;
  let privacyChoices = false;
  let loaded = false;
  let loading: Promise<void> | undefined;

  const consented = (): Promise<boolean> => {
    setup ??= (async () => {
      await api.initialize();
      let info = await api.requestConsentInfo();
      if (info.status === AdmobConsentStatus.REQUIRED && info.isConsentFormAvailable) info = await api.showConsentForm();
      // The plugin does not export this enum; its value is the string.
      privacyChoices = String(info.privacyOptionsRequirementStatus) === 'REQUIRED';
      return info.canRequestAds;
    })().catch(() => {
      setup = undefined; // offline or refused: ask again next time
      return false;
    });
    return setup;
  };

  const load = (): Promise<void> => {
    loading ??= api
      .prepare(adId, testing)
      .then(
        () => void (loaded = true),
        () => undefined,
      )
      .finally(() => (loading = undefined));
    return loading;
  };

  return {
    adReady: async () => {
      if (!(await consented())) return false;
      if (!loaded) await Promise.race([load(), new Promise((r) => setTimeout(r, LOAD_WAIT_MS))]);
      return loaded;
    },
    showRewardedAd: async () => {
      if (!(await consented()) || !loaded) return err('unavailable');
      loaded = false;
      const outcome = await api.show();
      void load(); // the next one, ready for the next visit
      return outcome === 'rewarded' ? ok(true) : err(outcome === 'dismissed' ? 'cancelled' : 'failed');
    },
    privacyChoicesRequired: () => privacyChoices,
    showPrivacyChoices: async () => {
      try {
        await api.showPrivacyOptionsForm();
      } catch {
        // the form could not open (offline); the button stays for next time
      }
    },
  };
};
