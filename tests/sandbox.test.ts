import { describe, expect, it } from 'vitest';
import { EventBus, type GameEvents } from '../src/core/events';
import { LevelSession } from '../src/core/session';
import { SANDBOX_TEMPLATES, sandboxLevel } from '../src/content/sandbox';
import { MatterPhysicsWorld } from '../src/infrastructure/matter-physics';

const STEP = 1 / 60;

describe('Free Site templates', () => {
  // Structures are frozen until Fire and welded by their joints after it: a blast far away must leave them standing.
  it.each(SANDBOX_TEMPLATES.map((t) => [t.id, t] as const))('%s stands when fired elsewhere', (_id, template) => {
    const level = sandboxLevel(template, 1);
    const physics = new MatterPhysicsWorld();
    const session = new LevelSession(level, physics, new EventBus<GameEvents>());
    session.placeCharge({ x: 40, y: 460 });
    session.fire();
    for (let t = 0; t < 4; t += STEP) session.step(STEP);
    level.blocks.forEach((b, i) => {
      const s = physics.state(`block-${i + 1}`);
      expect(Math.hypot((s?.position.x ?? 0) - b.x, (s?.position.y ?? 0) - b.y), `${template.id} block ${i}`).toBeLessThan(3);
    });
  });

  it.each(SANDBOX_TEMPLATES.map((t) => [t.id, t] as const))('%s comes down to a dropped bomb', (_id, template) => {
    const level = sandboxLevel(template, 1);
    const session = new LevelSession(level, new MatterPhysicsWorld(), new EventBus<GameEvents>());
    expect(session.placeCharge({ x: 500, y: 60 }, 0, 'bomb').ok).toBe(true);
    const first = level.blocks[0];
    if (!first) throw new Error('empty template');
    expect(session.placeCharge({ x: first.x, y: first.y }, 0.2, 'standard').ok).toBe(true);
    session.fire();
    // Let the bomb fall for a second, then press the detonator.
    for (let k = 1; k <= 20 / STEP && session.phase !== 'finished'; k++) {
      session.step(STEP);
      if (k === 60) session.detonateBombs();
    }
    expect(session.phase).toBe('finished');
    expect(session.result?.collapseRatio ?? 0).toBeGreaterThan(0.3);
  });
});

describe('Free Site modes', () => {
  const template = SANDBOX_TEMPLATES[0];
  if (!template) throw new Error('no templates');

  it('smash: every tap is a blast and the run never ends by itself', () => {
    const events = new EventBus<GameEvents>();
    let blasts = 0;
    events.on('explosion', () => blasts++);
    const session = new LevelSession(sandboxLevel(template, 1, 'smash'), new MatterPhysicsWorld(), events);
    expect(session.strike({ x: 480, y: 450 }).ok).toBe(true);
    expect(session.phase).toBe('running');
    for (let t = 0; t < 1; t += STEP) session.step(STEP);
    expect(session.strike({ x: 520, y: 400 }, 'implosion').ok).toBe(true);
    for (let t = 0; t < 12; t += STEP) session.step(STEP);
    expect(blasts).toBe(2);
    expect(session.phase).toBe('running');
  });

  it('only smash levels accept taps as blasts', () => {
    const session = new LevelSession(sandboxLevel(template, 1, 'free'), new MatterPhysicsWorld(), new EventBus<GameEvents>());
    expect(session.strike({ x: 480, y: 450 })).toEqual({ ok: false, error: 'not-allowed' });
  });

  it('one shot allows a single charge', () => {
    const session = new LevelSession(sandboxLevel(template, 1, 'one-shot'), new MatterPhysicsWorld(), new EventBus<GameEvents>());
    expect(session.placeCharge({ x: 480, y: 450 }).ok).toBe(true);
    expect(session.placeCharge({ x: 300, y: 450 })).toEqual({ ok: false, error: 'no-charges-left' });
  });
});
