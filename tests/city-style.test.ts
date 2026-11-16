import { describe, expect, it } from 'vitest';
import { loadCampaign } from '../src/content/levels';
import { STYLED_CITIES, cityRoof, cityTrim, cityWindow, drawWindow } from '../src/presentation/city-style';
import { LANDMARK_CITIES } from '../src/presentation/landmarks';

/** A stand-in canvas that records every coordinate drawn to, so a test can ask how far a drawing reaches. */
const recorder = () => {
  const xs: number[] = [];
  const ys: number[] = [];
  let calls = 0;
  /** Inside a clip the canvas cuts strokes off at the clip's edge; what is drawn there is bounded by the clip itself. */
  let clipped = false;
  const point = (x: number, y: number) => {
    if (clipped) return;
    xs.push(x);
    ys.push(y);
  };
  const ctx = new Proxy(
    {},
    {
      get: (_t, name: string) => {
        if (name === 'fillRect' || name === 'rect')
          return (x: number, y: number, w: number, h: number) => {
            calls++;
            point(x, y);
            point(x + w, y + h);
          };
        if (name === 'moveTo' || name === 'lineTo')
          return (x: number, y: number) => {
            calls++;
            point(x, y);
          };
        if (name === 'quadraticCurveTo')
          return (_cx: number, _cy: number, x: number, y: number) => {
            calls++;
            point(x, y);
          };
        if (name === 'arc' || name === 'ellipse')
          return (x: number, y: number, r: number, r2?: number) => {
            calls++;
            point(x - r, y - (name === 'ellipse' ? (r2 ?? r) : r));
            point(x + r, y + (name === 'ellipse' ? (r2 ?? r) : r));
          };
        if (name === 'clip') return () => (clipped = true);
        if (name === 'restore') return () => (clipped = false);
        return () => undefined;
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, calls: () => calls, minX: () => Math.min(...xs), maxX: () => Math.max(...xs), minY: () => Math.min(...ys), maxY: () => Math.max(...ys) };
};

describe('city building styles', () => {
  const cities = loadCampaign().worlds.map((w) => w.key);

  it('gives every campaign city a building style and a landmark', () => {
    for (const city of cities) {
      expect(STYLED_CITIES, city).toContain(city);
      expect(LANDMARK_CITIES, city).toContain(city);
    }
  });

  // The dressing reaches a little past its block for a skyline, never far enough to mislead about where the block is.
  it.each(STYLED_CITIES.flatMap((city) => [34, 60, 120, 200].map((w) => [city, w] as const)))('%s: a roof on a %i px part stays close to it', (city, w) => {
    const r = recorder();
    expect(cityRoof(r.ctx, city, w, -20, 7)).toBe(true);
    expect(r.calls(), 'draws something').toBeGreaterThan(0);
    expect(r.minY()).toBeGreaterThanOrEqual(-20 - 24);
    expect(r.maxY()).toBeLessThanOrEqual(-20 + 2);
    expect(r.minX()).toBeGreaterThanOrEqual(-w / 2 - 10);
    expect(r.maxX()).toBeLessThanOrEqual(w / 2 + 10);
  });

  it.each(STYLED_CITIES.flatMap((city) => [62, 120, 200].map((w) => [city, w] as const)))('%s: the trim on a %i px floor stays close to it', (city, w) => {
    const r = recorder();
    cityTrim(r.ctx, city, w, -8, 8, 7);
    expect(r.calls(), 'draws something').toBeGreaterThan(0);
    expect(r.minY()).toBeGreaterThanOrEqual(-8 - 8);
    expect(r.maxY()).toBeLessThanOrEqual(8 + 16);
    expect(r.minX()).toBeGreaterThanOrEqual(-w / 2 - 4);
    expect(r.maxX()).toBeLessThanOrEqual(w / 2 + 4);
  });

  it('draws nothing for a place without a style, and falls back to plain windows', () => {
    const r = recorder();
    expect(cityRoof(r.ctx, 'atlantis', 60, 0, 1)).toBe(false);
    cityTrim(r.ctx, 'atlantis', 60, 0, 10, 1);
    expect(r.calls()).toBe(0);
    expect(cityWindow('atlantis')).toBe('plain');
  });

  it('draws every window style inside its opening, shutters and sills aside', () => {
    for (const city of STYLED_CITIES) {
      const r = recorder();
      drawWindow(r.ctx, cityWindow(city), 10, 20, 14, 18, true);
      expect(r.calls(), city).toBeGreaterThan(0);
      expect(r.minX(), city).toBeGreaterThanOrEqual(10 - 5);
      expect(r.maxX(), city).toBeLessThanOrEqual(10 + 14 + 5);
      expect(r.minY(), city).toBeGreaterThanOrEqual(20 - 3);
      expect(r.maxY(), city).toBeLessThanOrEqual(20 + 18 + 4);
    }
  });
});
