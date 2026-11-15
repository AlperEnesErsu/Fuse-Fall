import type { EntityView, LevelSession } from '../core/session';

/**
 * Physics advances in fixed 1/60 s steps; the screen refreshes whenever it likes (90 or
 * 120 Hz phones), and slow motion spreads one step over several frames. Drawing each body
 * where the last step left it makes motion stutter in both cases. Instead the renderer
 * draws a point between the previous step and the latest one.
 */

export interface Pose {
  x: number;
  y: number;
  angle: number;
}

export interface Blend {
  /** 0 = the previous step, 1 = the latest one. */
  readonly alpha: number;
  readonly previous: ReadonlyMap<string, Pose>;
}

/** A body that moved further than this in one step was repositioned (traffic looping round), not moved: no blending. */
const TELEPORT = 60;

/** Records where every body is now, into `into`. Called right before a fixed step. */
export const rememberPoses = (session: LevelSession, into: Map<string, Pose>): void => {
  const seen = new Set<string>();
  for (const e of session.view()) {
    seen.add(e.id);
    const pose = into.get(e.id);
    if (pose) {
      pose.x = e.state.position.x;
      pose.y = e.state.position.y;
      pose.angle = e.state.angle;
    } else {
      into.set(e.id, { x: e.state.position.x, y: e.state.position.y, angle: e.state.angle });
    }
  }
  for (const id of into.keys()) if (!seen.has(id)) into.delete(id);
};

/** A pose between `from` (alpha 0) and `to` (alpha 1). */
export const blendPose = (from: Pose, to: Pose, alpha: number): Pose => {
  if (Math.abs(to.x - from.x) > TELEPORT || Math.abs(to.y - from.y) > TELEPORT) return to;
  return {
    x: from.x + (to.x - from.x) * alpha,
    y: from.y + (to.y - from.y) * alpha,
    angle: from.angle + (to.angle - from.angle) * alpha,
  };
};

/** The bodies to draw this frame, each at its blended pose. Without a blend, exactly where physics has them. */
export const smoothed = (views: Iterable<EntityView>, blend: Blend | undefined): EntityView[] => {
  const out: EntityView[] = [];
  for (const e of views) {
    const before = blend && blend.alpha < 1 ? blend.previous.get(e.id) : undefined;
    if (!before) {
      out.push(e);
      continue;
    }
    const now = { x: e.state.position.x, y: e.state.position.y, angle: e.state.angle };
    const pose = blendPose(before, now, blend?.alpha ?? 1);
    out.push(pose === now ? e : { ...e, state: { ...e.state, position: { x: pose.x, y: pose.y }, angle: pose.angle } });
  }
  return out;
};
