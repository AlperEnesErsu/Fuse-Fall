import { describe, expect, it } from 'vitest';
import {
  ADVANCED_STARS,
  CONTRACTS_PER_WEEK,
  NO_CONTRACTS,
  advanceContracts,
  contractsOf,
  weekOf,
  weeklyContracts,
  type JobFacts,
} from '../src/core/contracts';
import { emptyProgress, parseProgress, recordContracts } from '../src/core/progress';

const job = (o: Partial<JobFacts> = {}): JobFacts => ({
  counts: true,
  cleared: true,
  stars: 1,
  underPar: false,
  daily: false,
  barrels: 0,
  cars: 0,
  implosions: 0,
  domino: false,
  ...o,
});

describe('weekly contracts', () => {
  it('numbers weeks the ISO way, Monday to Sunday', () => {
    expect(weekOf(new Date(2026, 9, 18))).toBe('2026-W42'); // Sunday
    expect(weekOf(new Date(2026, 9, 19))).toBe('2026-W43'); // Monday
    expect(weekOf(new Date(2027, 0, 1))).toBe('2026-W53'); // a Friday still in the old year's last week
  });

  it('draws three different contracts a week, the same for everyone, only basic ones for new players', () => {
    for (let w = 1; w <= 52; w++) {
      const week = `2026-W${String(w).padStart(2, '0')}`;
      const fresh = weeklyContracts(week, 0);
      expect(fresh).toHaveLength(CONTRACTS_PER_WEEK);
      expect(new Set(fresh.map((c) => c.kind)).size).toBe(CONTRACTS_PER_WEEK);
      for (const c of fresh) expect(['clear', 'three-stars', 'surgical', 'daily']).toContain(c.kind);
      expect(weeklyContracts(week, 0)).toEqual(fresh);
    }
    const kinds = new Set(Array.from({ length: 52 }, (_, w) => weeklyContracts(`2026-W${w + 1}`, ADVANCED_STARS)).flat().map((c) => c.kind));
    expect(kinds.size).toBeGreaterThan(5);
  });

  it('keeps the week it drew, even when the player crosses into the advanced pool mid-week', () => {
    const drawn = contractsOf(NO_CONTRACTS, '2026-W42', 0);
    expect(contractsOf(drawn, '2026-W42', 500)).toBe(drawn);
    expect(contractsOf(drawn, '2026-W43', 0).week).toBe('2026-W43');
  });

  it('counts jobs up to the goal, pays each contract once, and starts afresh next week', () => {
    let p = emptyProgress();
    const week = '2026-W42';
    const kinds = contractsOf(p.contracts, week, 0).kinds;
    const goals = weeklyContracts(week, 0);
    let paid = 0;
    let finished = 0;
    // Every kind a basic contract can be: a cleared, 3-star, under-par daily win.
    for (let i = 0; i < 12; i++) {
      const r = recordContracts(p, week, job({ stars: 3, underPar: true, daily: true }));
      p = r.progress;
      finished += r.finished.length;
      paid += r.finished.reduce((sum, c) => sum + c.reward, 0);
    }
    expect(finished).toBe(CONTRACTS_PER_WEEK);
    expect(p.wallet.balance).toBe(paid);
    expect(p.wallet.earned).toBe(paid); // earned by playing: it counts toward the rank
    for (const c of goals) expect(p.contracts.counts[c.kind]).toBe(c.goal);
    expect(p.contracts.kinds).toEqual(kinds);
    expect(advanceContracts(p.contracts, '2026-W43', 0, job()).progress.week).toBe('2026-W43');
  });

  it('does not move a contract for a job that is not fresh, however often it is replayed', () => {
    let p = emptyProgress();
    for (let i = 0; i < 12; i++) p = recordContracts(p, '2026-W42', job({ counts: false, stars: 3, underPar: true })).progress;
    expect(Object.values(p.contracts.counts).every((n) => n === 0)).toBe(true);
    expect(p.wallet.balance).toBe(0);
  });

  it('does not count failed jobs', () => {
    const { progress, finished } = advanceContracts(NO_CONTRACTS, '2026-W42', 0, job({ cleared: false, stars: 0 }));
    expect(finished).toEqual([]);
    expect(Object.values(progress.counts).every((n) => n === 0)).toBe(true);
  });

  it('survives a save, and drops a damaged contract record', () => {
    const p = recordContracts(emptyProgress(), '2026-W42', job()).progress;
    const parsed = parseProgress(JSON.parse(JSON.stringify(p)));
    expect(parsed.ok && parsed.value.contracts).toEqual(p.contracts);
    const bad = parseProgress({ ...JSON.parse(JSON.stringify(p)), contracts: { week: 'soon', kinds: ['clear'], counts: { clear: 2 } } });
    expect(bad.ok && bad.value.contracts).toEqual(NO_CONTRACTS);
    const odd = parseProgress({ ...JSON.parse(JSON.stringify(p)), contracts: { week: '2026-W42', kinds: ['clear', 'hack', 'clear'], counts: { clear: -3 } } });
    expect(odd.ok && odd.value.contracts).toEqual({ week: '2026-W42', kinds: ['clear'], counts: { clear: 0 } });
  });
});
