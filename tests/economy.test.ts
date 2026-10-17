import { describe, expect, it } from 'vitest';
import { PAYOUT, RANK_THRESHOLDS, payout, rankOf, salvageOf } from '../src/core/economy';
import { buyItem, earnScrap, emptyProgress, parseProgress } from '../src/core/progress';
import { scoreLevel } from '../src/core/scoring';
import { loadCampaign } from '../src/content/levels';
import { WORKSHOP, activeBlastStyle, isOwned, structureItemId, workshopItem } from '../src/content/workshop';
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
  chainBlasts: 0,
  // 10 000 px² of concrete (4/1000) and 5 000 px² of wood (2/1000): 50 scrap of salvage.
  demolished: { concrete: 10_000, wood: 5_000 },
};
const rules = { par: 1, bonusCollapse: 0.5 };
const won = scoreLevel(outcome, rules);
const lost = scoreLevel({ ...outcome, targetsDown: 0 }, rules);

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

  it('only shows blast styles that exist and are owned', () => {
    expect(activeBlastStyle([], 'thermite')).toBe('classic');
    expect(activeBlastStyle(['thermite'], 'thermite')).toBe('thermite');
    expect(activeBlastStyle(['nonsense'], 'nonsense')).toBe('classic');
    expect(activeBlastStyle([structureItemId('bridge')], structureItemId('bridge'))).toBe('classic');
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
    expect(parsed.ok && parsed.value.workshop).toEqual({ owned: [], blastStyle: 'classic' });
  });

  it('round-trips the wallet and workshop and drops malformed values', () => {
    const saved = { ...emptyProgress(), wallet: { balance: 120, earned: 900 }, workshop: { owned: ['neon', 7], blastStyle: 'neon' } };
    const parsed = parseProgress(JSON.parse(JSON.stringify(saved)));
    expect(parsed.ok && parsed.value.wallet).toEqual({ balance: 120, earned: 900 });
    expect(parsed.ok && parsed.value.workshop).toEqual({ owned: ['neon'], blastStyle: 'neon' });
    const bad = parseProgress({ ...saved, wallet: { balance: -5, earned: 'lots' } });
    expect(bad.ok && bad.value.wallet).toEqual({ balance: 0, earned: 0 });
  });
});
