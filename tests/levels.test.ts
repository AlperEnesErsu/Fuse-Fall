import { describe, expect, it } from 'vitest';
import { WORLD, type LevelDefinition } from '../src/core/level';
import { levelsOf } from '../src/core/progress';
import { LevelSession } from '../src/core/session';
import { TUNING } from '../src/core/tuning';
import { loadCampaign } from '../src/content/levels';
import { MatterPhysicsWorld } from '../src/infrastructure/matter-physics';
import { playSolution } from './play';

/**
 * Production-boundary tests: real level data, real Matter.js physics.
 * Proves every shipped level stands on its own and can be won.
 */
const campaign = loadCampaign();
const levels = campaign.levels;
const STEP = 1 / 60;
const cases = levels.map((l) => [l.id, l] as const);

const variant = (id: string, change: (c: LevelDefinition['solution']['charges'][number]) => LevelDefinition['solution']['charges'][number]) => {
  const level = levels.find((l) => l.id === id);
  if (!level) throw new Error(`no ${id}`);
  return playSolution(level, level.solution.fireAt, level.solution.charges.map(change)).result?.cleared;
};

describe('campaign content', () => {
  it('ships ten ordered levels for each playable city', () => {
    for (const world of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(levelsOf(campaign, world).map((l) => l.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
  });

  it.each(cases)('%s stands still until fired', (_id, level) => {
    const physics = new MatterPhysicsWorld();
    physics.add({
      id: 'ground',
      shape: { kind: 'rect', w: 2000, h: 120 },
      position: { x: WORLD.width / 2, y: WORLD.groundY + 60 },
      angle: 0,
      material: 'concrete',
      isStatic: true,
    });
    level.blocks.forEach((b, i) =>
      physics.add({
        id: `b${i}`,
        shape: { kind: 'rect', w: b.w, h: b.h },
        position: { x: b.x, y: b.y },
        angle: b.angle,
        material: b.material,
        isStatic: b.anchored,
      }),
    );
    for (let t = 0; t < 4; t += STEP) physics.step(STEP);
    level.blocks.forEach((b, i) => {
      const s = physics.state(`b${i}`);
      if (!s) throw new Error(`${level.id} block ${i} vanished`);
      expect(Math.hypot(s.position.x - b.x, s.position.y - b.y), `${level.id} block ${i} drift`).toBeLessThan(3);
    });
  });

  // The daily mission allows only par charges, so every solution must fit within par.
  it.each(cases)('%s is solvable within par', (_id, level) => {
    expect(level.solution.charges.length).toBeLessThanOrEqual(level.charges.par);
  });

  // Replays re-simulate the same attempt, so physics must be deterministic.
  it.each(cases.filter(([, l]) => ['w1-10', 'w2-10', 'w3-08'].includes(l.id)))('%s replays identically', (_id, level) => {
    const snapshot = (s: LevelSession) =>
      [...s.view()].map((e) => `${e.id}:${e.state.position.x.toFixed(3)},${e.state.position.y.toFixed(3)}`).join('|');
    const a = playSolution(level);
    const b = playSolution(level);
    expect(snapshot(b)).toBe(snapshot(a));
    expect(b.result).toEqual(a.result);
  });

  it.each(cases)('%s is won by its solution', (_id, level) => {
    const session = playSolution(level);
    expect(session.phase).toBe('finished');
    expect(session.result?.cleared, JSON.stringify(session.result)).toBe(true);
  });

  // Timing must matter on car levels: firing at the start with the same placement should not win.
  // (One-way traffic loops forever, so "too early" there is a delay question, covered below.)
  it.each(cases.filter(([, l]) => l.cars.some((c) => c.target && c.mode === 'patrol') && l.solution.fireAt > 0))(
    '%s needs good timing',
    (_id, level) => {
      expect(playSolution(level, 0).result?.cleared).toBe(false);
    },
  );

  // Timeline puzzles: the same placement with the default delay sequence must not win.
  it.each(
    cases.filter(([, l]) =>
      l.solution.charges.some((c, i) => c.delay !== undefined && Math.abs(c.delay - i * TUNING.charge.delay.defaultStep) > 0.1),
    ),
  )('%s needs the delay timeline', (_id, level) => {
    const defaults = level.solution.charges.map((c) => ({ ...c, delay: undefined }));
    expect(playSolution(level, level.solution.fireAt, defaults).result?.cleared).toBe(false);
  });

  // The implosion tutorial's placement must actually win the job it teaches on.
  it('w4-03 is won by the implosion tutorial placement', () => {
    const level = levels.find((l) => l.id === 'w4-03');
    if (!level) throw new Error('missing w4-03');
    const result = playSolution(level, 0, [{ x: 490, y: 410, delay: undefined, kind: 'implosion' }]).result;
    expect(result?.cleared, JSON.stringify(result)).toBe(true);
  });

  // Precision puzzles: the same placement with standard charges must not win.
  // w4-05 is forgiving since the tolerances were loosened: either charge type works there.
  it.each(cases.filter(([, l]) => l.solution.charges.some((c) => c.kind === 'precision') && l.id !== 'w4-05' && !l.charges.stock))(
    '%s needs precision charges',
    (_id, level) => {
      const standard = level.solution.charges.map((c) => ({ ...c, kind: 'standard' as const }));
      expect(playSolution(level, level.solution.fireAt, standard).result?.cleared).toBe(false);
    },
  );

  // Wrecking ball puzzles: letting the crane go is not enough; the rope cut or the charge is the point.
  it.each(cases.filter(([, l]) => ['w7-02', 'w7-05', 'w7-07', 'w7-09', 'w7-10'].includes(l.id)))(
    '%s needs more than letting the crane go',
    (_id, level) => {
      expect(playSolution(level, level.solution.fireAt, []).result?.cleared).toBe(false);
    },
  );

  // Madrid trams: the moment of firing is the puzzle. The same placement a little late misses the tram.
  // (Patrol jobs are also covered by "needs good timing"; this adds the one-way lines and the crane.)
  it.each([
    ['w8-01', 1],
    ['w8-02', 1],
    ['w8-03', 1],
    ['w8-04', 1],
    ['w8-05', 2],
    ['w8-06', 1],
    ['w8-07', 1],
    ['w8-08', 2],
    ['w8-09', 1],
    ['w8-10', 1],
  ] as const)('%s needs good timing on the tram', (id, late) => {
    const level = levels.find((l) => l.id === id);
    if (!level) throw new Error(`missing ${id}`);
    const result = playSolution(level, level.solution.fireAt + late).result;
    expect(result?.cleared, JSON.stringify(result)).toBe(false);
  });

  // Rail vehicles keep to their track: a tram hit hard enough is wrecked where it stands, never thrown.
  it('w8-01 wrecks the tram on its rails', () => {
    const level = levels.find((l) => l.id === 'w8-01');
    if (!level) throw new Error('missing w8-01');
    const session = playSolution(level);
    const tram = [...session.view()].find((e) => e.car?.style === 'tram');
    expect(tram?.car?.wrecked).toBe(true);
    expect(tram?.state.position.y).toBeCloseTo(level.cars[0]?.y ?? 0, 5);
  });

  // Detonator puzzles: left to their fuses, the same falling bombs do not win.
  it.each(cases.filter(([, l]) => ['w6-02', 'w6-04', 'w6-05', 'w6-08', 'w6-10'].includes(l.id)))('%s needs the detonator', (_id, level) => {
    expect(playSolution(level, level.solution.fireAt, level.solution.charges, []).result?.cleared).toBe(false);
  });

  // Train-window puzzles: with the train overhead, the same placement voids the contract.
  it.each(cases.filter(([, l]) => ['w5-01', 'w5-02', 'w5-04', 'w5-07', 'w5-10'].includes(l.id)))(
    '%s needs the train window',
    (_id, level) => {
      const outcomes = Array.from({ length: 24 }, (_, i) => playSolution(level, i * 0.25).result?.failure);
      expect(outcomes).toContain('collateral-damage');
    },
  );

  // Protected-building puzzles: a placement on the wrong side whose blast core reaches the neighbour breaks the contract.
  it.each([
    ['w1-06', { x: 580, y: 470, delay: undefined, kind: 'standard' }],
    ['w2-02', { x: 480, y: 470, delay: undefined, kind: 'standard' }],
  ] as const)('%s breaks the contract from the wrong side', (id, wrong) => {
    const level = levels.find((l) => l.id === id);
    if (!level) throw new Error(`missing ${id}`);
    const result = playSolution(level, 0, [wrong]).result;
    expect(result?.failure, JSON.stringify(result)).toBe('collateral-damage');
  });
});

describe('New York: rolling charges and loadouts', () => {
  // A cart is the point: the same spots with standard charges do not clear the job.
  it.each(['w9-01', 'w9-02', 'w9-05', 'w9-06', 'w9-10'])('%s needs the rolling charge', (id) => {
    expect(variant(id, (c) => (c.kind === 'roller' ? { ...c, kind: 'standard' } : c))).toBe(false);
  });

  it('w9-08 needs both carts', () => {
    const level = levels.find((l) => l.id === 'w9-08');
    if (!level) throw new Error('no w9-08');
    expect(playSolution(level, 0, level.solution.charges.slice(0, 1)).result?.cleared).toBe(false);
  });

  it.each([
    ['w9-07', 'precision'],
    ['w9-10', 'implosion'],
  ] as const)('%s needs its %s charge', (id, kind) => {
    expect(variant(id, (c) => (c.kind === kind ? { ...c, kind: 'standard' } : c))).toBe(false);
  });
});
