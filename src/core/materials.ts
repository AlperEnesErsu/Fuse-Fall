export const MATERIAL_IDS = ['wood', 'glass', 'concrete', 'metal', 'vehicle'] as const;
export type MaterialId = (typeof MATERIAL_IDS)[number];

export interface MaterialSpec {
  /** Matter-style density (mass per px²). */
  readonly density: number;
  readonly friction: number;
  readonly restitution: number;
  /** Damage a block absorbs before shattering. Infinity never shatters. */
  readonly strength: number;
  /** Grid used to cut the block into debris when it shatters. */
  readonly shards: { readonly cols: number; readonly rows: number };
}

export const MATERIALS: Readonly<Record<MaterialId, MaterialSpec>> = {
  wood: {
    density: 0.0012,
    friction: 0.6,
    restitution: 0.05,
    strength: 45,
    shards: { cols: 3, rows: 1 },
  },
  glass: {
    density: 0.0018,
    friction: 0.3,
    restitution: 0.1,
    strength: 12,
    shards: { cols: 3, rows: 3 },
  },
  concrete: {
    density: 0.003,
    friction: 0.8,
    restitution: 0.0,
    strength: 95,
    shards: { cols: 2, rows: 2 },
  },
  metal: {
    density: 0.006,
    friction: 0.4,
    restitution: 0.05,
    strength: Number.POSITIVE_INFINITY,
    shards: { cols: 1, rows: 1 },
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
    shards: { cols: 1, rows: 1 },
  },
};

export const isMaterialId = (value: unknown): value is MaterialId =>
  typeof value === 'string' && (MATERIAL_IDS as readonly string[]).includes(value);
