import { describe, expect, it } from 'vitest';
import { LOOP_STEPS, degreeNote, keyOf, notesAt, type Mood } from '../src/presentation/music';
import cities from '../src/content/cities.json';

const loop = (mood: Mood, city?: string) => Array.from({ length: LOOP_STEPS }, (_, s) => notesAt(mood, keyOf(city), s)).flat();

describe('background music', () => {
  it('gives every city its own key, and plays only notes of that key', () => {
    const keys = new Set<string>();
    for (const c of cities as { key: string }[]) {
      const key = keyOf(c.key);
      keys.add(JSON.stringify(key));
      const pitches = new Set(key.scale.map((i) => (key.root + i) % 12));
      for (const n of loop('menu', c.key).concat(loop('plan', c.key), loop('tension', c.key))) {
        if (n.instrument !== 'hat') expect(pitches.has(((n.midi % 12) + 12) % 12)).toBe(true);
      }
    }
    expect(keys.size).toBe((cities as unknown[]).length);
  });

  it('is silent when off, ticks only under the fuse, and holds just the chord over the result', () => {
    expect(loop('off')).toEqual([]);
    expect(loop('plan', 'ankara').some((n) => n.instrument === 'hat')).toBe(false);
    expect(loop('tension', 'ankara').filter((n) => n.instrument === 'hat')).toHaveLength(LOOP_STEPS);
    expect(new Set(loop('result', 'ankara').map((n) => n.instrument))).toEqual(new Set(['pad']));
  });

  it('plays the same tune every time a loop comes round', () => {
    const key = keyOf('tokyo');
    for (let s = 0; s < LOOP_STEPS; s++) expect(notesAt('menu', key, s + LOOP_STEPS)).toEqual(notesAt('menu', key, s));
  });

  it('keeps the melody in a comfortable range above the bass', () => {
    for (const c of cities as { key: string }[]) {
      for (const n of loop('menu', c.key)) {
        if (n.instrument === 'pluck' || n.instrument === 'pad') expect(n.midi).toBeGreaterThanOrEqual(55);
        if (n.instrument === 'pluck') expect(n.midi).toBeLessThanOrEqual(86);
        // High enough for phone speakers, still under the melody.
        if (n.instrument === 'bass') expect(n.midi).toBeLessThan(55);
      }
    }
    expect(degreeNote(keyOf('ankara'), -1)).toBe(50 - 2); // one step below the root: C
  });
});
