import type { MaterialId } from './materials';
import { vec, type Vec2 } from './math';

/** A block as the joint finder sees it: axis-aligned at spawn, with its entity id. */
export interface JointBlock {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly angle: number;
  readonly material: MaterialId;
}

/** A mortar/weld connection: two anchor points on one contact face. */
export interface JointDef {
  readonly id: string;
  readonly a: string;
  /** Another block, or the ground. */
  readonly b: string;
  readonly anchors: readonly Vec2[];
  /** How far the joint may stretch before it snaps (px). */
  readonly tolerance: number;
}

/** Bond quality of the weaker material in a connection: nails, mortar, welds, putty. */
const BOND: Readonly<Record<MaterialId, number>> = {
  wood: 1,
  concrete: 1,
  brick: 0.7,
  glass: 0.4,
  metal: 1.2,
  vehicle: 0,
};

const TOUCH = 1.5;
const MIN_OVERLAP = 4;
const BASE_TOLERANCE = 2.5;

const anchorsAlong = (from: number, to: number, at: (t: number) => Vec2): Vec2[] =>
  to - from < 16 ? [at((from + to) / 2)] : [at(from + (to - from) * 0.2), at(from + (to - from) * 0.8)];

/**
 * Finds every face where two blocks touch, and every block standing on the
 * ground, and joins them. Rotated blocks are left loose: their faces are not
 * reliably flush.
 */
export const findJoints = (blocks: readonly JointBlock[], groundY: number, groundId: string): JointDef[] => {
  const joints: JointDef[] = [];
  const add = (a: JointBlock, b: string, bMaterial: MaterialId | undefined, anchors: Vec2[]) => {
    const bond = Math.min(BOND[a.material], bMaterial ? BOND[bMaterial] : 1);
    if (bond <= 0 || anchors.length === 0) return;
    joints.push({ id: `joint-${joints.length + 1}`, a: a.id, b, anchors, tolerance: BASE_TOLERANCE * bond });
  };
  const square = blocks.filter((b) => Math.abs(b.angle) < 1e-6);
  for (let i = 0; i < square.length; i++) {
    const a = square[i];
    if (!a) continue;
    const aL = a.x - a.w / 2;
    const aR = a.x + a.w / 2;
    const aT = a.y - a.h / 2;
    const aB = a.y + a.h / 2;
    if (Math.abs(aB - groundY) <= TOUCH) add(a, groundId, undefined, anchorsAlong(aL, aR, (t) => vec(t, groundY)));
    for (let j = i + 1; j < square.length; j++) {
      const b = square[j];
      if (!b) continue;
      const bL = b.x - b.w / 2;
      const bR = b.x + b.w / 2;
      const bT = b.y - b.h / 2;
      const bB = b.y + b.h / 2;
      const xFrom = Math.max(aL, bL);
      const xTo = Math.min(aR, bR);
      const yFrom = Math.max(aT, bT);
      const yTo = Math.min(aB, bB);
      if (xTo - xFrom >= MIN_OVERLAP && (Math.abs(aB - bT) <= TOUCH || Math.abs(bB - aT) <= TOUCH)) {
        const y = Math.abs(aB - bT) <= TOUCH ? (aB + bT) / 2 : (bB + aT) / 2;
        add(a, b.id, b.material, anchorsAlong(xFrom, xTo, (t) => vec(t, y)));
      } else if (yTo - yFrom >= MIN_OVERLAP && (Math.abs(aR - bL) <= TOUCH || Math.abs(bR - aL) <= TOUCH)) {
        const x = Math.abs(aR - bL) <= TOUCH ? (aR + bL) / 2 : (bR + aL) / 2;
        add(a, b.id, b.material, anchorsAlong(yFrom, yTo, (t) => vec(x, t)));
      }
    }
  }
  return joints;
};
