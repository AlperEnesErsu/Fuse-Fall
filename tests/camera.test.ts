import { describe, expect, it } from 'vitest';
import { WORLD } from '../src/core/level';
import { loadCampaign } from '../src/content/levels';
import { SANDBOX_TEMPLATES, sandboxLevel } from '../src/content/sandbox';
import { actionOf, focusOf } from '../src/presentation/camera';

describe('portrait framing', () => {
  const levels = [...loadCampaign().levels, ...SANDBOX_TEMPLATES.map((t) => sandboxLevel(t, 1))];

  // Everything the player must see or touch stays on screen when the phone is upright.
  it.each(levels.map((l) => [l.id, l] as const))('%s keeps the whole job in view', (_id, level) => {
    const { x0, x1 } = focusOf(level);
    expect(x0).toBeGreaterThanOrEqual(0);
    expect(x1).toBeLessThanOrEqual(WORLD.width);
    expect(x1 - x0).toBeGreaterThanOrEqual(Math.min(440, WORLD.width));
    // Only the part inside the world can be shown (Tokyo's viaducts run past both edges).
    const inside = (a: number, b: number) => Math.max(0, a) >= x0 - 0.5 && Math.min(WORLD.width, b) <= x1 + 0.5;
    for (const b of level.blocks) expect(inside(b.x - b.w / 2, b.x + b.w / 2), `block at ${b.x}`).toBe(true);
    for (const z of [...level.zones, ...level.dropZones]) expect(inside(z.x, z.x + z.w), `zone at ${z.x}`).toBe(true);
  });
});

describe('the closer frame for the collapse', () => {
  const levels = loadCampaign().levels;
  const framed = levels.flatMap((l) => {
    const action = actionOf(l);
    return action ? [[l.id, l, action] as const] : [];
  });

  it('has a closer frame for every campaign job, never wider than the placing frame', () => {
    expect(framed.length).toBe(levels.length);
    for (const [id, level, action] of framed) {
      const whole = focusOf(level);
      expect(action.x1 - action.x0, id).toBeLessThanOrEqual(whole.x1 - whole.x0 + 0.5);
      expect(action.x1 - action.x0, id).toBeGreaterThanOrEqual(Math.min(300, whole.x1 - whole.x0) - 0.5);
    }
  });

  // Whatever can fall, be hit or must stay safe is still on screen once the camera has moved.
  it.each(framed)('%s keeps the structure, the traffic and the site in frame', (_id, level, action) => {
    const whole = focusOf(level);
    expect(action.x0).toBeGreaterThanOrEqual(whole.x0);
    expect(action.x1).toBeLessThanOrEqual(whole.x1);
    const inside = (a: number, b: number) => Math.max(whole.x0, a) >= action.x0 - 0.5 && Math.min(whole.x1, b) <= action.x1 + 0.5;
    for (const b of level.blocks.filter((x) => !x.anchored)) {
      expect(inside(b.x - b.w / 2, b.x + b.w / 2), `block at ${b.x}`).toBe(true);
      expect(action.top, `block at ${b.x}`).toBeLessThanOrEqual(b.y - b.h / 2);
    }
    for (const b of level.barrels) expect(inside(b.x - 16, b.x + 16), `barrel at ${b.x}`).toBe(true);
    for (const c of level.cars) expect(inside(c.from, c.to), `route ${c.from}-${c.to}`).toBe(true);
    if (level.footprint) expect(inside(level.footprint.from, level.footprint.to), 'site').toBe(true);
    if (level.chargeKinds.includes('bomb')) for (const z of level.dropZones) expect(inside(z.x, z.x + z.w), 'drop zone').toBe(true);
  });

  it('holds still for smash play, where the player keeps tapping the field', () => {
    const smash = SANDBOX_TEMPLATES.map((t) => sandboxLevel(t, 1)).map((l) => ({ ...l, instantBlasts: true as const }));
    for (const l of smash) expect(actionOf(l)).toBeUndefined();
  });
});
