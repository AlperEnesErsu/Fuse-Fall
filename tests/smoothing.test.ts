import { describe, expect, it } from 'vitest';
import { EventBus, type GameEvents } from '../src/core/events';
import type { EntityView } from '../src/core/session';
import { LevelSession } from '../src/core/session';
import { blendPose, rememberPoses, smoothed, type Pose } from '../src/presentation/smoothing';
import { loadCampaign } from '../src/content/levels';
import { FakePhysics } from './fake-physics';

const body = (id: string, x: number, y: number, angle = 0): EntityView =>
  ({ id, state: { position: { x, y }, angle, velocity: { x: 0, y: 0 }, angularVelocity: 0, mass: 1 } }) as EntityView;

describe('drawing between fixed steps', () => {
  it('blends a pose between the previous step and the latest', () => {
    expect(blendPose({ x: 0, y: 10, angle: 0 }, { x: 10, y: 20, angle: 1 }, 0.25)).toEqual({ x: 2.5, y: 12.5, angle: 0.25 });
  });

  it('does not blend a body that was repositioned, such as traffic looping round', () => {
    const to = { x: 900, y: 10, angle: 0 };
    expect(blendPose({ x: 20, y: 10, angle: 0 }, to, 0.5)).toBe(to);
  });

  it('draws each body at its blended pose, and new or unblended bodies where they are', () => {
    const previous = new Map<string, Pose>([['a', { x: 0, y: 0, angle: 0 }]]);
    const now = [body('a', 10, 0), body('fresh', 5, 5)];
    const half = smoothed(now, { alpha: 0.5, previous });
    expect(half[0]?.state.position).toEqual({ x: 5, y: 0 });
    expect(half[1]).toBe(now[1]);
    // The latest step itself, and no blend at all, change nothing.
    expect(smoothed(now, { alpha: 1, previous })[0]).toBe(now[0]);
    expect(smoothed(now, undefined)[0]).toBe(now[0]);
  });

  it('remembers every body of a session and forgets the ones that are gone', () => {
    const level = loadCampaign().levels[0];
    if (!level) throw new Error('no level');
    const physics = new FakePhysics();
    const session = new LevelSession(level, physics, new EventBus<GameEvents>());
    const poses = new Map<string, Pose>([['left-over', { x: 1, y: 1, angle: 0 }]]);
    rememberPoses(session, poses);
    expect(poses.has('left-over')).toBe(false);
    expect(poses.size).toBe([...session.view()].length);
    const first = [...session.view()][0];
    expect(first && poses.get(first.id)).toEqual(first && { x: first.state.position.x, y: first.state.position.y, angle: first.state.angle });
  });
});
