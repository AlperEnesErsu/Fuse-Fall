import { describe, expect, it } from 'vitest';
import { Progression, contractViews } from '../src/app/progression';
import { emptyProgress, levelsOf, recordStars } from '../src/core/progress';
import { loadCampaign } from '../src/content/levels';

/** The value, or a failed test when it is missing. */
const must = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('missing test fixture');
  return value;
};

const campaign = loadCampaign();
const ankara = levelsOf(campaign, 1);

describe('progression', () => {
  it('opens only the first city and its first mission on a fresh save', () => {
    const access = new Progression(campaign, emptyProgress, false);
    expect(access.worldStatus(1).kind).toBe('open');
    expect(access.worldStatus(2).kind).toBe('locked');
    expect(access.levelUnlocked(must(ankara[1]).id)).toBe(false);
    expect(access.nextMission()?.id).toBe(must(ankara[0]).id);
  });

  it('continues with the first open mission not yet won', () => {
    const progress = recordStars(emptyProgress(), must(ankara[0]).id, 2);
    expect(new Progression(campaign, () => progress, false).nextMission()?.id).toBe(must(ankara[1]).id);
  });

  it('opens every city with missions under the test switch', () => {
    const access = new Progression(campaign, emptyProgress, true);
    expect(access.worldStatus(2).kind).toBe('open');
    expect(access.levelUnlocked(must(ankara[5]).id)).toBe(true);
  });

  it('knows the next mission in a city, and none after the last', () => {
    const access = new Progression(campaign, emptyProgress, false);
    expect(access.nextLevel(must(ankara[0]))?.id).toBe(must(ankara[1]).id);
    expect(access.nextLevel(must(ankara[ankara.length - 1]))).toBeUndefined();
  });

  it("lists this week's contracts with zero counts on a fresh save", () => {
    const views = contractViews(emptyProgress(), new Date(2026, 9, 18));
    expect(views.length).toBeGreaterThan(0);
    for (const v of views) expect(v.count).toBe(0);
  });
});
