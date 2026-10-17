import type { MaterialId } from './materials';
import type { Vec2 } from './math';
import type { LevelResult } from './scoring';

export type BlastSource = 'charge' | 'implosion' | 'barrel' | 'vehicle' | 'bomb';

/** Everything the presentation layer may react to. Game rules never call effects directly. */
export interface GameEvents {
  chargePlaced: { readonly position: Vec2 };
  chargeRemoved: { readonly position: Vec2 };
  /** `power` is normalised: 1 = standard charge. */
  explosion: { readonly position: Vec2; readonly radius: number; readonly power: number; readonly source: BlastSource };
  carWrecked: { readonly position: Vec2 };
  /** `size` is the body's linear size (square root of its area), so feedback can scale with mass. */
  blockHit: { readonly position: Vec2; readonly material: MaterialId; readonly intensity: number; readonly size: number };
  blockShattered: { readonly position: Vec2; readonly material: MaterialId; readonly size: number };
  targetDown: { readonly position: Vec2; readonly remaining: number };
  protectedDamaged: { readonly position: Vec2 };
  /** A free-fall bomb left its rack and is falling. */
  bombReleased: { readonly position: Vec2 };
  /** A mortar joint or weld snapped. */
  jointBroken: { readonly position: Vec2 };
  levelFinished: { readonly result: LevelResult };
}

type Handler<T> = (payload: T) => void;

export class EventBus<E extends object> {
  private readonly handlers = new Map<keyof E, Set<Handler<never>>>();

  on<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as Handler<never>);
    return () => set.delete(handler as Handler<never>);
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const handler of set) (handler as Handler<E[K]>)(payload);
  }
}
