import { describe, expect, it } from 'vitest';
import { dailyChallenge, dailyPool, dayOf } from '../src/core/daily';
import { canMirror, leanLevel, mirrorLevel } from '../src/core/daily-modifiers';
import { WORLD } from '../src/core/level';
import { DAILY_OPTIONS } from '../src/content/daily';
import { loadCampaign } from '../src/content/levels';
import { MASTERY } from '../src/content/mastery';
import { playSolution } from './play';

const campaign = loadCampaign();
const pool = dailyPool(campaign);
/** A job as the daily serves it before any twist: par charges only. */
const asDaily = (id: string) => {
  const d = dailyChallenge({ worlds: campaign.worlds, levels: campaign.levels.filter((l) => l.id === id) }, '2026-01-01');
  if (!d) throw new Error(`no daily for ${id}`);
  return d.level;
};

describe('daily twists', () => {
  it('mirrors a site and its solution exactly: twice is the original', () => {
    for (const level of pool.filter(canMirror)) {
      const twice = mirrorLevel(mirrorLevel(level));
      expect(twice).toEqual(level);
      const once = mirrorLevel(level);
      expect(once.blocks[0]?.x).toBeCloseTo(WORLD.width - (level.blocks[0]?.x ?? 0));
    }
  });

  it('leaves traffic jobs out of the mirror: one-way traffic only runs rightwards', () => {
    expect(pool.some((l) => l.cars.length > 0)).toBe(true);
    for (const l of pool.filter((x) => x.cars.length > 0)) expect(DAILY_OPTIONS.canMirror?.(l)).toBe(false);
  });

  // The proof behind every mirrored day: the mirrored recorded solution wins the mirrored job.
  it.each(pool.filter((l) => DAILY_OPTIONS.canMirror?.(l)).map((l) => [l.id] as const))('%s mirrored is won by its mirrored solution', (id) => {
    const level = mirrorLevel(asDaily(id));
    const result = playSolution(level, level.solution.fireAt, level.solution.charges, level.solution.detonateAt).result;
    expect(result?.cleared, JSON.stringify(result)).toBe(true);
  });

  // The proof behind every lean day: the job's one-charge-fewer play wins with one charge fewer.
  it.each(pool.filter((l) => DAILY_OPTIONS.canLean?.(l)).map((l) => [l.id] as const))('%s lean is won by its one-charge-fewer play', (id) => {
    const entry = MASTERY[id];
    if (!entry) throw new Error(`no mastery play for ${id}`);
    const level = leanLevel(asDaily(id));
    expect(level.charges.max).toBe(level.charges.par);
    const result = playSolution(level, entry.solution.fireAt, entry.solution.charges, entry.solution.detonateAt).result;
    expect(result?.cleared, JSON.stringify(result)).toBe(true);
  });

  // Whatever the date, a daily plays exactly like its base job: the proofs above hold for every day.
  it('seeds a daily with its base job, so the same job plays the same on any day', () => {
    const a = dailyChallenge(campaign, '2026-03-01', DAILY_OPTIONS);
    const b = dailyChallenge({ ...campaign, levels: campaign.levels.filter((l) => l.id === a?.base.id) }, '2031-09-17');
    if (!a || !b) throw new Error('no daily');
    expect(a.level.seed).toBe(a.base.id);
    const ra = playSolution({ ...b.level, id: 'daily-2026-03-01' }).result;
    const rb = playSolution(b.level).result;
    expect(ra).toEqual(rb);
  });

  it('gives a year of days a mix of plain, mirrored and lean, the same for everyone each day', () => {
    const days = Array.from({ length: 365 }, (_, i) => dayOf(new Date(2027, 0, 1 + i)));
    const twists = days.map((d) => dailyChallenge(campaign, d, DAILY_OPTIONS)?.modifier ?? 'plain');
    const count = (k: string) => twists.filter((t) => t === k).length;
    expect(count('plain')).toBeGreaterThan(60);
    expect(count('mirror')).toBeGreaterThan(60);
    // Lean needs a proven one-charge-fewer win, which few easy and medium jobs have: a rare day.
    expect(count('lean')).toBeGreaterThan(0);
    expect(days.map((d) => dailyChallenge(campaign, d, DAILY_OPTIONS)?.modifier)).toEqual(days.map((d) => dailyChallenge(campaign, d, DAILY_OPTIONS)?.modifier));
  });

  it('serves a twisted day as the job with that twist, and never asks for its campaign goal', () => {
    const days = Array.from({ length: 60 }, (_, i) => dayOf(new Date(2027, 0, 1 + i)));
    for (const day of days) {
      const d = dailyChallenge(campaign, day, DAILY_OPTIONS);
      if (!d) continue;
      expect(d.level.mastery).toBeUndefined();
      if (d.modifier === 'lean') expect(d.level.charges.max).toBe(d.base.charges.par - 1);
      else expect(d.level.charges.max).toBe(d.base.charges.par);
      // Crane jobs record no charge: their blocks show the mirror just as well.
      if (d.modifier === 'mirror') expect(d.level.blocks.map((b) => b.x)).toEqual(d.base.blocks.map((b) => WORLD.width - b.x));
    }
  });
});
