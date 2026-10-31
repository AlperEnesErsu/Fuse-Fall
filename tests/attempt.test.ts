import { describe, expect, it } from 'vitest';
import { newAttempt, settleJob, settleOneShot } from '../src/app/attempt';
import { PAYOUT, payout } from '../src/core/economy';
import { emptyProgress, levelsOf, parseProgress } from '../src/core/progress';
import { scoreLevel, type LevelOutcome } from '../src/core/scoring';
import { loadCampaign } from '../src/content/levels';

/** The value, or a failed test when it is missing. */
const must = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('missing test fixture');
  return value;
};

const campaign = loadCampaign();
const first = must(levelsOf(campaign, 1)[0]);
const NOW = new Date(2026, 9, 18, 12);

const outcome: LevelOutcome = {
  targetsDown: 1,
  targetsTotal: 1,
  chargesUsed: 1,
  chargesMax: 2,
  blocksCollapsed: 4,
  blocksTotal: 4,
  protectedTotal: 0,
  protectedDamaged: 0,
  duration: 3,
  footprint: undefined,
  dominoes: 0,
  demolished: { wood: 4000 },
};
const won = scoreLevel(outcome, { par: 1, bonusCollapse: 0.5 });
const lost = scoreLevel({ ...outcome, targetsDown: 0, blocksCollapsed: 0 }, { par: 1, bonusCollapse: 0.5 });

describe('settling a campaign job', () => {
  it('books the first win: stars, best, full pay, career and the first achievement', () => {
    const attempt = { ...newAttempt(first, { kind: 'campaign' }), stats: { blasts: 2, barrelsBlown: 1, carsWrecked: 0 } };
    const job = settleJob(emptyProgress(), campaign, attempt, won, NOW);
    expect(job.previousBest).toBe(0);
    expect(job.payout).toEqual(payout(won, { firstClear: true, improved: true, firstAttempt: true, daily: false }));
    expect(job.progress.stars[first.id]).toBe(won.stars);
    expect(job.progress.best[first.id]).toBe(won.score);
    expect(job.progress.career.blasts).toBe(2);
    const contractScrap = job.finishedContracts.reduce((s, c) => s + c.reward, 0);
    expect(job.progress.wallet.earned).toBe(job.payout.total + contractScrap);
    expect(job.earned.map((a) => a.id)).toContain('first-job');
    expect(job.progress.achievements).toEqual(expect.arrayContaining(job.earned.map((a) => a.id)));
  });

  it('pays nothing and moves no contract for a replay that gains no stars, and remembers the earlier best', () => {
    const attempt = newAttempt(first, { kind: 'campaign' });
    const once = settleJob(emptyProgress(), campaign, attempt, won, NOW);
    const again = settleJob(once.progress, campaign, attempt, won, NOW);
    expect(again.previousBest).toBe(won.score);
    expect(again.payout.total).toBe(0);
    expect(once.unpaid).toBeUndefined();
    expect(again.unpaid).toBe('replay');
    expect(again.progress.contracts.counts).toEqual(once.progress.contracts.counts);
    expect(again.earned).toEqual([]);
  });

  it('pays a replay that raises the stars, and does not pay the clear bonus twice', () => {
    const attempt = newAttempt(first, { kind: 'campaign' });
    // The first win after a failure is still the first clear.
    const failed = settleJob(emptyProgress(), campaign, attempt, lost, NOW);
    const oneStar = scoreLevel({ ...outcome, chargesUsed: 2, blocksCollapsed: 1 }, { par: 1, bonusCollapse: 0.5 });
    expect(oneStar.stars).toBe(1);
    const cleared = settleJob(failed.progress, campaign, attempt, oneStar, NOW);
    expect(cleared.payout.firstClear).toBe(PAYOUT.firstClear);
    // Three stars on a replay: the gain pays at the repeat share, without the clear bonus.
    const better = settleJob(cleared.progress, campaign, attempt, won, NOW);
    expect(better.payout).toEqual(payout(won, { firstClear: false, improved: true, firstAttempt: false, daily: false }));
    expect(better.payout.total).toBeGreaterThan(0);
    expect(better.unpaid).toBeUndefined();
    expect(settleJob(better.progress, campaign, attempt, won, NOW).payout.total).toBe(0);
  });

  it('does not let a failed level be farmed for its salvage', () => {
    const attempt = newAttempt(first, { kind: 'campaign' });
    const once = settleJob(emptyProgress(), campaign, attempt, lost, NOW);
    expect(once.payout.salvage).toBeGreaterThan(0);
    expect(once.unpaid).toBeUndefined();
    const again = settleJob(once.progress, campaign, attempt, lost, NOW);
    expect(again.payout.total).toBe(0);
    expect(again.unpaid).toBe('retry');
  });

  it('records no stars for a failed job', () => {
    const job = settleJob(emptyProgress(), campaign, newAttempt(first, { kind: 'campaign' }), lost, NOW);
    expect(lost.cleared).toBe(false);
    expect(job.progress.stars[first.id] ?? 0).toBe(0);
  });

  it('counts a daily win once a day, and records no campaign stars for it', () => {
    const attempt = newAttempt(first, { kind: 'daily', day: '2026-10-18', baseId: first.id });
    const once = settleJob(emptyProgress(), campaign, attempt, won, NOW);
    expect(once.progress.daily.lastWon).toBe('2026-10-18');
    expect(once.progress.stars[first.id]).toBeUndefined();
    expect(once.payout).toEqual(payout(won, { firstClear: true, improved: true, firstAttempt: true, daily: true }));
    const again = settleJob(once.progress, campaign, attempt, won, NOW);
    expect(again.payout.total).toBe(0);
    expect(again.unpaid).toBe('daily');
    expect(again.progress.contracts.counts).toEqual(once.progress.contracts.counts);
  });

  it('pays a failed daily its salvage once a day, and still pays the first win of the day in full', () => {
    const attempt = newAttempt(first, { kind: 'daily', day: '2026-10-18', baseId: first.id });
    const failed = settleJob(emptyProgress(), campaign, attempt, lost, NOW);
    expect(failed.payout.salvage).toBeGreaterThan(0);
    const failedAgain = settleJob(failed.progress, campaign, attempt, lost, NOW);
    expect(failedAgain.payout.total).toBe(0);
    const won1 = settleJob(failedAgain.progress, campaign, attempt, won, NOW);
    expect(won1.payout).toEqual(payout(won, { firstClear: true, improved: true, firstAttempt: false, daily: true }));
    // The next day's daily is a new attempt.
    const tomorrow = newAttempt(first, { kind: 'daily', day: '2026-10-19', baseId: first.id });
    expect(settleJob(won1.progress, campaign, tomorrow, lost, NOW).payout.salvage).toBeGreaterThan(0);
  });
});

describe('One Shot record', () => {
  it('keeps the best collapse per structure and says when it is new', () => {
    const a = settleOneShot(emptyProgress(), 'apartment', won);
    expect(a).toMatchObject({ best: Math.round(won.collapseRatio * 100), isNew: true });
    const b = settleOneShot(a.progress, 'apartment', lost);
    expect(b).toMatchObject({ best: a.best, isNew: false });
  });
});

describe('hint-assisted wins', () => {
  it('count as cleared but earn one star, no styles, no clear bonus and no contracts', () => {
    const attempt = { ...newAttempt(first, { kind: 'campaign' }), assisted: true };
    expect(won.stars).toBe(3);
    const job = settleJob(emptyProgress(), campaign, attempt, won, NOW);
    expect(job.result).toMatchObject({ cleared: true, stars: 1, styles: { surgical: false, demolition: false, domino: false } });
    expect(job.progress.stars[first.id]).toBe(1);
    expect(job.progress.cleared[first.id]).toBe(true);
    expect(job.payout).toMatchObject({ styles: 0, firstClear: 0 });
    expect(job.payout.salvage).toBeGreaterThan(0);
    expect(Object.values(job.progress.contracts.counts).every((n) => n === 0)).toBe(true);
    // Working it out alone later still raises the stars and pays for the gain.
    const own = settleJob(job.progress, campaign, newAttempt(first, { kind: 'campaign' }), won, NOW);
    expect(own.progress.stars[first.id]).toBe(3);
    expect(own.payout.total).toBeGreaterThan(0);
  });

  it('leave a failure as it was', () => {
    const attempt = { ...newAttempt(first, { kind: 'campaign' }), assisted: true };
    expect(settleJob(emptyProgress(), campaign, attempt, lost, NOW).result).toEqual(lost);
  });
});

describe('failures in a row', () => {
  it('are kept in the save per level, and a win clears them', () => {
    const attempt = newAttempt(first, { kind: 'campaign' });
    let p = emptyProgress();
    for (let i = 0; i < 3; i++) p = settleJob(p, campaign, attempt, lost, NOW).progress;
    expect(p.stuck[first.id]).toBe(3);
    const reloaded = parseProgress(JSON.parse(JSON.stringify(p)));
    expect(reloaded.ok && reloaded.value.stuck).toEqual({ [first.id]: 3 });
    p = settleJob(p, campaign, attempt, won, NOW).progress;
    expect(p.stuck[first.id]).toBeUndefined();
    // A daily does not count toward a campaign level's hints.
    const daily = newAttempt(first, { kind: 'daily', day: '2026-10-18', baseId: first.id });
    expect(settleJob(emptyProgress(), campaign, daily, lost, NOW).progress.stuck).toEqual({});
  });
});
