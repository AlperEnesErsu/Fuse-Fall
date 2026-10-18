import { describe, expect, it } from 'vitest';
import {
  DRAFT_LIMITS,
  addBlock,
  addZone,
  draftProblem,
  draftToLevel,
  emptyDraft,
  removeAt,
  snap,
  type Draft,
  type DraftBlock,
} from '../src/core/editor';
import { decodeLevel, encodeLevel } from '../src/core/share-code';
import type { SolutionCharge } from '../src/core/level';

const block = (x: number, y: number, kind: DraftBlock['kind'] = 'block', w = 40, h = 40): DraftBlock => ({
  kind,
  material: 'wood',
  x,
  y,
  w,
  h,
});

const shot = (x: number, y: number): SolutionCharge => ({ x, y, delay: undefined, kind: 'standard' });

const playable = (): Draft => {
  const a = addBlock(emptyDraft(), block(500, 400, 'target'));
  if (!a.ok) throw new Error('setup');
  const b = addZone(a.value, { x: 300, y: 430, w: 120, h: 50 });
  if (!b.ok) throw new Error('setup');
  return b.value;
};

describe('draft rules', () => {
  it('places blocks, not on top of each other', () => {
    const one = addBlock(emptyDraft(), block(100, 400));
    expect(one.ok).toBe(true);
    if (!one.ok) return;
    expect(addBlock(one.value, block(120, 410))).toEqual({ ok: false, error: 'overlap' });
    expect(addBlock(one.value, block(140, 400)).ok).toBe(true); // touching is fine
  });

  it('keeps blocks inside the world, above the ground', () => {
    expect(addBlock(emptyDraft(), block(10, 10)).ok).toBe(true);
    expect(addBlock(emptyDraft(), block(-5, 400))).toEqual({ ok: false, error: 'outside' });
    expect(addBlock(emptyDraft(), block(100, 470))).toEqual({ ok: false, error: 'outside' });
  });

  it('refuses blocks that are too small or too large', () => {
    expect(addBlock(emptyDraft(), block(100, 400, 'block', 8, 40))).toEqual({ ok: false, error: 'size' });
    expect(addBlock(emptyDraft(), block(100, 400, 'block', 400, 40))).toEqual({ ok: false, error: 'size' });
  });

  it('stops at the block and zone limits', () => {
    let d = emptyDraft();
    for (let i = 0; i < DRAFT_LIMITS.blocks; i++) {
      const r = addBlock(d, block(10 + (i % 20) * 40, 300 + Math.floor(i / 20) * 50, 'block', 16, 16));
      if (!r.ok) throw new Error('setup');
      d = r.value;
    }
    expect(addBlock(d, block(900, 100))).toEqual({ ok: false, error: 'full' });
    let z = emptyDraft();
    for (let i = 0; i < DRAFT_LIMITS.zones; i++) {
      const r = addZone(z, { x: 10 + i * 100, y: 400, w: 80, h: 40 });
      if (!r.ok) throw new Error('setup');
      z = r.value;
    }
    expect(addZone(z, { x: 0, y: 300, w: 80, h: 40 })).toEqual({ ok: false, error: 'full' });
  });

  it('removes the block or zone under a tap, top-most first', () => {
    const d = playable();
    expect(removeAt(d, { x: 510, y: 430 }).blocks).toHaveLength(0);
    expect(removeAt(d, { x: 330, y: 450 }).zones).toHaveLength(0);
    expect(removeAt(d, { x: 900, y: 100 })).toBe(d);
  });

  it('snaps to a 10 px grid', () => {
    expect(snap(123)).toBe(120);
    expect(snap(127)).toBe(130);
  });
});

describe('draft to mission', () => {
  it('a draft with a target and a zone is a mission once its winning charges are known', () => {
    const level = draftToLevel(playable(), [shot(360, 455)], {
      id: 'shared',
      name: 'Benim Bölümüm',
      world: 9,
    });
    expect(level.ok).toBe(true);
    if (!level.ok) return;
    expect(level.value.blocks.some((b) => b.target)).toBe(true);
    expect(level.value.charges.max).toBe(1);
  });

  it('says what is missing before a test run', () => {
    expect(draftProblem(emptyDraft())).toBe('zone');
    expect(draftProblem({ blocks: [block(100, 400)], zones: [{ x: 0, y: 400, w: 80, h: 40 }] })).toBe('target');
    expect(draftProblem(playable())).toBeUndefined();
  });

  it('refuses a draft the level rules reject, with the rule as the reason', () => {
    // A target inside the ground strip cannot start clear of the ground.
    const bad: Draft = { blocks: [{ ...block(500, 470, 'target') }], zones: [{ x: 300, y: 430, w: 120, h: 50 }] };
    const level = draftToLevel(bad, [shot(360, 455)], {
      id: 'shared',
      name: 'x',
      world: 9,
    });
    expect(level.ok).toBe(false);
  });

  it('shares like any mission: its code plays back as the same level', async () => {
    const level = draftToLevel(playable(), [shot(360, 455)], {
      id: 'shared',
      name: 'Benim Bölümüm',
      world: 9,
    });
    if (!level.ok) throw new Error('setup');
    const back = await decodeLevel(await encodeLevel(level.value));
    expect(back.ok && back.value.name).toBe('Benim Bölümüm');
  });
});
