import { writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { difficultyOf } from '../src/core/difficulty';
import type { LevelDefinition } from '../src/core/level';
import { loadCampaign } from '../src/content/levels';
import { playSolution } from './play';

/**
 * Balance probe, off by default: `BALANCE=out.json npx vitest run tests/level-balance.test.ts`.
 * Replays each level's solution with small mistakes a player would make (a charge
 * 10–20 px off, a delay or a press a tenth of a second off) and records how many
 * still clear the job. See docs/level-balance.md.
 */
type Charge = LevelDefinition['solution']['charges'][number];
type Plan = { fireAt: number; charges: readonly Charge[]; detonateAt: readonly number[] };
type Kind = 'place' | 'time' | 'wide';

// Near mistakes (10–20 px, 0.1–0.2 s) are the measure; wide ones (30–40 px, 0.3–0.4 s) separate the forgiving from the merely fair.
const OFFSETS: readonly [number, number, Kind][] = [
  ...[-20, -15, -10, -5, 0, 5, 10, 15, 20].flatMap((dx) =>
    [-15, -8, 0, 8, 15].map((dy): [number, number, Kind] => [dx, dy, 'place']),
  ),
  ...[-40, -30, 30, 40].map((dx): [number, number, Kind] => [dx, 0, 'wide']),
].filter(([dx, dy]) => dx !== 0 || dy !== 0);
const NUDGES: readonly [number, Kind][] = [
  [-0.2, 'time'],
  [-0.1, 'time'],
  [0.1, 'time'],
  [0.2, 'time'],
  [-0.4, 'wide'],
  [-0.3, 'wide'],
  [0.3, 'wide'],
  [0.4, 'wide'],
];

const variants = (level: LevelDefinition): { kind: Kind; plan: Plan }[] => {
  const base: Plan = {
    fireAt: level.solution.fireAt,
    charges: level.solution.charges,
    detonateAt: level.solution.detonateAt,
  };
  const out: { kind: Kind; plan: Plan }[] = [];
  const swap = (i: number, c: Charge) => base.charges.map((o, k) => (k === i ? c : o));
  base.charges.forEach((c, i) => {
    for (const [dx, dy, kind] of OFFSETS)
      out.push({ kind, plan: { ...base, charges: swap(i, { ...c, x: c.x + dx, y: c.y + dy }) } });
    // A delay only matters once there is something to time it against.
    if (c.delay !== undefined && (c.delay > 0 || base.charges.length > 1))
      for (const [n, kind] of NUDGES)
        if (c.delay + n >= 0)
          out.push({ kind, plan: { ...base, charges: swap(i, { ...c, delay: c.delay + n }) } });
  });
  if (base.fireAt > 0)
    for (const [n, kind] of NUDGES)
      if (base.fireAt + n >= 0) out.push({ kind, plan: { ...base, fireAt: base.fireAt + n } });
  base.detonateAt.forEach((t, i) => {
    for (const [n, kind] of NUDGES)
      out.push({
        kind,
        plan: { ...base, detonateAt: base.detonateAt.map((o, k) => (k === i ? t + n : o)) },
      });
  });
  return out;
};

const out = process.env.BALANCE;

describe.skipIf(!out)('level balance probe', () => {
  it('measures every level', { timeout: 3_600_000 }, () => {
    const only = process.env.BALANCE_ONLY?.split(',');
    const rows = loadCampaign()
      .levels.filter((l) => !only || only.includes(l.id))
      .map((level) => {
        // [cleared, played] per kind of mistake.
        const tally: Record<Kind, [number, number]> = { place: [0, 0], time: [0, 0], wide: [0, 0] };
        let rejected = 0;
        for (const v of variants(level)) {
          let cleared: boolean;
          try {
            cleared =
              playSolution(level, v.plan.fireAt, v.plan.charges, v.plan.detonateAt).result
                ?.cleared === true;
          } catch {
            rejected++; // outside the zone or too close: not a move a player can make
            continue;
          }
          const t = tally[v.kind];
          t[1]++;
          if (cleared) t[0]++;
        }
        const base = playSolution(level).result?.cleared === true;
        const row = {
          id: level.id,
          name: level.name,
          difficulty: difficultyOf(level),
          charges: level.solution.charges.length,
          par: level.charges.par,
          blocks: level.blocks.filter((b) => !b.anchored && !b.protected).length,
          base,
          place: tally.place,
          time: tally.time,
          wide: tally.wide,
          rejected,
        };
        console.log(JSON.stringify(row));
        return row;
      });
    writeFileSync(out ?? '', JSON.stringify(rows, null, 1));
  });
});
