import { describe, expect, it } from 'vitest';
import { EventBus, type GameEvents } from '../src/core/events';
import { WORLD, type LevelDefinition } from '../src/core/level';
import { LevelSession } from '../src/core/session';
import { TUNING } from '../src/core/tuning';
import { FakePhysics } from './fake-physics';

const level = (patch: Partial<LevelDefinition> = {}): LevelDefinition => ({
  id: 'test',
  name: 'Test',
  world: 1,
  order: 1,
  hint: undefined,
  charges: { max: 2, par: 1 },
  bonusCollapse: 0.5,
  zones: [{ x: 0, y: 400, w: 300, h: 80 }],
  blocks: [
    { x: 500, y: 300, w: 40, h: 40, angle: 0, material: 'wood', target: true, protected: false, anchored: false },
    { x: 700, y: 455, w: 40, h: 50, angle: 0, material: 'concrete', target: false, protected: false, anchored: false },
  ],
  barrels: [],
  cars: [],
  solution: { charges: [{ x: 100, y: 450, delay: undefined }], fireAt: 0 },
  ...patch,
});

const setup = (patch?: Partial<LevelDefinition>) => {
  const physics = new FakePhysics();
  const events = new EventBus<GameEvents>();
  const log: { type: keyof GameEvents; payload: unknown }[] = [];
  for (const type of ['explosion', 'blockShattered', 'targetDown', 'levelFinished', 'chargePlaced'] as const) {
    events.on(type, (payload) => log.push({ type, payload }));
  }
  const session = new LevelSession(level(patch), physics, events);
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += 1 / 60) session.step(1 / 60);
  };
  return { physics, session, events, log, run };
};

describe('placement', () => {
  it('accepts charges only inside zones', () => {
    const { session } = setup();
    expect(session.placeCharge({ x: 100, y: 450 }).ok).toBe(true);
    expect(session.placeCharge({ x: 600, y: 450 })).toEqual({ ok: false, error: 'outside-zone' });
  });

  it('enforces spacing and the charge limit', () => {
    const { session } = setup();
    session.placeCharge({ x: 100, y: 450 });
    expect(session.placeCharge({ x: 105, y: 450 })).toEqual({ ok: false, error: 'too-close' });
    session.placeCharge({ x: 200, y: 450 });
    expect(session.placeCharge({ x: 250, y: 450 })).toEqual({ ok: false, error: 'no-charges-left' });
  });

  it('moves and removes charges while placing', () => {
    const { session } = setup();
    const placed = session.placeCharge({ x: 100, y: 450 });
    if (!placed.ok) throw new Error('placement failed');
    expect(session.moveCharge(placed.value.id, { x: 600, y: 450 }).ok).toBe(false);
    expect(session.moveCharge(placed.value.id, { x: 150, y: 450 }).ok).toBe(true);
    expect(session.chargeAt({ x: 152, y: 448 })?.id).toBe(placed.value.id);
    session.removeCharge(placed.value.id);
    expect(session.charges).toHaveLength(0);
  });

  it('gives new charges the next delay step, and lets the player retime them', () => {
    const { session } = setup();
    const a = session.placeCharge({ x: 100, y: 450 });
    const b = session.placeCharge({ x: 200, y: 450 });
    if (!a.ok || !b.ok) throw new Error('placement failed');
    expect([a.value.delay, b.value.delay]).toEqual([0, TUNING.charge.delay.defaultStep]);
    expect(session.setChargeDelay(b.value.id, 0.123).ok && session.charges[1]?.delay).toBeCloseTo(0.1);
    expect(session.setChargeDelay(b.value.id, 9).ok && session.charges[1]?.delay).toBe(TUNING.charge.delay.max);
    expect(session.setChargeDelay(99, 0)).toEqual({ ok: false, error: 'unknown-charge' });
    expect(session.moveCharge(b.value.id, { x: 250, y: 450 }).ok && session.charges[1]?.delay).toBe(2);
  });

  it('detonates by delay, not by placement order', () => {
    const { session, log, run } = setup();
    session.placeCharge({ x: 100, y: 450 }, 0.5);
    session.placeCharge({ x: 200, y: 450 }, 0);
    session.fire();
    run(0.1);
    const first = log.filter((e) => e.type === 'explosion').map((e) => (e.payload as { position: { x: number } }).position.x);
    expect(first).toEqual([200]);
    run(0.5);
    expect(log.filter((e) => e.type === 'explosion')).toHaveLength(2);
    expect(() => session.setChargeDelay(1, 0)).not.toThrow();
    expect(session.setChargeDelay(1, 0)).toEqual({ ok: false, error: 'not-placing' });
  });

  it('cannot fire without charges, and freezes placement after firing', () => {
    const { session } = setup();
    expect(session.fire()).toEqual({ ok: false, error: 'no-charges' });
    session.placeCharge({ x: 100, y: 450 });
    expect(session.fire().ok).toBe(true);
    expect(session.placeCharge({ x: 200, y: 450 })).toEqual({ ok: false, error: 'not-placing' });
  });
});

describe('detonation', () => {
  it('fires charges in order, one fuse delay apart', () => {
    const { session, log, run } = setup();
    session.placeCharge({ x: 100, y: 450 });
    session.placeCharge({ x: 200, y: 450 });
    session.fire();
    run(1 / 60);
    expect(log.filter((e) => e.type === 'explosion')).toHaveLength(1);
    run(TUNING.charge.delay.defaultStep);
    expect(log.filter((e) => e.type === 'explosion')).toHaveLength(2);
  });

  it('pushes nearby bodies away and up, and leaves distant ones alone', () => {
    const { session, physics, run } = setup({ zones: [{ x: 400, y: 300, w: 200, h: 180 }] });
    session.placeCharge({ x: 460, y: 330 });
    session.fire();
    run(1 / 60);
    const target = physics.kicks.find((k) => k.id === 'block-1');
    expect(target?.dv.x).toBeGreaterThan(0);
    expect(target?.dv.y).toBeLessThan(0);
    expect(physics.kicks.find((k) => k.id === 'block-2')).toBeUndefined();
  });

  it('shatters a block whose damage exceeds its strength into debris', () => {
    const { session, physics, log, run } = setup({ zones: [{ x: 400, y: 300, w: 200, h: 180 }] });
    session.placeCharge({ x: 500, y: 330 });
    session.fire();
    run(1 / 60);
    expect(log.some((e) => e.type === 'blockShattered')).toBe(true);
    expect(physics.state('block-1')).toBeUndefined();
    expect(physics.idsOf('debris-')).toHaveLength(3); // wood splits 3×1
    // A shattered target counts as down.
    expect(session.targetsRemaining).toBe(0);
  });

  it('sets off barrels in a chain', () => {
    const { session, log, run } = setup({ barrels: [{ x: 240, y: 464 }] });
    session.placeCharge({ x: 150, y: 450 });
    session.fire();
    run(TUNING.barrel.delay + 0.05);
    const sources = log.filter((e) => e.type === 'explosion').map((e) => (e.payload as { source: string }).source);
    expect(sources).toEqual(['charge', 'barrel']);
  });

  it('damages blocks on hard impacts', () => {
    const { session, physics, log, run } = setup();
    session.placeCharge({ x: 100, y: 450 });
    session.fire();
    physics.pendingImpacts = [{ a: 'block-2', b: 'ground', speed: 3000, point: { x: 700, y: 480 } }];
    run(1 / 60);
    expect(log.some((e) => e.type === 'blockShattered')).toBe(true);
  });
});

describe('outcome', () => {
  it('counts a target as down when it reaches the ground and scores at settle', () => {
    const { session, physics, log, run } = setup();
    session.placeCharge({ x: 100, y: 450 });
    session.fire();
    physics.place('block-1', { position: { x: 520, y: WORLD.groundY - 20 } });
    run(TUNING.settle.hold + 0.2);
    expect(log.some((e) => e.type === 'targetDown')).toBe(true);
    expect(session.phase).toBe('finished');
    expect(session.result).toMatchObject({ success: true, chargesUsed: 1, blocksCollapsed: 1, stars: 3 });
  });

  it('fails when the target is still standing', () => {
    const { session, run } = setup();
    session.placeCharge({ x: 100, y: 450 });
    session.fire();
    run(TUNING.settle.hold + 0.2);
    expect(session.result).toMatchObject({ success: false, stars: 0 });
  });

  it('waits for motion to stop, but not past the timeout', () => {
    const { session, physics, run } = setup();
    session.placeCharge({ x: 100, y: 450 });
    session.fire();
    physics.place('block-2', { velocity: { x: 50, y: 0 } });
    run(TUNING.settle.hold + 0.2);
    expect(session.phase).toBe('running');
    run(TUNING.settle.timeout);
    expect(session.phase).toBe('finished');
  });

  it('removes bodies that leave the world and counts lost targets as down', () => {
    const { session, physics, run } = setup();
    session.placeCharge({ x: 100, y: 450 });
    session.fire();
    physics.place('block-1', { position: { x: WORLD.width + 400, y: 300 } });
    run(1 / 60);
    expect(physics.state('block-1')).toBeUndefined();
    expect(session.targetsRemaining).toBe(0);
  });
});

describe('cars', () => {
  const road = { x: 600, y: 300, w: 56, h: 24, from: 560, to: 700, speed: 60, target: true, mode: 'patrol' } as const;
  const carLevel = (patch: Partial<LevelDefinition> = {}) =>
    setup({ blocks: [], cars: [road], zones: [{ x: 0, y: 250, w: 960, h: 230 }], ...patch });

  it('cruise along their route while placing, bouncing at the ends', () => {
    const { session, physics, run } = carLevel();
    run(0.5);
    expect(Math.abs((physics.state('car-1')?.position.x ?? 0) - 630)).toBeLessThan(2);
    run(2);
    // 600 → 700 takes 1.67 s, then it turns back.
    expect(physics.state('car-1')?.position.x).toBeLessThan(700);
    expect(physics.state('car-1')?.velocity.x).toBeLessThan(0);
    expect(session.phase).toBe('placing');
  });

  it('in flow mode, re-enter at the start of the route instead of turning back', () => {
    const { physics, run } = carLevel({ cars: [{ ...road, mode: 'flow' }] });
    run(1.8); // 600 → 700 in 1.67 s, then back to 560 and onwards
    const s = physics.state('car-1');
    expect(s?.velocity.x).toBeGreaterThan(0);
    expect(s?.position.x).toBeLessThan(580);
  });

  it('stall when caught in a blast and are wrecked by a close one', () => {
    const { session, log, run } = carLevel();
    session.placeCharge({ x: 600, y: 300 });
    session.fire();
    run(1 / 60);
    const view = [...session.view()].find((e) => e.kind === 'car');
    expect(view?.car).toMatchObject({ driving: false, wrecked: true });
    expect(session.targetsRemaining).toBe(0);
    run(TUNING.vehicle.delay + 0.05);
    const sources = log.filter((e) => e.type === 'explosion').map((e) => (e.payload as { source: string }).source);
    expect(sources).toEqual(['charge', 'vehicle']);
  });

  it('keep driving when the blast misses, and the level still settles', () => {
    const { session, run } = carLevel();
    session.placeCharge({ x: 100, y: 450 });
    session.fire();
    run(TUNING.settle.hold + 0.3);
    expect(session.phase).toBe('finished');
    expect(session.result?.success).toBe(false);
  });
});

describe('protected buildings', () => {
  const house = { x: 860, y: 450, w: 60, h: 60, angle: 0, material: 'concrete', target: false, protected: true, anchored: false } as const;

  it('do not count toward the collapse ratio', () => {
    const { session, physics, run } = setup({ blocks: [...level().blocks, house] });
    session.placeCharge({ x: 100, y: 450 });
    session.fire();
    physics.place('block-1', { position: { x: 520, y: WORLD.groundY - 20 } });
    run(TUNING.settle.hold + 0.2);
    expect(session.result).toMatchObject({ success: true, blocksTotal: 2, protectedTotal: 1, protectedDamaged: 0 });
  });

  it('fail the job when knocked over, and report it once', () => {
    const { session, physics, events, log, run } = setup({ blocks: [...level().blocks, house] });
    const seen: unknown[] = [];
    events.on('protectedDamaged', (e) => seen.push(e));
    session.placeCharge({ x: 100, y: 450 });
    session.fire();
    physics.place('block-1', { position: { x: 520, y: WORLD.groundY - 20 } });
    physics.place('block-3', { angle: 0.4 });
    run(TUNING.settle.hold + 0.2);
    expect(seen).toHaveLength(1);
    expect(log.some((e) => e.type === 'levelFinished')).toBe(true);
    expect(session.result).toMatchObject({ success: false, failure: 'collateral-damage', protectedDamaged: 1 });
    expect([...session.view()].find((e) => e.protected)?.compromised).toBe(true);
  });

  it('break the contract when any blast reaches them, matching the placement preview', () => {
    const near = { ...house, x: 300, y: 450 };
    const { session, run } = setup({ blocks: [...level().blocks, near] });
    expect(session.protectedReachedFrom({ x: 200, y: 450 })).toEqual(['block-3']);
    expect(session.protectedReachedFrom({ x: 20, y: 450 })).toEqual([]);
    session.placeCharge({ x: 200, y: 450 });
    session.fire();
    run(TUNING.settle.hold + 0.2);
    expect(session.result).toMatchObject({ success: false, failure: 'collateral-damage' });
  });
});

describe('anchored infrastructure', () => {
  const deck = { x: 150, y: 400, w: 200, h: 20, angle: 0, material: 'metal', target: false, protected: false, anchored: true } as const;

  it('is static, indestructible and outside the job', () => {
    const { session, physics, run } = setup({ blocks: [...level().blocks, deck] });
    expect(physics.bodies.get('block-3')?.spec.isStatic).toBe(true);
    session.placeCharge({ x: 150, y: 420 });
    session.fire();
    run(TUNING.settle.hold + 0.2);
    expect(physics.state('block-3')).toBeDefined();
    expect(session.result).toMatchObject({ blocksTotal: 2, protectedTotal: 0 });
  });
});
