import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import type { PackPurchase, ScrapPack } from '../core/ports';
import { err, ok } from '../core/result';
import { SCRAP_PACKS } from '../content/offers';
import type { PackShop } from './offers';

/** A store payment as the billing library reports it; `state` "1" is paid, "0" still pending. */
export interface StorePayment {
  readonly productId: string;
  readonly token: string | undefined;
  readonly state: string | undefined;
}

/** Why the billing library refused: the user backed out, the payment is pending, or anything else. */
export type BillingRefusal = 'cancelled' | 'pending' | 'failed';

/** The part of the billing library the game uses. */
export interface BillingApi {
  supported(): Promise<boolean>;
  prices(ids: readonly string[]): Promise<ReadonlyMap<string, string>>;
  purchase(id: string): Promise<StorePayment | BillingRefusal>;
  owned(): Promise<readonly StorePayment[]>;
  consume(token: string): Promise<void>;
}

const refusal = (e: unknown): BillingRefusal => {
  const { code, message } = (e ?? {}) as { code?: unknown; message?: unknown };
  if (code === 'USER_CANCELED') return 'cancelled';
  if (typeof message === 'string' && /pending/i.test(message)) return 'pending';
  return 'failed';
};

/** Google Play Billing through its Capacitor plugin. */
export const playBilling = (): BillingApi => ({
  supported: async () => (await NativePurchases.isBillingSupported()).isBillingSupported,
  prices: async (ids) => {
    const { products } = await NativePurchases.getProducts({ productIdentifiers: [...ids], productType: PURCHASE_TYPE.INAPP });
    return new Map(products.map((p) => [p.identifier, p.priceString]));
  },
  purchase: async (id) => {
    try {
      // Neither consumed nor acknowledged here: the game credits the scrap first, then settles.
      const t = await NativePurchases.purchaseProduct({
        productIdentifier: id,
        productType: PURCHASE_TYPE.INAPP,
        isConsumable: false,
        autoAcknowledgePurchases: false,
      });
      return { productId: t.productIdentifier, token: t.purchaseToken, state: t.purchaseState };
    } catch (e) {
      return refusal(e);
    }
  },
  owned: async () => {
    const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP });
    return purchases.map((t) => ({ productId: t.productIdentifier, token: t.purchaseToken, state: t.purchaseState }));
  },
  consume: (token) => NativePurchases.consumePurchase({ purchaseToken: token }),
});

const PAID = '1';

/** Scrap packs on Google Play: store prices, paid packs settled (consumed) once credited. */
export const playPacks = (api: BillingApi, packs: readonly { readonly id: string; readonly scrap: number }[] = SCRAP_PACKS): PackShop => {
  const ours = (p: StorePayment): PackPurchase | undefined =>
    p.state === PAID && p.token && packs.some((k) => k.id === p.productId) ? { packId: p.productId, token: p.token } : undefined;
  return {
    packs: async () => {
      try {
        if (!(await api.supported())) return [];
        const prices = await api.prices(packs.map((p) => p.id));
        return packs.flatMap((p): ScrapPack[] => {
          const price = prices.get(p.id);
          return price ? [{ ...p, price }] : [];
        });
      } catch {
        return []; // offline, or no Play Store on this device
      }
    },
    buy: async (id) => {
      const paid = await api.purchase(id);
      if (typeof paid === 'string') return err(paid);
      if (paid.state !== PAID) return err('pending');
      const p = ours(paid);
      return p ? ok(p) : err('failed');
    },
    unsettled: async () => {
      try {
        return (await api.owned()).flatMap((p) => ours(p) ?? []);
      } catch {
        return [];
      }
    },
    settle: async (p) => {
      try {
        await api.consume(p.token);
      } catch {
        // stays owned: offered again by unsettled(), and the save already knows the token
      }
    },
  };
};
