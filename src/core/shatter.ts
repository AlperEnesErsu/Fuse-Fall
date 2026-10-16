import { MATERIALS, type MaterialId } from './materials';
import { add, length, rotate, scale, sub, vec, type Vec2 } from './math';
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
  readonly w: number;
  readonly h: number;
  readonly velocity: Vec2;
  readonly angularVelocity: number;
}

/**
 * Cuts a block into the material's grid of pieces. Pieces keep the parent's
 * motion (including the tangential part of its spin) and burst outwards,
 * mostly away from `blastOrigin` when one is given.
 */
export const shatter = (source: ShatterSource, blastOrigin: Vec2 | undefined, rng: () => number): Shard[] => {
  const grid = MATERIALS[source.material].shards;
  const cols = Math.max(1, Math.min(grid.cols, Math.floor(source.w / TUNING.shard.minSize)));
  const rows = Math.max(1, Math.min(grid.rows, Math.floor(source.h / TUNING.shard.minSize)));
  const w = source.w / cols;
  const h = source.h / rows;
  const away = blastOrigin ? sub(source.position, blastOrigin) : vec(0, -1);
  const awayLen = length(away) || 1;
  const awayDir = scale(away, 1 / awayLen);
  const shards: Shard[] = [];

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const local = vec((c + 0.5) * w - source.w / 2, (r + 0.5) * h - source.h / 2);
      const offset = rotate(local, source.angle);
      // v = v_parent + ω × r
      const spinVelocity = vec(-source.angularVelocity * offset.y, source.angularVelocity * offset.x);
      const radial = length(offset) > 0 ? scale(offset, 1 / length(offset)) : vec(0, 0);
      const burst = scale(
        add(scale(radial, 0.6), scale(awayDir, 0.4 + rng() * 0.6)),
        TUNING.shard.burstSpeed * (0.5 + rng()),
      );
      shards.push({
        position: add(source.position, offset),
        angle: source.angle,
        w,
        h,
        velocity: add(add(source.velocity, spinVelocity), burst),
        angularVelocity: source.angularVelocity + (rng() - 0.5) * 2 * TUNING.shard.spin,
      });
    }
  }
  return shards;
};
