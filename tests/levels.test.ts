import { describe, expect, it } from 'vitest';
import { EventBus, type GameEvents } from '../src/core/events';
import { WORLD, type LevelDefinition } from '../src/core/level';
import { levelsOf } from '../src/core/progress';
import { LevelSession } from '../src/core/session';
import { loadCampaign } from '../src/content/levels';
import { MatterPhysicsWorld } from '../src/infrastructure/matter-physics';

/**
 * Production-boundary tests: real level data, real Matter.js physics.
 * Proves every shipped level stands on its own and can be won.
 */
const campaign = loadCampaign();
const levels = campaign.levels;
const STEP = 1 / 60;
const cases = levels.map((l) => [l.id, l] as const);

/** Plays the level's recorded solution the way a player would: place, wait, fire. */
export const playSolution = (
  level: LevelDefinition,
  fireAt = level.solution.fireAt,
  charges = level.solution.charges,
): LevelSession => {
  const session = new LevelSession(level, new MatterPhysicsWorld(), new EventBus<GameEvents>());
  for (const p of charges) {
    const placed = session.placeCharge(p);
    if (!placed.ok) throw new Error(`${level.id}: solution charge rejected (${placed.error})`);
  }
  for (let t = 0; t + STEP / 2 < fireAt; t += STEP) session.step(STEP);
  expect(session.fire().ok).toBe(true);
  for (let t = 0; t < 20 && session.phase !== 'finished'; t += STEP) session.step(STEP);
  return session;
};

describe('campaign content', () => {
  it('ships ten ordered levels for each playable city', () => {
    for (const world of [1, 2]) {
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
        isStatic: false,
      }),
    );
    for (let t = 0; t < 4; t += STEP) physics.step(STEP);
    level.blocks.forEach((b, i) => {
      const s = physics.state(`b${i}`);
      if (!s) throw new Error(`${level.id} block ${i} vanished`);
      expect(Math.hypot(s.position.x - b.x, s.position.y - b.y), `${level.id} block ${i} drift`).toBeLessThan(3);
    });
  });

  it.each(cases)('%s is won by its solution', (_id, level) => {
    const session = playSolution(level);
    expect(session.phase).toBe('finished');
    expect(session.result?.success, JSON.stringify(session.result)).toBe(true);
  });

  // Timing must matter on car levels: firing at the start with the same placement should not win.
  it.each(cases.filter(([, l]) => l.cars.some((c) => c.target) && l.solution.fireAt > 0))(
    '%s needs good timing',
    (_id, level) => {
      expect(playSolution(level, 0).result?.success).toBe(false);
    },
  );

  // Protected-building puzzles: the obvious placement on the wrong side must break the contract.
  it.each([
    ['w1-06', { x: 560, y: 470 }],
    ['w2-02', { x: 500, y: 470 }],
  ] as const)('%s breaks the contract from the wrong side', (id, wrong) => {
    const level = levels.find((l) => l.id === id);
    if (!level) throw new Error(`missing ${id}`);
    const result = playSolution(level, 0, [wrong]).result;
    expect(result?.failure, JSON.stringify(result)).toBe('collateral-damage');
  });
});
