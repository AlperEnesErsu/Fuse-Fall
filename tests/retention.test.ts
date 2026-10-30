import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, FOREMAN_RANK, newAchievements } from '../src/core/achievements';
import { RANK_THRESHOLDS } from '../src/core/economy';
import { dailyChallenge, dailyPool, dayOf } from '../src/core/daily';
import { difficultyOf } from '../src/core/difficulty';
import {
  currentStreak,
  earnScrap,
  emptyProgress,
  parseProgress,
  previousDay,
  recordDailyWin,
  recordStars,
  unlockAchievements,
} from '../src/core/progress';
import { scoreLevel } from '../src/core/scoring';
import { loadCampaign } from '../src/content/levels';

const campaign = loadCampaign();

describe('daily mission', () => {
  it('is the same mission for everyone all day: it depends on the date alone', () => {
    const a = dailyChallenge(campaign, '2026-10-17');
    const b = dailyChallenge(campaign, '2026-10-17');
    expect(a?.base.id).toBe(b?.base.id);
    // No progress goes in, so opening a city mid-day cannot change it.
    expect(dailyChallenge.length).toBe(2);
  });

  it('is drawn from every easy and medium job, across the cities', () => {
    const pool = dailyPool(campaign);
    expect(pool.every((l) => ['easy', 'medium'].includes(difficultyOf(l)))).toBe(true);
    expect(new Set(pool.map((l) => l.world)).size).toBe(campaign.worlds.length);
    const days = Array.from({ length: 120 }, (_, i) => dayOf(new Date(2026, 0, 1 + i)));
    expect(new Set(days.map((day) => dailyChallenge(campaign, day)?.base.world)).size).toBeGreaterThan(3);
  });

  it('allows exactly par charges and has its own id', () => {
    const d = dailyChallenge(campaign, '2026-10-18');
    expect(d?.level.id).toBe('daily-2026-10-18');
    expect(d?.level.charges.max).toBe(d?.base.charges.par);
  });

  it('varies from day to day', () => {
    const days = Array.from({ length: 14 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
    const ids = new Set(days.map((day) => dailyChallenge(campaign, day)?.base.id));
    expect(ids.size).toBeGreaterThan(3);
  });

  it('formats the local calendar day', () => {
    expect(dayOf(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('daily streak', () => {
  it('steps back across months and years on the calendar', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    expect(previousDay('2027-01-01')).toBe('2026-12-31');
  });

  it('grows on consecutive days, ignores repeats, and resets after a gap', () => {
    let p = recordDailyWin(emptyProgress(), '2026-10-15');
    p = recordDailyWin(p, '2026-10-16');
    p = recordDailyWin(p, '2026-10-16');
    expect(p.daily).toEqual({ lastWon: '2026-10-16', streak: 2 });
    expect(currentStreak(p, '2026-10-17')).toBe(2);
    expect(currentStreak(p, '2026-10-18')).toBe(0);
    expect(recordDailyWin(p, '2026-10-19').daily.streak).toBe(1);
  });

  it('reads saves made before dailies and achievements existed', () => {
    const legacy = parseProgress({ version: 1, stars: {}, best: {}, settings: {} });
    expect(legacy.ok && legacy.value.daily).toEqual({ lastWon: undefined, streak: 0 });
    expect(legacy.ok && legacy.value.achievements).toEqual([]);
    // Accessibility options arrived later too: off unless chosen.
    expect(legacy.ok && legacy.value.settings).toMatchObject({ leftHanded: false, reducedMotion: false, largeText: false });
  });
});

describe('achievements', () => {
  const outcome = {
    targetsDown: 1,
    targetsTotal: 1,
    chargesUsed: 1,
    chargesMax: 2,
    blocksCollapsed: 4,
    blocksTotal: 4,
    protectedTotal: 1,
    protectedDamaged: 0,
    duration: 3,
    footprint: undefined,
    dominoes: 0,
    demolished: {},
  };
  const result = scoreLevel(outcome, { par: 1, bonusCollapse: 0.5 });
  const stats = { barrelsBlown: 3, carsWrecked: 0, implosions: 0, detonations: 0 };

  it('unlocks every earned achievement once', () => {
    const earned = newAchievements({ progress: emptyProgress(), campaign, result, stats, streak: 0 }).map((a) => a.id);
    expect(earned).toEqual(['first-job', 'lean', 'chain', 'clean', 'total']);
    const p = unlockAchievements(emptyProgress(), earned);
    expect(newAchievements({ progress: p, campaign, result, stats, streak: 0 })).toEqual([]);
  });

  it('rewards a perfect city and daily streaks', () => {
    let p = emptyProgress();
    for (const l of campaign.levels.filter((l) => l.world === 1)) p = recordStars(p, l.id, 3);
    const ids = newAchievements({ progress: p, campaign, result, stats, streak: 7 }).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['perfect-city', 'streak-3', 'streak-7']));
  });

  it('rewards the newer mechanics and the Foreman rank', () => {
    const ids = (patch: Partial<typeof stats>, dominoes = 0, earned = 0) =>
      newAchievements({
        progress: earnScrap(emptyProgress(), earned),
        campaign,
        result: scoreLevel({ ...outcome, dominoes }, { par: 1, bonusCollapse: 0.5 }),
        stats: { ...stats, ...patch },
        streak: 0,
      }).map((a) => a.id);
    expect(ids({})).not.toEqual(expect.arrayContaining(['domino']));
    expect(ids({}, 1)).toContain('domino');
    expect(ids({ implosions: 1 })).toContain('implosion');
    expect(ids({ detonations: 1 })).toContain('airburst');
    expect(ids({}, 0, RANK_THRESHOLDS[FOREMAN_RANK] - 1)).not.toContain('foreman');
    expect(ids({}, 0, RANK_THRESHOLDS[FOREMAN_RANK])).toContain('foreman');
  });

  it('have unique ids', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});
