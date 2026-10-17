import { describe, expect, it } from 'vitest';
import { WORLD } from '../src/core/level';
import { loadCampaign } from '../src/content/levels';
import { SANDBOX_TEMPLATES, sandboxLevel } from '../src/content/sandbox';
import { focusOf } from '../src/presentation/camera';

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
