import { describe, expect, it } from 'vitest';
import { ADS, PAYOUT, RANK_THRESHOLDS, adsToday, payout, rankOf, salvageOf } from '../src/core/economy';
import { addBoughtScrap, buyItem, earnScrap, emptyProgress, parseProgress, recordCareer, recordOneShot, rewardAd } from '../src/core/progress';
import { scoreLevel } from '../src/core/scoring';
import { loadCampaign } from '../src/content/levels';
import { WORKSHOP, activeLook, isOwned, structureItemId, workshopItem } from '../src/content/workshop';
import { SANDBOX_TEMPLATES } from '../src/content/sandbox';
import { playSolution } from './play';

const outcome = {
  targetsDown: 1,
  targetsTotal: 1,
  chargesUsed: 1,
  chargesMax: 2,
  blocksCollapsed: 6,
  blocksTotal: 10,
  protectedTotal: 0,
  protectedDamaged: 0,
  duration: 3,
  footprint: undefined,
  dominoes: 0,
  // 10 000 px² of concrete (4/1000) and 5 000 px² of wood (2/1000): 50 scrap of salvage.
  demolished: { concrete: 10_000, wood: 5_000 },
};
const rules = { par: 1, bonusCollapse: 0.5 };
const won = scoreLevel(outcome, rules);
const lost = scoreLevel({ ...outcome, targetsDown: 0, blocksCollapsed: 2 }, rules);

describe('payout', () => {
  it('pays salvage by material, a bonus per play style and one for the first clear', () => {
    expect(salvageOf(outcome.demolished)).toBe(50);
    // Surgical and demolition held: two styles.
    expect(payout(won, { firstClear: true, daily: false })).toEqual({
      salvage: 50,
      styles: 2 * PAYOUT.perStyle,
      firstClear: PAYOUT.firstClear,
      total: 50 + 2 * PAYOUT.perStyle + PAYOUT.firstClear,
    });
  });

  it('pays less for repeats and failures, and double for the daily', () => {
    expect(payout(won, { firstClear: false, daily: false }).total).toBe(Math.round(50 * PAYOUT.repeat) + PAYOUT.perStyle);
    expect(payout(lost, { firstClear: true, daily: false })).toMatchObject({ salvage: Math.round(50 * PAYOUT.failed), styles: 0, firstClear: 0 });
    expect(payout(won, { firstClear: true, daily: true })).toMatchObject({ salvage: 100, firstClear: 0 });
  });

  it('measures what a real job brought down', () => {
    const level = loadCampaign().levels.find((l) => l.id === 'w1-05');
    if (!level) throw new Error('missing w1-05');
    const result = playSolution(level).result;
    if (!result) throw new Error('no result');
    expect(salvageOf(result.demolished)).toBeGreaterThan(0);
    expect(payout(result, { firstClear: true, daily: false }).total).toBeGreaterThan(PAYOUT.firstClear);
  });
});

describe('career and workshop', () => {
  it('ranks by lifetime earnings, which spending never lowers', () => {
    expect(rankOf(0)).toEqual({ index: 0, next: RANK_THRESHOLDS[1] });
    expect(rankOf(RANK_THRESHOLDS[2]).index).toBe(2);
    expect(rankOf(1e9)).toEqual({ index: RANK_THRESHOLDS.length - 1, next: undefined });
    const rich = earnScrap(emptyProgress(), 1000);
    const item = workshopItem('thermite');
    if (!item) throw new Error('missing thermite');
    const bought = buyItem(rich, item);
    if (!bought.ok) throw new Error(bought.error);
    expect(bought.value.wallet).toEqual({ balance: 1000 - item.cost, earned: 1000 });
    expect(buyItem(bought.value, item)).toEqual({ ok: false, error: 'owned' });
    expect(buyItem(emptyProgress(), item)).toEqual({ ok: false, error: 'insufficient' });
  });

  it('only shows looks that exist, are of the right kind and are owned', () => {
    expect(activeLook([], 'thermite', 'blast-style')).toBe('classic');
    expect(activeLook(['thermite'], 'thermite', 'blast-style')).toBe('thermite');
    expect(activeLook(['nonsense'], 'nonsense', 'blast-style')).toBe('classic');
    expect(activeLook([structureItemId('bridge')], structureItemId('bridge'), 'blast-style')).toBe('classic');
    // A theme id is not a blast style, and themes fall back to real materials.
    expect(activeLook(['theme:ice'], 'theme:ice', 'blast-style')).toBe('classic');
    expect(activeLook(['theme:ice'], 'theme:ice', 'block-theme')).toBe('theme:ice');
    expect(activeLook([], 'theme:ice', 'block-theme')).toBe('theme:standard');
  });

  it('lists every Free Site structure, with some free from the start', () => {
    for (const t of SANDBOX_TEMPLATES) expect(workshopItem(structureItemId(t.id))).toBeDefined();
    expect(WORKSHOP.filter((i) => i.kind === 'structure' && isOwned([], i)).length).toBeGreaterThan(0);
    expect(new Set(WORKSHOP.map((i) => i.id)).size).toBe(WORKSHOP.length);
  });
});

describe('saved economy', () => {
  it('loads older saves with an empty wallet and the default style', () => {
    const old = { ...emptyProgress() } as Record<string, unknown>;
    delete old.wallet;
    delete old.workshop;
    const parsed = parseProgress(JSON.parse(JSON.stringify(old)));
    expect(parsed.ok && parsed.value.wallet).toEqual({ balance: 0, earned: 0 });
    expect(parsed.ok && parsed.value.workshop).toEqual({ owned: [], blastStyle: 'classic', blockTheme: 'theme:standard' });
  });

  it('round-trips the wallet and workshop and drops malformed values', () => {
    const saved = { ...emptyProgress(), wallet: { balance: 120, earned: 900 }, workshop: { owned: ['neon', 7], blastStyle: 'neon', blockTheme: 'theme:ice' } };
    const parsed = parseProgress(JSON.parse(JSON.stringify(saved)));
    expect(parsed.ok && parsed.value.wallet).toEqual({ balance: 120, earned: 900 });
    expect(parsed.ok && parsed.value.workshop).toEqual({ owned: ['neon'], blastStyle: 'neon', blockTheme: 'theme:ice' });
    const bad = parseProgress({ ...saved, wallet: { balance: -5, earned: 'lots' } });
    expect(bad.ok && bad.value.wallet).toEqual({ balance: 0, earned: 0 });
  });
});

describe('One Shot records', () => {
  it('keeps the best whole-percent collapse per structure and survives a save', () => {
    let p = recordOneShot(emptyProgress(), 'chimney', 62.4);
    p = recordOneShot(p, 'chimney', 40);
    expect(p.oneShot).toEqual({ chimney: 62 });
    const parsed = parseProgress(JSON.parse(JSON.stringify({ ...p, oneShot: { chimney: 62, bad: 140, worse: 'x' } })));
    expect(parsed.ok && parsed.value.oneShot).toEqual({ chimney: 62 });
  });
});

describe('scrap offers', () => {
  it('lets bought scrap be spent without raising the career rank', () => {
    const p = addBoughtScrap(emptyProgress(), 4000, 'token-a');
    expect(p.wallet).toEqual({ balance: 4000, earned: 0 });
    expect(rankOf(p.wallet.earned).index).toBe(0);
  });

  it('credits a payment once, even when the store reports it again after a reload', () => {
    const p = addBoughtScrap(emptyProgress(), 500, 'token-a');
    const parsed = parseProgress(JSON.parse(JSON.stringify(p)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(addBoughtScrap(parsed.value, 500, 'token-a')).toBe(parsed.value);
    expect(addBoughtScrap(parsed.value, 500, 'token-b').wallet.balance).toBe(1000);
  });

  it('counts rewarded ads per day and starts each day afresh', () => {
    let p = rewardAd(emptyProgress(), '2026-10-17', ADS.reward);
    p = rewardAd(p, '2026-10-17', ADS.reward);
    expect(p.wallet.balance).toBe(2 * ADS.reward);
    expect(adsToday(p.ads, '2026-10-17')).toBe(2);
    expect(adsToday(p.ads, '2026-10-18')).toBe(0);
    expect(rewardAd(p, '2026-10-18', ADS.reward).ads).toEqual({ day: '2026-10-18', count: 1 });
  });

  it('keeps the ad count through a save and resets a malformed one', () => {
    const p = rewardAd(emptyProgress(), '2026-10-17', ADS.reward);
    const parsed = parseProgress(JSON.parse(JSON.stringify(p)));
    expect(parsed.ok && parsed.value.ads).toEqual({ day: '2026-10-17', count: 1 });
    const bad = parseProgress({ ...p, ads: { day: 'yesterday', count: -2 } });
    expect(bad.ok && bad.value.ads).toEqual({ day: '', count: 0 });
  });
});

describe('career statistics', () => {
  it('adds up finished jobs and survives a save', () => {
    let p = recordCareer(emptyProgress(), { cleared: true, blasts: 3, area: 12_000.4, barrels: 1, cars: 0 });
    p = recordCareer(p, { cleared: false, blasts: 1, area: 500, barrels: 0, cars: 2 });
    expect(p.career).toEqual({ jobs: 2, cleared: 1, blasts: 4, area: 12_500, barrels: 1, cars: 2 });
    const parsed = parseProgress(JSON.parse(JSON.stringify(p)));
    expect(parsed.ok && parsed.value.career).toEqual(p.career);
    const legacy = parseProgress({ version: 1, stars: {}, best: {}, settings: {} });
    expect(legacy.ok && legacy.value.career).toEqual({ jobs: 0, cleared: 0, blasts: 0, area: 0, barrels: 0, cars: 0 });
  });
});
