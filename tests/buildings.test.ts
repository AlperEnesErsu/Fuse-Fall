import { describe, expect, it } from 'vitest';
import type { EntityView } from '../src/core/session';
import { planBuildings } from '../src/presentation/buildings';

const block = (id: string, x: number, y: number, w: number, h: number, extra: Partial<EntityView> = {}): EntityView =>
  ({
    id,
    kind: 'block',
    shape: { kind: 'rect', w, h },
    material: 'wood',
    target: false,
    down: false,
    downAt: undefined,
    protected: false,
    compromised: false,
    landmark: false,
    showpiece: false,
    anchored: false,
    damage: 0,
    state: { position: { x, y }, angle: 0, velocity: { x: 0, y: 0 }, angularVelocity: 0, mass: 1 },
    car: undefined,
    ...extra,
  }) as EntityView;

describe('which buildings look condemned', () => {
  it('the one holding a target and a finale showpiece, never an ordinary building', () => {
    const plan = planBuildings([
      // A post and a room on it, holding the target.
      block('a1', 100, 440, 20, 80),
      block('a2', 100, 380, 40, 40, { target: true }),
      // A showpiece: no target, condemned all the same.
      block('b1', 400, 440, 60, 80, { showpiece: true }),
      block('b2', 400, 380, 60, 40, { showpiece: true }),
      // An ordinary building: lit windows, no tape.
      block('c1', 700, 440, 60, 80),
    ]);
    expect(plan.get('a1')?.condemned).toBe(true);
    expect(plan.get('b1')?.condemned).toBe(true);
    expect(plan.get('b2')?.condemned).toBe(true);
    expect(plan.get('c1')?.condemned).toBe(false);
  });
});
