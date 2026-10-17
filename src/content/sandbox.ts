import { WORLD, type BlockDef, type CarDef, type LevelDefinition } from '../core/level';
import type { MaterialId } from '../core/materials';
import type { Language } from '../presentation/strings';

/**
 * Free Site: no rules, no score. Structure templates to bring down however you
 * like, with every charge type and unlimited charges. Templates are built from
 * the same blocks as missions, so they behave the same way.
 */

const G = WORLD.groundY;

interface Builder {
  readonly blocks: BlockDef[];
  /** Barrel positions along the ground. */
  readonly barrels: number[];
  readonly cars: CarDef[];
}

const block = (b: Builder, x: number, y: number, w: number, h: number, material: MaterialId): number => {
  b.blocks.push({ x, y, w, h, angle: 0, material, target: false, protected: false, anchored: false });
  return y - h / 2;
};

/** A block standing on `base`; returns its top. */
const col = (b: Builder, x: number, base: number, w: number, h: number, material: MaterialId): number =>
  block(b, x, base - h / 2, w, h, material);

/** Columns at `xs` with one slab across them; returns the slab's top. */
const storey = (b: Builder, xs: number[], base: number, h: number, colW: number, colM: MaterialId, slabM: MaterialId): number => {
  for (const x of xs) col(b, x, base, colW, h, colM);
  const first = xs[0] ?? 0;
  const last = xs[xs.length - 1] ?? 0;
  return col(b, (first + last) / 2, base - h, last - first + colW + 16, 16, slabM);
};

/** Brick infill between two columns, laid course by course. */
const infill = (b: Builder, from: number, to: number, base: number, h: number): void => {
  const course = 18;
  for (let y = base; y > base - h + 0.5; y -= course) {
    const height = Math.min(course, y - (base - h));
    col(b, (from + to) / 2, y, to - from, height, 'brick');
  }
};

export interface SandboxTemplate {
  readonly id: string;
  readonly name: Readonly<Record<Language, string>>;
  readonly build: () => Builder;
}

export const SANDBOX_TEMPLATES: readonly SandboxTemplate[] = [
  {
    id: 'timber-tower',
    name: { tr: 'Ahşap Kule', en: 'Timber Tower' },
    build: () => {
      const b: Builder = { blocks: [], barrels: [], cars: [] };
      let top: number = storey(b, [440, 520], G, 110, 20, 'wood', 'wood');
      top = storey(b, [450, 510], top, 90, 18, 'wood', 'wood');
      storey(b, [460, 500], top, 70, 16, 'wood', 'wood');
      return b;
    },
  },
  {
    id: 'apartment',
    name: { tr: 'Betonarme Apartman', en: 'Concrete Apartment' },
    build: () => {
      const b: Builder = { blocks: [], barrels: [], cars: [] };
      let base: number = G;
      for (let floor = 0; floor < 3; floor++) {
        const xs = [380, 480, 580];
        for (let k = 0; k < xs.length - 1; k++) infill(b, (xs[k] ?? 0) + 12, (xs[k + 1] ?? 0) - 12, base, 72);
        base = storey(b, xs, base, 72, 24, 'concrete', 'concrete');
      }
      return b;
    },
  },
  {
    id: 'brick-house',
    name: { tr: 'Tuğla Ev', en: 'Brick House' },
    build: () => {
      const b: Builder = { blocks: [], barrels: [], cars: [] };
      infill(b, 400, 600, G, 108);
      let top: number = col(b, 500, G - 108, 240, 14, 'wood');
      for (const w of [200, 150, 100]) top = col(b, 500, top, w, 14, 'wood');
      return b;
    },
  },
  {
    id: 'chimney',
    name: { tr: 'Fabrika Bacası', en: 'Factory Chimney' },
    build: () => {
      const b: Builder = { blocks: [], barrels: [], cars: [] };
      let top: number = G;
      for (let i = 0; i < 7; i++) top = col(b, 500, top, 48, 56, i < 2 ? 'concrete' : 'brick');
      return b;
    },
  },
  {
    id: 'bridge',
    name: { tr: 'Köprü ve Araç', en: 'Bridge and Car' },
    build: () => {
      const b: Builder = { blocks: [], barrels: [], cars: [] };
      col(b, 330, G, 30, 120, 'concrete');
      col(b, 670, G, 30, 120, 'concrete');
      const deck = col(b, 500, G - 120, 380, 18, 'metal');
      b.cars.push({ x: 360, y: deck - 12, w: 56, h: 24, from: 350, to: 650, speed: 70, target: false, mode: 'patrol', protected: false, style: 'car' });
      return b;
    },
  },
  {
    id: 'glass-tower',
    name: { tr: 'Cam Ofis', en: 'Glass Office' },
    build: () => {
      const b: Builder = { blocks: [], barrels: [], cars: [] };
      let top: number = G;
      for (let i = 0; i < 4; i++) top = storey(b, [450, 550], top, 60, 16, 'metal', 'glass');
      return b;
    },
  },
  {
    id: 'depot',
    name: { tr: 'Yakıt Deposu', en: 'Fuel Depot' },
    build: () => {
      const b: Builder = { blocks: [], barrels: [380, 420, 460, 640, 680], cars: [] };
      storey(b, [520, 600], G, 120, 22, 'wood', 'metal');
      return b;
    },
  },
  {
    id: 'steel-frame',
    name: { tr: 'Çelik İskele', en: 'Steel Frame' },
    build: () => {
      const b: Builder = { blocks: [], barrels: [], cars: [] };
      let top: number = storey(b, [400, 500, 600], G, 100, 18, 'metal', 'metal');
      top = storey(b, [420, 500, 580], top, 90, 16, 'metal', 'wood');
      storey(b, [460, 540], top, 80, 14, 'wood', 'wood');
      return b;
    },
  },
];

/**
 * Ways to play the Free Site: free (place charges, fire), smash (every tap is a
 * blast, no end) and one shot (a single charge: how much can it bring down?).
 */
export const SANDBOX_VARIANTS = ['free', 'smash', 'one-shot'] as const;
export type SandboxVariant = (typeof SANDBOX_VARIANTS)[number];

/** Charges for a Free Site: generous, but bounded so performance stays predictable. */
export const SANDBOX_CHARGES = 12;

/** Builds a playable, rule-free level from a template in a city. */
export const sandboxLevel = (template: SandboxTemplate, world: number, variant: SandboxVariant = 'free'): LevelDefinition => {
  const b = template.build();
  const charges = variant === 'one-shot' ? 1 : SANDBOX_CHARGES;
  return {
    id: `sandbox-${variant}-${template.id}`,
    name: template.name.tr,
    world,
    order: 1,
    hint: undefined,
    charges: { max: charges, par: charges },
    bonusCollapse: 1,
    zones: [{ x: 20, y: 120, w: WORLD.width - 40, h: G - 120 }],
    dropZones: [{ x: 20, y: 20, w: WORLD.width - 40, h: 100 }],
    blocks: b.blocks,
    barrels: b.barrels.map((x) => ({ x, y: G - 16 })),
    cars: b.cars,
    chargeKinds: ['standard', 'precision', 'implosion', 'bomb'],
    footprint: undefined,
    ...(variant === 'smash' ? { instantBlasts: true as const } : {}),
    solution: { charges: [], fireAt: 0, detonateAt: [] },
  };
};
