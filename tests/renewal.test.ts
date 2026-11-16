import { describe, expect, it } from 'vitest';
import { loadCampaign } from '../src/content/levels';
import { STYLED_CITIES } from '../src/presentation/city-style';
import { RENEWAL_HEIGHT, RENEWAL_KINDS, drawHoarding, drawRenewal, paintStreet, renewalOf } from '../src/presentation/renewal';
import { recorder } from './canvas-recorder';

describe('renewed lots', () => {
  const levels = loadCampaign().levels;

  it('leaves the same thing on the same lot every time, and a mix of things across the campaign', () => {
    for (const l of levels) expect(renewalOf(l.id)).toBe(renewalOf(l.id));
    const counts = new Map(RENEWAL_KINDS.map((k) => [k, levels.filter((l) => renewalOf(l.id) === k).length]));
    for (const [kind, n] of counts) expect(n, kind).toBeGreaterThanOrEqual(levels.length / RENEWAL_KINDS.length / 2);
  });

  // A lot is drawn side by side with its neighbours on the city's card: nothing may spill onto the next one.
  it.each(STYLED_CITIES.flatMap((city) => levels.filter((l) => l.world === 1).map((l) => [city, l.id] as const)))(
    '%s, lot %s: the renewal stays on its lot',
    (city, id) => {
      for (const w of [82, 96]) {
        const r = recorder();
        drawRenewal(r.ctx, city, id, 100, 400, w);
        expect(r.calls()).toBeGreaterThan(0);
        expect(r.minX(), `${renewalOf(id)} at ${w}`).toBeGreaterThanOrEqual(100 - 0.5);
        expect(r.maxX(), `${renewalOf(id)} at ${w}`).toBeLessThanOrEqual(100 + w + 0.5);
        expect(r.minY(), `${renewalOf(id)} at ${w}`).toBeGreaterThanOrEqual(400 - RENEWAL_HEIGHT);
        expect(r.maxY(), `${renewalOf(id)} at ${w}`).toBeLessThanOrEqual(400 + 0.5);
      }
    },
  );

  it('keeps a hoarding on its lot too', () => {
    const r = recorder();
    drawHoarding(r.ctx, 100, 400, 82);
    expect(r.minX()).toBeGreaterThanOrEqual(100);
    expect(r.maxX()).toBeLessThanOrEqual(182);
    expect(r.minY()).toBeGreaterThanOrEqual(400 - RENEWAL_HEIGHT);
    expect(r.maxY()).toBeLessThanOrEqual(400);
  });

  it('lays one lot per job along the street, renewed or boarded up', () => {
    const lots = levels.filter((l) => l.world === 1).map((l, i) => ({ id: l.id, cleared: i < 4 }));
    const r = recorder();
    paintStreet(r.ctx, 'ankara', lots, 960, 480);
    expect(r.minX()).toBeGreaterThanOrEqual(0);
    expect(r.maxX()).toBeLessThanOrEqual(960);
    const none = recorder();
    paintStreet(none.ctx, 'ankara', [], 960, 480);
    expect(none.calls()).toBe(0);
  });
});
