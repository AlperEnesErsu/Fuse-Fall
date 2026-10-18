import { describe, expect, it } from 'vitest';
import { SNAP_REACH, clampToZone, placementFor } from '../src/core/placement';
import { distance } from '../src/core/math';

const zone = { x: 100, y: 400, w: 120, h: 60 };
const SPACING = 26;

describe('forgiving placement', () => {
  it('keeps a tap that is already allowed exactly where it is', () => {
    expect(placementFor({ x: 150, y: 430 }, [zone], [], SPACING)).toEqual({ x: 150, y: 430 });
  });

  it('pulls a tap just outside the zone onto its edge', () => {
    const p = placementFor({ x: 90, y: 380 }, [zone], [], SPACING);
    expect(p).toBeDefined();
    if (!p) return;
    expect(p.x).toBeGreaterThan(zone.x);
    expect(p.y).toBeGreaterThan(zone.y);
    expect(distance(p, { x: 103, y: 403 })).toBeLessThan(1);
  });

  it('refuses a tap clearly away from every zone', () => {
    expect(placementFor({ x: 150, y: 400 - SNAP_REACH - 10 }, [zone], [], SPACING)).toBeUndefined();
  });

  it('slides a tap on top of a charge to the nearest free spot beside it', () => {
    const other = { x: 160, y: 430 };
    const p = placementFor({ x: 162, y: 431 }, [zone], [other], SPACING);
    expect(p).toBeDefined();
    if (!p) return;
    expect(distance(p, other)).toBeGreaterThanOrEqual(SPACING);
    expect(distance(p, { x: 162, y: 431 })).toBeLessThan(SPACING + 2);
  });

  it('picks the nearer of two zones', () => {
    const right = { x: 300, y: 400, w: 60, h: 60 };
    const p = placementFor({ x: 285, y: 430 }, [zone, right], [], SPACING);
    expect(p?.x).toBeGreaterThanOrEqual(300);
  });

  it('gives up when a small zone is full', () => {
    const tiny = { x: 0, y: 0, w: 20, h: 20 };
    expect(placementFor({ x: 10, y: 10 }, [tiny], [{ x: 10, y: 10 }], SPACING)).toBeUndefined();
  });

  it('keeps clamped points inside even a sliver of a zone', () => {
    const sliver = { x: 0, y: 0, w: 4, h: 100 };
    const c = clampToZone(sliver, { x: -50, y: 50 });
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.x).toBeLessThanOrEqual(4);
  });
});
