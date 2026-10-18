import { describe, expect, it } from 'vitest';
import { EventBus, type GameEvents } from '../src/core/events';
import { parseLevel, type LevelDefinition } from '../src/core/level';
import { LevelSession } from '../src/core/session';
import { MatterPhysicsWorld } from '../src/infrastructure/matter-physics';

const STEP = 1 / 60;

/** A protected building left of the charge zone, and a tower to the right. */
const level = (): LevelDefinition => {
  const parsed = parseLevel({
    id: 'w9-dir',
    name: 'Directional test',
    world: 9,
    order: 1,
    charges: { max: 1, par: 1 },
    bonusCollapse: 0.5,
    chargeKinds: ['standard', 'directional'],
    zones: [{ x: 280, y: 440, w: 60, h: 50 }],
    blocks: [
      { x: 215, y: 440, w: 40, h: 80, material: 'concrete', protected: true },
      { x: 560, y: 380, w: 16, h: 80, material: 'wood', target: true },
    ],
    solution: { charges: [{ x: 300, y: 470 }] },
  });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
  return parsed.value;
};

/** Places one charge of `kind` facing `direction`, fires, and returns the settled session. */
const shoot = (kind: 'standard' | 'directional', direction: 1 | -1 = 1): LevelSession => {
  const s = new LevelSession(level(), new MatterPhysicsWorld(), new EventBus<GameEvents>());
  const placed = s.placeCharge({ x: 300, y: 470 }, undefined, kind, direction);
  if (!placed.ok) throw new Error(placed.error);
  s.fire();
  for (let k = 0; k < 20 / STEP && s.phase !== 'finished'; k++) s.step(STEP);
  return s;
};

describe('directional charge', () => {
  it('leaves a protected building behind it alone', () => {
    const s = shoot('directional', 1);
    expect(s.result?.failure).not.toBe('collateral-damage');
  });

  it('damages the same building when turned to face it', () => {
    const s = shoot('directional', -1);
    expect(s.result?.failure).toBe('collateral-damage');
  });

  it('a standard charge in the same spot damages it either way', () => {
    expect(shoot('standard').result?.failure).toBe('collateral-damage');
  });

  it('reports protection only for buildings in front of it', () => {
    const s = new LevelSession(level(), new MatterPhysicsWorld(), new EventBus<GameEvents>());
    const center = { x: 300, y: 470 };
    expect(s.protectedReachedFrom(center, 'directional', 1)).toEqual([]);
    expect(s.protectedReachedFrom(center, 'directional', -1)).toHaveLength(1);
    expect(s.protectedReachedFrom(center, 'standard')).toHaveLength(1);
  });

  it('can be turned after placing, and flipCharge changes its aim', () => {
    const s = new LevelSession(level(), new MatterPhysicsWorld(), new EventBus<GameEvents>());
    const placed = s.placeCharge({ x: 300, y: 470 }, undefined, 'directional', 1);
    if (!placed.ok) throw new Error(placed.error);
    expect(s.flipCharge(placed.value.id).ok && s.charges[0]?.direction).toBe(-1);
  });
});
