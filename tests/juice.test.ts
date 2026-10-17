import { describe, expect, it } from 'vitest';
import { EventBus, type GameEvents } from '../src/core/events';
import { DEFAULT_SETTINGS, type Settings } from '../src/core/progress';
import { JuiceDirector } from '../src/presentation/juice';

const director = (patch: Partial<Settings>) => {
  const events = new EventBus<GameEvents>();
  const juice = new JuiceDirector(events, () => ({ ...DEFAULT_SETTINGS, ...patch }));
  events.emit('targetDown', { position: { x: 400, y: 400 }, remaining: 0 });
  return juice;
};

describe('reduced motion', () => {
  it('lets the last target fall in slow motion normally', () => {
    expect(director({}).simDelta(0.016)).toBeLessThan(0.016);
  });

  it('keeps time running evenly, with no shake or zoom', () => {
    const juice = director({ reducedMotion: true });
    expect(juice.simDelta(0.016)).toBe(0.016);
    expect(juice.shake()).toEqual({ x: 0, y: 0, angle: 0 });
    expect(juice.zoom).toBe(0);
  });
});
