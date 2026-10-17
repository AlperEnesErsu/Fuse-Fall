import { length, rotate, sub, vec, type Vec2 } from './math';
import type { Shape } from './ports';

/**
 * Geometry of body shapes. The single owner of area, extent and contact
 * questions, so damage, protection, footprint and rendering all agree.
 * Polygons are convex, with vertices relative to their centroid.
 */

const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;

export const polygonArea = (vertices: readonly Vec2[]): number => {
  let sum = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    if (a && b) sum += cross(a, b);
  }
  return Math.abs(sum) / 2;
};

export const polygonCentroid = (vertices: readonly Vec2[]): Vec2 => {
  let cx = 0;
  let cy = 0;
  let twice = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    if (!a || !b) continue;
    const f = cross(a, b);
    twice += f;
    cx += (a.x + b.x) * f;
    cy += (a.y + b.y) * f;
  }
  if (Math.abs(twice) < 1e-9) {
    const n = Math.max(1, vertices.length);
    return vec(vertices.reduce((s, v) => s + v.x, 0) / n, vertices.reduce((s, v) => s + v.y, 0) / n);
  }
  return vec(cx / (3 * twice), cy / (3 * twice));
};

/** Splits a convex polygon by the line through `p` along `dir`. Either side may come back empty. */
export const splitConvex = (poly: readonly Vec2[], p: Vec2, dir: Vec2): [Vec2[], Vec2[]] => {
  const left: Vec2[] = [];
  const right: Vec2[] = [];
  const side = (v: Vec2) => cross(dir, sub(v, p));
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (!a || !b) continue;
    const sa = side(a);
    const sb = side(b);
    (sa >= 0 ? left : right).push(a);
    if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) {
      const t = sa / (sa - sb);
      const hit = vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      left.push(hit);
      right.push(hit);
    }
  }
  return [left, right];
};

export const rectVertices = (w: number, h: number): Vec2[] => [
  vec(-w / 2, -h / 2),
  vec(w / 2, -h / 2),
  vec(w / 2, h / 2),
  vec(-w / 2, h / 2),
];

export const area = (shape: Shape): number =>
  shape.kind === 'rect' ? shape.w * shape.h : shape.kind === 'circle' ? Math.PI * shape.r * shape.r : polygonArea(shape.vertices);

/** Farthest point of the outline from the centre. */
export const halfExtent = (shape: Shape): number =>
  shape.kind === 'rect'
    ? Math.max(shape.w, shape.h) / 2
    : shape.kind === 'circle'
      ? shape.r
      : Math.max(...shape.vertices.map((v) => length(v)));

/** A conservative "thickness" radius, used where a blast starts to bite. */
export const innerRadius = (shape: Shape): number =>
  shape.kind === 'rect' ? Math.min(shape.w, shape.h) / 2 : shape.kind === 'circle' ? shape.r : Math.sqrt(area(shape) / Math.PI);

/** Distance from a point to a segment. */
const toSegment = (p: Vec2, a: Vec2, b: Vec2): number => {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y || 1)));
  return length(sub(p, vec(a.x + ab.x * t, a.y + ab.y * t)));
};

/**
 * Whether a circle touches a body's actual outline (rotated rectangle,
 * circle or convex polygon). The contract rule for protected property; the
 * placement preview uses the same function.
 */
export const circleTouches = (center: Vec2, radius: number, shape: Shape, position: Vec2, angle: number): boolean => {
  const local = rotate(sub(center, position), -angle);
  if (shape.kind === 'circle') return length(local) < radius + shape.r;
  if (shape.kind === 'rect') {
    const dx = Math.max(Math.abs(local.x) - shape.w / 2, 0);
    const dy = Math.max(Math.abs(local.y) - shape.h / 2, 0);
    return dx * dx + dy * dy < radius * radius;
  }
  const v = shape.vertices;
  let inside = true;
  let nearest = Infinity;
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    const b = v[(i + 1) % v.length];
    if (!a || !b) continue;
    if (cross(sub(b, a), sub(local, a)) < 0) inside = false;
    nearest = Math.min(nearest, toSegment(local, a, b));
  }
  return inside || nearest < radius;
};
