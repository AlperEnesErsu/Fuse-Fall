import { expect } from 'vitest';
import { EventBus, type GameEvents } from '../src/core/events';
import type { LevelDefinition } from '../src/core/level';
import { LevelSession } from '../src/core/session';
import { MatterPhysicsWorld } from '../src/infrastructure/matter-physics';

const STEP = 1 / 60;

/** Plays the level's recorded solution the way a player would: place, wait, fire. */
export const playSolution = (
  level: LevelDefinition,
  fireAt = level.solution.fireAt,
  charges = level.solution.charges,
  detonateAt = level.solution.detonateAt,
): LevelSession => {
  const session = new LevelSession(level, new MatterPhysicsWorld(), new EventBus<GameEvents>());
  for (const p of charges) {
    const placed = session.placeCharge(p, 'delay' in p ? p.delay : undefined, 'kind' in p ? p.kind : 'standard', 'direction' in p ? p.direction : undefined);
    if (!placed.ok) throw new Error(`${level.id}: solution charge rejected (${placed.error})`);
  }
  for (let t = 0; t + STEP / 2 < fireAt; t += STEP) session.step(STEP);
  expect(session.fire().ok).toBe(true);
  // Press the detonator at the recorded moments (free-fall bombs), on the same fixed steps the game uses.
  const presses = detonateAt.map((t) => Math.round(t / STEP));
  for (let k = 1; k <= 20 / STEP && session.phase !== 'finished'; k++) {
    session.step(STEP);
    if (presses.includes(k)) session.detonateBombs();
  }
  return session;
};

