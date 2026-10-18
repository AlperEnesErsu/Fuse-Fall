import { describe, expect, it } from 'vitest';
import { OfferDesk, type OfferNotice } from '../src/app/offer-desk';
import { ADS } from '../src/core/economy';
import type { OfferError, OfferStore, PackPurchase } from '../src/core/ports';
import { emptyProgress, type Progress } from '../src/core/progress';
import { err, ok, type Result } from '../src/core/result';
import { noOffers } from '../src/infrastructure/offers';
import { LocalSaveRepository, type KeyValueStore } from '../src/infrastructure/local-save';

const flush = () => new Promise((r) => setTimeout(r, 0));

/** A store with one paid pack waiting, or more; it remembers what it was told to settle. */
const fakeStore = (o: { buy?: Result<PackPurchase, OfferError>; owned?: PackPurchase[]; ad?: Result<true, OfferError> } = {}) => {
  let owned = [...(o.owned ?? [])];
  const settled: string[] = [];
  const store: OfferStore = {
    ...noOffers,
    adReady: () => Promise.resolve(true),
    showRewardedAd: () => Promise.resolve(o.ad ?? ok(true)),
    buy: () => {
      const b = o.buy ?? err('failed');
      if (b.ok) owned.push(b.value);
      return Promise.resolve(b);
    },
    unsettled: () => Promise.resolve(owned),
    settle: (p) => {
      settled.push(p.token);
      owned = owned.filter((x) => x.token !== p.token);
      return Promise.resolve();
    },
  };
  return { store, settled, owned: () => owned };
};

/** Progress kept in memory, with saves that work or fail on demand. */
const fakeLedger = (start: Progress = emptyProgress()) => {
  let progress = start;
  let saved: Progress | undefined;
  const ledger = {
    writable: true,
    get: () => progress,
    set: (p: Progress) => {
      progress = p;
      if (ledger.writable) saved = p;
      return ledger.writable;
    },
    saved: () => saved,
  };
  return ledger;
};

const desk = (store: OfferStore, ledger: ReturnType<typeof fakeLedger>, notices: OfferNotice[] = []) =>
  new OfferDesk(store, ledger, (n) => notices.push(n), () => '2026-10-18', false);

const PAID: PackPurchase = { packId: 'scrap_small', token: 'pay-1' };

describe('scrap pack purchases', () => {
  it('credits a pack, saves it, then settles it with the store', async () => {
    const { store, settled } = fakeStore({ buy: ok(PAID) });
    const ledger = fakeLedger();
    expect(await desk(store, ledger).buy('scrap_small')).toBe(true);
    expect(ledger.saved()?.wallet.balance).toBe(500);
    expect(settled).toEqual(['pay-1']);
  });

  it('leaves the payment unsettled when the save fails, and credits it once on the next launch', async () => {
    const { store, settled } = fakeStore({ buy: ok(PAID) });
    const ledger = fakeLedger();
    ledger.writable = false;
    const notices: OfferNotice[] = [];
    await desk(store, ledger, notices).buy('scrap_small');
    expect(settled).toEqual([]);
    expect(notices).toContainEqual({ kind: 'unsaved' });

    // Next launch: the save never held the scrap, the store still has the payment.
    const relaunched = fakeLedger(ledger.saved() ?? emptyProgress());
    expect(await desk(store, relaunched).settle()).toBe(true);
    expect(relaunched.saved()?.wallet.balance).toBe(500);
    expect(settled).toEqual(['pay-1']);
  });

  it('never credits a payment twice, but still settles one the save already holds', async () => {
    const { store, settled } = fakeStore({ owned: [PAID] });
    const ledger = fakeLedger();
    const d = desk(store, ledger);
    await flush(); // the launch-time ad check
    expect(await d.settle()).toBe(true);
    // Settling failed silently last time: the store offers the same payment again.
    const again = fakeStore({ owned: [PAID] });
    expect(await desk(again.store, ledger).settle()).toBe(false);
    expect(ledger.get().wallet.balance).toBe(500);
    expect(settled).toEqual(['pay-1']);
    expect(again.settled).toEqual(['pay-1']);
  });

  it('tells a pending payment from a failure, and checks for waiting payments after either', async () => {
    const notices: OfferNotice[] = [];
    const pending = fakeStore({ buy: err('pending'), owned: [PAID] });
    const ledger = fakeLedger();
    expect(await desk(pending.store, ledger, notices).buy('scrap_small')).toBe(false);
    expect(notices).toContainEqual({ kind: 'pending' });
    expect(ledger.get().wallet.balance).toBe(500); // the earlier payment came through meanwhile
    const cancelled: OfferNotice[] = [];
    await desk(fakeStore({ buy: err('cancelled') }).store, fakeLedger(), cancelled).buy('scrap_small');
    expect(cancelled).toEqual([]);
  });
});

describe('rewarded ads', () => {
  it('pays only for an ad watched to the end, and stops at the daily cap', async () => {
    const ledger = fakeLedger();
    const notices: OfferNotice[] = [];
    expect(await desk(fakeStore({ ad: err('cancelled') }).store, ledger, notices).watchAd()).toBe(false);
    const d = desk(fakeStore().store, ledger, notices);
    for (let i = 0; i < ADS.dailyCap; i++) expect(await d.watchAd()).toBe(true);
    expect(await d.watchAd()).toBe(false);
    expect(ledger.get().wallet.balance).toBe(ADS.dailyCap * ADS.reward);
    expect(notices.at(-1)).toEqual({ kind: 'capped' });
    expect(d.canDouble(100)).toBe(false);
  });
});

describe('local save', () => {
  const memory = (): KeyValueStore & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  };

  it('reports a save that held, and one that was silently dropped', () => {
    expect(new LocalSaveRepository(memory()).save(emptyProgress())).toBe(true);
    const dropping: KeyValueStore = { getItem: () => null, setItem: () => undefined };
    expect(new LocalSaveRepository(dropping).save(emptyProgress())).toBe(false);
    const full: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(new LocalSaveRepository(full).save(emptyProgress())).toBe(false);
  });

  it('keeps the last good save as the backup, and never backs up a corrupt one', () => {
    const store = memory();
    const repo = new LocalSaveRepository(store);
    repo.save({ ...emptyProgress(), stars: { a: 1 } });
    repo.save({ ...emptyProgress(), stars: { a: 2 } }); // the backup now holds a: 1
    store.data.set('fuse-and-fall/progress', '{broken');
    repo.save({ ...emptyProgress(), stars: { a: 3 } });
    store.data.set('fuse-and-fall/progress', 'null');
    expect(repo.load().stars).toEqual({ a: 1 });
  });
});
