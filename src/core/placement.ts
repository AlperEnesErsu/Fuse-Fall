import { distance, type Rect, type Vec2 } from './math';

/**
 * Forgiving placement for fingers. A tap a little outside a charge zone, or
 * on top of another charge, lands on the nearest spot that is allowed
 * instead of being refused. Only a tap clearly away from every zone fails.
 */

/** How far outside a zone a tap still counts as meant for it (world px). */
export const SNAP_REACH = 48;
/** Snapped charges sit this far inside the zone edge, so they read as clearly in. */
const EDGE_INSET = 3;

/** The point of `zone` closest to `p`, kept just inside its edges. */
export const clampToZone = (zone: Rect, p: Vec2): Vec2 => {
  const inset = (lo: number, size: number, v: number) => {
    const m = Math.min(EDGE_INSET, size / 2);
    return Math.min(lo + size - m, Math.max(lo + m, v));
  };
  return { x: inset(zone.x, zone.w, p.x), y: inset(zone.y, zone.h, p.y) };
};

const inZone = (zones: readonly Rect[], p: Vec2): boolean =>
  zones.some((z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h);

/**
 * Where a charge meant for `p` should go: `p` itself when it is allowed,
 * otherwise the nearest allowed spot within reach, or undefined when none.
 * `others` are the charges already placed (minus the one being moved);
 * `spacing` is how close two charges may be.
 */
export const placementFor = (p: Vec2, zones: readonly Rect[], others: readonly Vec2[], spacing: number): Vec2 | undefined => {
  const spaced = (q: Vec2) => others.every((o) => distance(o, q) >= spacing);
  if (inZone(zones, p) && spaced(p)) return p;

  // Candidates: the tap pulled into each zone within reach, then each nudged off crowding charges.
  const candidates: Vec2[] = [];
  for (const z of zones) {
    const c = clampToZone(z, p);
    if (distance(c, p) > SNAP_REACH) continue;
    candidates.push(c);
    for (const o of others) {
      if (distance(o, c) >= spacing) continue;
      // Step out of the neighbour along the line from it to the tap (or sideways when right on top).
      const d = distance(o, c);
      const ux = d > 0.5 ? (c.x - o.x) / d : 1;
      const uy = d > 0.5 ? (c.y - o.y) / d : 0;
      for (const sign of [1, -1]) {
        candidates.push(clampToZone(z, { x: o.x + sign * ux * (spacing + 1), y: o.y + sign * uy * (spacing + 1) }));
        candidates.push(clampToZone(z, { x: o.x + sign * uy * (spacing + 1), y: o.y - sign * ux * (spacing + 1) }));
      }
    }
  }
  let best: Vec2 | undefined;
  for (const c of candidates) {
    if (!inZone(zones, c) || !spaced(c) || distance(c, p) > SNAP_REACH + spacing) continue;
    if (!best || distance(c, p) < distance(best, p)) best = c;
  }
  return best;
};
