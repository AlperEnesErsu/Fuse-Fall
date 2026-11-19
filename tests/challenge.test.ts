import { describe, expect, it } from 'vitest';
import { challengeOf, judgeChallenge, parseChallenge } from '../src/core/challenge';
import { scoreLevel, type LevelOutcome } from '../src/core/scoring';

const outcome: LevelOutcome = {
  targetsDown: 1,
  targetsTotal: 1,
  chargesUsed: 2,
  chargesMax: 3,
  blocksCollapsed: 8,
  blocksTotal: 10,
  protectedTotal: 0,
  protectedDamaged: 0,
  duration: 4.04,
  footprint: undefined,
  barrels: { blown: 0, total: 0 },
  dominoes: 0,
  demolished: {},
};
const rules = { par: 2, bonusCollapse: 0.5 };
const result = (patch: Partial<LevelOutcome> = {}) => scoreLevel({ ...outcome, ...patch }, rules);

describe('a challenge in a mission code', () => {
  it('carries what a won job did, rounded the way it is shown', () => {
    expect(challengeOf(result())).toEqual({ charges: 2, collapse: 80, seconds: 4 });
  });

  it('is beaten by fewer charges first, then more brought down, then a quicker finish', () => {
    const theirs = challengeOf(result());
    expect(judgeChallenge(theirs, result({ chargesUsed: 1, blocksCollapsed: 2, duration: 9 }))).toBe('beaten');
    expect(judgeChallenge(theirs, result({ chargesUsed: 3, blocksCollapsed: 10 }))).toBe('missed');
    expect(judgeChallenge(theirs, result({ blocksCollapsed: 9 }))).toBe('beaten');
    expect(judgeChallenge(theirs, result({ blocksCollapsed: 7, duration: 1 }))).toBe('missed');
    expect(judgeChallenge(theirs, result({ duration: 3.5 }))).toBe('beaten');
    expect(judgeChallenge(theirs, result({ duration: 4.3 }))).toBe('missed');
    expect(judgeChallenge(theirs, result())).toBe('tied');
  });

  it('is never beaten by a failed job, however good it looked', () => {
    expect(judgeChallenge(challengeOf(result()), result({ targetsDown: 0, chargesUsed: 1 }))).toBe('missed');
  });

  it('reads only sensible numbers from a pasted code', () => {
    expect(parseChallenge({ charges: 1, collapse: 92, seconds: 3.44 }, 3)).toEqual({ charges: 1, collapse: 92, seconds: 3.4 });
    for (const bad of [undefined, null, 'x', [], { charges: 4, collapse: 50, seconds: 3 }, { charges: 1.5, collapse: 50, seconds: 3 }, { charges: 1, collapse: 101, seconds: 3 }, { charges: 1, collapse: 50, seconds: -1 }, { charges: 1, collapse: 50, seconds: Infinity }, { charges: 1, collapse: 50 }])
      expect(parseChallenge(bad, 3), JSON.stringify(bad)).toBeUndefined();
  });
});
