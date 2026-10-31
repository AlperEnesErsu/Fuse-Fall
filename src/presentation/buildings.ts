import { WORLD } from '../core/level';
import { hashString } from '../core/math';
import type { EntityView } from '../core/session';

/**
 * Blocks read as parts of buildings, not as boxes. When a job starts, blocks
 * that touch are grouped into one building; each block gets a role from its
 * shape (column, slab or room) and is dressed for it. The building that holds
 * a target is the condemned one: grimy, its windows boarded up. That is how
 * the player tells what has to come down, with no marker on any block.
 * Presentation only: the physics still sees plain blocks.
 */
export type PartRole = 'column' | 'slab' | 'room';

export interface BuildingPart {
  readonly role: PartRole;
  /** The building holds a target: it is the one to bring down. */
  readonly condemned: boolean;
  /** The part's top edge was the building's roof line when the job started. */
  readonly roof: boolean;
  /** The part stood on the ground when the job started. */
  readonly grounded: boolean;
  /** Varies window rhythm and wear between buildings. */
  readonly seed: number;
}

const TOUCH = 3;

const roleOf = (w: number, h: number): PartRole => (h >= w * 2.2 ? 'column' : w >= h * 2.2 ? 'slab' : 'room');

/** Groups the job's free-standing blocks (not anchored, not protected) into buildings. */
export const planBuildings = (entities: readonly EntityView[]): Map<string, BuildingPart> => {
  const blocks = entities.filter((e) => e.kind === 'block' && e.shape.kind === 'rect' && !e.anchored && !e.protected && !e.car);
  const box = (e: EntityView) => {
    const { w, h } = e.shape.kind === 'rect' ? e.shape : { w: 0, h: 0 };
    return { x0: e.state.position.x - w / 2, x1: e.state.position.x + w / 2, y0: e.state.position.y - h / 2, y1: e.state.position.y + h / 2, w, h };
  };
  const boxes = blocks.map(box);
  const parent = blocks.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i] ?? i)));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (!a || !b) continue;
      if (a.x0 - TOUCH <= b.x1 && b.x0 - TOUCH <= a.x1 && a.y0 - TOUCH <= b.y1 && b.y0 - TOUCH <= a.y1) parent[find(i)] = find(j);
    }
  }
  const condemned = new Set<number>();
  const top = new Map<number, number>();
  blocks.forEach((e, i) => {
    const g = find(i);
    if (e.target) condemned.add(g);
    top.set(g, Math.min(top.get(g) ?? Infinity, boxes[i]?.y0 ?? Infinity));
  });
  const plan = new Map<string, BuildingPart>();
  blocks.forEach((e, i) => {
    const b = boxes[i];
    if (!b) return;
    const g = find(i);
    plan.set(e.id, {
      role: roleOf(b.w, b.h),
      condemned: condemned.has(g),
      // A part is roof when nothing of its building sits on it.
      roof: !boxes.some((o, j) => j !== i && find(j) === g && Math.abs(o.y1 - b.y0) <= TOUCH && o.x0 < b.x1 && b.x0 < o.x1),
      grounded: b.y1 >= WORLD.groundY - TOUCH,
      seed: hashString(blocks[g]?.id ?? e.id),
    });
  });
  return plan;
};

/** Dresses one block for its part, in the body's own (rotated) frame, over its material fill. */
export const drawPart = (c: CanvasRenderingContext2D, part: BuildingPart, w: number, h: number, glass: boolean): void => {
  if (part.condemned) {
    // Weathered: a dull wash and soot streaks running down from the top.
    c.fillStyle = 'rgba(52, 44, 38, 0.22)';
    c.fillRect(-w / 2, -h / 2, w, h);
    let seed = part.seed;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    c.fillStyle = 'rgba(30, 24, 20, 0.16)';
    for (let i = 0; i < Math.max(1, Math.floor(w / 18)); i++) {
      const x = -w / 2 + rnd() * w;
      c.fillRect(x, -h / 2, 2 + rnd() * 3, h * (0.3 + rnd() * 0.6));
    }
  }
  if (part.role === 'column') column(c, part, w, h);
  else if (part.role === 'slab') slab(c, w, h);
  else if (!glass) room(c, part, w, h);
  if (part.roof && part.role !== 'column') roofLine(c, part, w, h);
  if (part.condemned && part.role === 'room') cautionTape(c, part, w, h);
};

/** Yellow and black caution tape wrapped across a condemned storey. */
const cautionTape = (c: CanvasRenderingContext2D, part: BuildingPart, w: number, h: number): void => {
  const band = Math.max(6, Math.min(11, Math.min(w, h) * 0.24));
  c.save();
  c.beginPath();
  c.rect(-w / 2, -h / 2, w, h);
  c.clip();
  c.rotate(((part.seed & 1) === 0 ? -1 : 1) * 0.42);
  const len = w + h;
  c.fillStyle = 'rgba(0, 0, 0, 0.3)';
  c.fillRect(-len / 2, -band / 2 + 1.5, len, band);
  c.fillStyle = '#f2c230';
  c.fillRect(-len / 2, -band / 2, len, band);
  c.fillStyle = '#1d1b18';
  for (let x = -len / 2; x < len / 2; x += band * 1.6) {
    c.beginPath();
    c.moveTo(x, -band / 2);
    c.lineTo(x + band * 0.7, -band / 2);
    c.lineTo(x + band * 0.2, band / 2);
    c.lineTo(x - band * 0.5, band / 2);
    c.fill();
  }
  c.restore();
};

const column = (c: CanvasRenderingContext2D, part: BuildingPart, w: number, h: number): void => {
  // Rounded by light: bright left edge, shaded right edge.
  c.fillStyle = 'rgba(255, 255, 255, 0.14)';
  c.fillRect(-w / 2, -h / 2, w * 0.28, h);
  c.fillStyle = 'rgba(0, 0, 0, 0.2)';
  c.fillRect(w / 2 - w * 0.3, -h / 2, w * 0.3, h);
  // Capital under the slab, plinth on the ground.
  c.fillStyle = 'rgba(0, 0, 0, 0.28)';
  c.fillRect(-w / 2, -h / 2, w, Math.min(5, h * 0.06));
  if (part.grounded) {
    c.fillStyle = 'rgba(35, 32, 30, 0.45)';
    c.fillRect(-w / 2, h / 2 - Math.min(8, h * 0.08), w, Math.min(8, h * 0.08));
  }
};

const slab = (c: CanvasRenderingContext2D, w: number, h: number): void => {
  // A floor seen edge-on: lit top, the slab's thick edge, a shadow beneath.
  c.fillStyle = 'rgba(255, 255, 255, 0.2)';
  c.fillRect(-w / 2, -h / 2, w, Math.max(2, h * 0.2));
  c.fillStyle = 'rgba(0, 0, 0, 0.3)';
  c.fillRect(-w / 2, h / 2 - Math.max(2, h * 0.25), w, Math.max(2, h * 0.25));
};

/** A storey: a window grid, lit and curtained, or boarded up on the condemned building. */
const room = (c: CanvasRenderingContext2D, part: BuildingPart, w: number, h: number): void => {
  const nx = Math.max(1, Math.floor((w - 6) / 22));
  const ny = Math.max(1, Math.floor((h - 8) / 30));
  const cw = (w - 6) / nx;
  const ch = (h - 8) / ny;
  const ww = Math.min(14, cw * 0.62);
  const wh = Math.min(18, ch * 0.62);
  let seed = part.seed ^ 0x9e3779b9;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const x = -w / 2 + 3 + cw * (ix + 0.5) - ww / 2;
      const y = -h / 2 + 4 + ch * (iy + 0.5) - wh / 2;
      // Frame and sill.
      c.fillStyle = 'rgba(28, 24, 22, 0.55)';
      c.fillRect(x - 1.5, y - 1.5, ww + 3, wh + 3);
      c.fillStyle = 'rgba(240, 232, 214, 0.5)';
      c.fillRect(x - 2.5, y + wh + 1, ww + 5, 2);
      if (part.condemned) {
        c.fillStyle = '#1b1715';
        c.fillRect(x, y, ww, wh);
        // Boards nailed across, one slightly askew.
        c.fillStyle = '#9a7449';
        const tilt = (rnd() - 0.5) * 0.5;
        c.save();
        c.translate(x + ww / 2, y + wh / 2);
        c.rotate(tilt);
        c.fillRect(-ww / 2 - 2, -wh * 0.22 - 2, ww + 4, 4);
        c.rotate(-tilt * 2 + 0.2);
        c.fillRect(-ww / 2 - 2, wh * 0.18 - 2, ww + 4, 4);
        c.restore();
      } else {
        c.fillStyle = rnd() < 0.6 ? '#ffd98a' : '#9cc4dd';
        c.fillRect(x, y, ww, wh);
        c.fillStyle = 'rgba(120, 60, 40, 0.55)';
        c.fillRect(x, y, ww * 0.35, wh);
        c.fillStyle = 'rgba(30, 26, 22, 0.5)';
        c.fillRect(x + ww / 2 - 0.5, y, 1, wh);
      }
    }
  }
};

/** Cornice along the roof line; the condemned building's is chipped. */
const roofLine = (c: CanvasRenderingContext2D, part: BuildingPart, w: number, h: number): void => {
  const t = Math.min(5, h * 0.18);
  c.fillStyle = 'rgba(25, 22, 20, 0.5)';
  c.fillRect(-w / 2, -h / 2, w, t);
  c.fillStyle = 'rgba(255, 255, 255, 0.22)';
  c.fillRect(-w / 2, -h / 2, w, Math.max(1, t * 0.35));
  if (part.condemned) {
    c.fillStyle = 'rgba(20, 18, 16, 0.9)';
    c.beginPath();
    c.moveTo(w * 0.15, -h / 2);
    c.lineTo(w * 0.24, -h / 2 + t + 2);
    c.lineTo(w * 0.32, -h / 2);
    c.fill();
  }
};
