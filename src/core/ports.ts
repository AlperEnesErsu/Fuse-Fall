import type { Result } from './result';
import type { MaterialId } from './materials';
import type { Vec2 } from './math';
import type { Progress } from './progress';

export type Shape =
  | { readonly kind: 'rect'; readonly w: number; readonly h: number }
  /** Convex polygon, vertices relative to its centroid. */
  | { readonly kind: 'poly'; readonly vertices: readonly Vec2[] }
  | { readonly kind: 'circle'; readonly r: number };

export interface BodySpec {
  readonly id: string;
  readonly shape: Shape;
  readonly position: Vec2;
  readonly angle: number;
  readonly material: MaterialId;
  readonly isStatic: boolean;
  /** Moved only by setPose (on rails): immune to gravity and pushes, but still collides. */
  readonly kinematic?: boolean;
  readonly velocity?: Vec2;
  readonly angularVelocity?: number;
  /** Air drag per step (0..1); the engine's default damps tumbling debris, a pendulum needs far less. */
  readonly airDrag?: number;
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
  /** Welds two bodies together at a world point (zero-length, rigid). */
  addJoint(id: string, a: string, b: string, at: Vec2): void;
  /** A rope from a fixed point in the world to a body's centre: keeps its length, never stretches or snaps by itself. */
  addRope(id: string, body: string, hook: Vec2, length: number): void;
  removeJoint(id: string): void;
  /** Current gap between a joint's two anchor points (px); undefined once gone. */
  jointStretch(id: string): number | undefined;
}

/** A scrap pack on sale, with the store's own localised price. */
export interface ScrapPack {
  readonly id: string;
  readonly scrap: number;
  readonly price: string;
}

/** `pending`: the store took the order but the payment has not cleared yet (cash, bank transfer). */
export type OfferError = 'unavailable' | 'cancelled' | 'pending' | 'failed';

/** A pack the store has confirmed as paid; `token` names that one payment. */
export interface PackPurchase {
  readonly packId: string;
  readonly token: string;
}

/**
 * Rewarded ads and scrap packs. The game never talks to an ad network or a
 * billing service directly; an adapter does, and a build without one simply
 * offers nothing.
 */
export interface OfferStore {
  /** Whether a rewarded ad can be shown now. */
  adReady(): Promise<boolean>;
  /** Shows a rewarded ad; ok only when the viewer earned the reward. */
  showRewardedAd(): Promise<Result<true, OfferError>>;
  /** Packs on sale; empty when purchases are unavailable. */
  packs(): Promise<readonly ScrapPack[]>;
  /** Buys a pack; ok once the store has confirmed the payment. The game credits it, then settles it. */
  buy(id: string): Promise<Result<PackPurchase, OfferError>>;
  /** Paid packs never settled: the app closed before crediting, or a pending payment has since cleared. */
  unsettled(): Promise<readonly PackPurchase[]>;
  /** Tells the store a pack was credited, so it can be bought again. */
  settle(purchase: PackPurchase): Promise<void>;
  /** Whether the player must be able to revisit their ad privacy choices (from the settings). */
  privacyChoicesRequired(): boolean;
  showPrivacyChoices(): Promise<void>;
}

export interface SaveRepository {
  load(): Progress;
  save(progress: Progress): void;
}
