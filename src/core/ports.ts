import type { MaterialId } from './materials';
import type { Vec2 } from './math';
import type { Progress } from './progress';

export type Shape =
  | { readonly kind: 'rect'; readonly w: number; readonly h: number }
  | { readonly kind: 'circle'; readonly r: number };

export interface BodySpec {
  readonly id: string;
  readonly shape: Shape;
  readonly position: Vec2;
  readonly angle: number;
  readonly material: MaterialId;
  readonly isStatic: boolean;
  readonly velocity?: Vec2;
  readonly angularVelocity?: number;
}

export interface BodyState {
  readonly position: Vec2;
  readonly angle: number;
  /** px per second. */
  readonly velocity: Vec2;
  /** rad per second. */
  readonly angularVelocity: number;
  readonly mass: number;
}

/** A contact that began this step. `speed` is the relative speed in px per second. */
export interface Impact {
  readonly a: string;
  readonly b: string;
  readonly speed: number;
  readonly point: Vec2;
}

/** The only way game rules touch a physics engine. */
export interface PhysicsWorld {
  add(spec: BodySpec): void;
  remove(id: string): void;
  state(id: string): BodyState | undefined;
  /** Instant velocity change: `dv` in px per second, `dAngular` in rad per second. */
  kick(id: string, dv: Vec2, dAngular: number): void;
  /** Moves a body directly (scripted motion while the world is frozen). */
  setPose(id: string, position: Vec2, velocity: Vec2): void;
  step(dtSeconds: number): void;
  drainImpacts(): Impact[];
}

export interface SaveRepository {
  load(): Progress;
  save(progress: Progress): void;
}
