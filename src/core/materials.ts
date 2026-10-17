export const MATERIAL_IDS = ['wood', 'glass', 'concrete', 'metal', 'vehicle', 'brick'] as const;
export type MaterialId = (typeof MATERIAL_IDS)[number];

export interface MaterialSpec {
  /** Matter-style density (mass per px²). */
  readonly density: number;
  readonly friction: number;
  readonly restitution: number;
  /** Damage a block absorbs before shattering. Infinity never shatters. */
  readonly strength: number;
  /**
   * How the block breaks: into `count` irregular fragments; `grain` is the
   * share of cuts that follow the long axis (1 = splinters, 0 = chunks).
   */
  readonly fragments: { readonly count: number; readonly grain: number };
}

export const MATERIALS: Readonly<Record<MaterialId, MaterialSpec>> = {
  wood: {
    density: 0.0012,
    friction: 0.6,
    restitution: 0.05,
    strength: 45,
    fragments: { count: 5, grain: 0.85 },
  },
  glass: {
    density: 0.0018,
    friction: 0.3,
    restitution: 0.1,
    strength: 12,
    fragments: { count: 10, grain: 0 },
  },
  concrete: {
    density: 0.003,
    friction: 0.8,
    restitution: 0.0,
    strength: 95,
    fragments: { count: 6, grain: 0.15 },
  },
  metal: {
    density: 0.006,
    friction: 0.4,
    restitution: 0.05,
    strength: Number.POSITIVE_INFINITY,
    fragments: { count: 1, grain: 0 },
  },
  /**
   * A car body: mostly hollow, on rolling wheels (low sliding friction, or the
   * engine's push would tip it over). It is wrecked rather than shattered.
   */
  vehicle: {
    density: 0.0022,
    friction: 0.08,
    restitution: 0.1,
    strength: 60,
    fragments: { count: 1, grain: 0 },
  },
  /** Masonry: weaker than concrete, crumbles into many small chunks. */
  brick: {
    density: 0.0019,
    friction: 0.75,
    restitution: 0.02,
    strength: 60,
    fragments: { count: 8, grain: 0.1 },
  },
};

export const isMaterialId = (value: unknown): value is MaterialId =>
  typeof value === 'string' && (MATERIAL_IDS as readonly string[]).includes(value);
