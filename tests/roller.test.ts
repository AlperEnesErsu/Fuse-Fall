import { describe, expect, it } from 'vitest';
import { EventBus, type GameEvents } from '../src/core/events';
import { parseLevel, type LevelDefinition } from '../src/core/level';
import { LevelSession } from '../src/core/session';
import { MatterPhysicsWorld } from '../src/infrastructure/matter-physics';

const STEP = 1 / 60;

/** A wooden tower at x 700, a ground zone far to its left: only something that travels can reach it. */
const level = (extra: Record<string, unknown> = {}): LevelDefinition => {
  const parsed = parseLevel({
    id: 'w9-test',
    name: 'Roller test',
    world: 9,
    order: 1,
    charges: { max: 2, par: 1 },
    bonusCollapse: 0.5,
    chargeKinds: ['standard', 'roller'],
    zones: [{ x: 120, y: 440, w: 120, h: 40 }],
    blocks: [
      { x: 690, y: 430, w: 16, h: 80, material: 'wood' },
      { x: 720, y: 430, w: 16, h: 80, material: 'wood' },
      { x: 705, y: 382, w: 60, h: 14, material: 'wood' },
      { x: 705, y: 362, w: 26, h: 26, material: 'wood', target: true },
    ],
    solution: { charges: [{ x: 180, y: 462, kind: 'roller' }] },
    ...extra,
  });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
  return parsed.value;
};

const run = (s: LevelSession, events: string[] = []) => {
  for (let k = 0; k < 20 / STEP && s.phase !== 'finished'; k++) s.step(STEP);
  return events;
};

describe('rolling charge', () => {
  it('drives to the structure, goes off against it and brings the target down', () => {
    const bus = new EventBus<GameEvents>();
    const blasts: { x: number }[] = [];
    bus.on('explosion', (e) => blasts.push({ x: e.position.x }));
    const s = new LevelSession(level(), new MatterPhysicsWorld(), bus);
    const placed = s.placeCharge({ x: 180, y: 462 }, undefined, 'roller');
    expect(placed.ok && placed.value.direction).toBe(1); // faces the targets by itself
    expect(s.fire().ok).toBe(true);
    run(s);
    expect(blasts[0]?.x).toBeGreaterThan(600); // it went off at the tower, not where it was set
    expect(s.result?.cleared).toBe(true);
  });

  it('turned the other way, it drives off and the tower stands', () => {
    const s = new LevelSession(level(), new MatterPhysicsWorld(), new EventBus<GameEvents>());
    const placed = s.placeCharge({ x: 180, y: 462 }, undefined, 'roller');
    if (!placed.ok) throw new Error(placed.error);
    expect(s.flipCharge(placed.value.id).ok && s.charges[0]?.direction).toBe(-1);
    s.fire();
    run(s);
    expect(s.result?.cleared).toBe(false);
  });

  it('a standard charge in the same spot cannot reach', () => {
    const s = new LevelSession(level(), new MatterPhysicsWorld(), new EventBus<GameEvents>());
    s.placeCharge({ x: 180, y: 462 });
    s.fire();
    run(s);
    expect(s.result?.cleared).toBe(false);
  });
});

describe('loadouts', () => {
  it('hands out each kind by its own count', () => {
    const s = new LevelSession(level({ charges: { max: 2, par: 1, stock: { standard: 1, roller: 1 } } }), new MatterPhysicsWorld(), new EventBus<GameEvents>());
    expect(s.stockLeft('roller')).toBe(1);
    expect(s.placeCharge({ x: 140, y: 462 }, undefined, 'roller').ok).toBe(true);
    expect(s.placeCharge({ x: 200, y: 462 }, undefined, 'roller')).toEqual({ ok: false, error: 'no-charges-left' });
    expect(s.placeCharge({ x: 200, y: 462 }).ok).toBe(true);
    expect(s.stockLeft('standard')).toBe(0);
  });

  it('rejects a loadout that does not add up, or a solution that breaks it', () => {
    expect(() => level({ charges: { max: 2, par: 1, stock: { standard: 1 } } })).toThrow(/add up/);
    expect(() => level({ charges: { max: 2, par: 1, stock: { standard: 2 } } })).toThrow(/stock has 0/);
    expect(() => level({ charges: { max: 2, par: 1, stock: { implosion: 2 } } })).toThrow(/chargeKinds/);
  });
});
