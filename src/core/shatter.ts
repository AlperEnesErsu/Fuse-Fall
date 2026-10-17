import { MATERIALS, type MaterialId } from './materials';
import { add, length, rotate, scale, sub, vec, type Vec2 } from './math';
import { polygonArea, polygonCentroid, rectVertices, splitConvex } from './shapes';
import { TUNING } from './tuning';

export interface ShatterSource {
  readonly position: Vec2;
  readonly angle: number;
  readonly w: number;
  readonly h: number;
  readonly velocity: Vec2;
  readonly angularVelocity: number;
  readonly material: MaterialId;
}

export interface Shard {
  readonly position: Vec2;
  readonly angle: number;
  /** Convex outline, relative to `position`, in the parent's orientation. */
  readonly vertices: readonly Vec2[];
  readonly velocity: Vec2;
  readonly angularVelocity: number;
}

/**
 * Breaks a block into irregular convex fragments by slicing it along random
 * lines, the way real material fails: timber splinters along its grain,
 * concrete breaks into chunks, glass into many shards. Fragments keep the
 * parent's motion (including the tangential part of its spin) and burst
 * outwards, mostly away from `blastOrigin` when one is given.
 */
export const shatter = (source: ShatterSource, blastOrigin: Vec2 | undefined, rng: () => number): Shard[] => {
  const { count, grain } = MATERIALS[source.material].fragments;
  const minArea = TUNING.shard.minSize * TUNING.shard.minSize * 2;
  let pieces: Vec2[][] = [rectVertices(source.w, source.h)];
  const longAxis = source.w >= source.h ? vec(1, 0) : vec(0, 1);

  // Keep cutting the largest piece until the material's fragment count is reached.
  for (let attempts = 0; pieces.length < count && attempts < count * 6; attempts++) {
    pieces.sort((a, b) => polygonArea(b) - polygonArea(a));
    const piece = pieces[0];
    if (!piece || polygonArea(piece) < minArea * 2) break;
    const c = polygonCentroid(piece);
    const spread = Math.sqrt(polygonArea(piece)) * 0.25;
    const through = vec(c.x + (rng() - 0.5) * spread, c.y + (rng() - 0.5) * spread);
    // Grain 1: cuts follow the long axis (splinters). Grain 0: any direction (chunks).
    const random = rng() * Math.PI;
    const along = Math.atan2(longAxis.y, longAxis.x) + (rng() - 0.5) * 0.5;
    const theta = grain >= rng() ? along : random;
    const [a, b] = splitConvex(piece, through, vec(Math.cos(theta), Math.sin(theta)));
    if (a.length < 3 || b.length < 3 || polygonArea(a) < minArea || polygonArea(b) < minArea) continue;
    pieces = [a, b, ...pieces.slice(1)];
  }

  const away = blastOrigin ? sub(source.position, blastOrigin) : vec(0, -1);
  const awayDir = scale(away, 1 / (length(away) || 1));
  return pieces.map((piece) => {
    const centroid = polygonCentroid(piece);
    const offset = rotate(centroid, source.angle);
    // v = v_parent + ω × r
    const spinVelocity = vec(-source.angularVelocity * offset.y, source.angularVelocity * offset.x);
    const radial = length(offset) > 0 ? scale(offset, 1 / length(offset)) : vec(0, 0);
    const burst = scale(add(scale(radial, 0.6), scale(awayDir, 0.4 + rng() * 0.6)), TUNING.shard.burstSpeed * (0.5 + rng()));
    return {
      position: add(source.position, offset),
      angle: source.angle,
      vertices: piece.map((v) => sub(v, centroid)),
      velocity: add(add(source.velocity, spinVelocity), burst),
      angularVelocity: source.angularVelocity + (rng() - 0.5) * 2 * TUNING.shard.spin,
    };
  });
};
