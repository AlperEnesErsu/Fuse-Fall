import { describe, expect, it } from 'vitest';
import { parseLevel } from '../src/core/level';
import { decodeLevel, decodeShared, encodeLevel, SHARED_ID } from '../src/core/share-code';
import { loadCampaign } from '../src/content/levels';

const campaign = loadCampaign();
const sample = campaign.levels.find((l) => l.id === 'w9-04');
if (!sample) throw new Error('missing sample level');

describe('share codes', () => {
  it('round-trips a mission and keeps everything that plays', async () => {
    const code = await encodeLevel(sample);
    expect(code.startsWith('FF1-')).toBe(true);
    const back = await decodeLevel(code);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    // The campaign's third-star goal stays with the campaign: a shared copy is played, never booked.
    const { mastery, ...plays } = sample;
    expect(mastery).toBeDefined();
    expect(back.value).toEqual({ ...plays, id: SHARED_ID });
  });

  it('carries a challenge alongside the mission, and still opens codes without one', async () => {
    const withChallenge = await decodeShared(await encodeLevel(sample, { charges: 1, collapse: 90, seconds: 3.2 }));
    expect(withChallenge.ok && withChallenge.value.challenge).toEqual({ charges: 1, collapse: 90, seconds: 3.2 });
    // The mission inside is the same either way: a build that knows no challenges plays it as before.
    const plain = await decodeShared(await encodeLevel(sample));
    expect(plain.ok && plain.value.challenge).toBeUndefined();
    expect(withChallenge.ok && plain.ok && withChallenge.value.level).toEqual(plain.ok && plain.value.level);
    const old = await decodeLevel(await encodeLevel(sample, { charges: 1, collapse: 90, seconds: 3.2 }));
    expect(old.ok).toBe(true);
  });

  it('drops a challenge that makes no sense, and keeps the mission', async () => {
    const tooMany = await decodeShared(await encodeLevel(sample, { charges: sample.charges.max + 1, collapse: 90, seconds: 3 }));
    expect(tooMany.ok && tooMany.value.challenge).toBeUndefined();
    expect(tooMany.ok).toBe(true);
  });

  it('gives the shared copy a neutral id, so a campaign mission keeps its progress apart', async () => {
    const back = await decodeLevel(await encodeLevel(sample));
    expect(back.ok && back.value.id).toBe(SHARED_ID);
  });

  it('is much shorter than the level it carries', async () => {
    const code = await encodeLevel(sample);
    expect(code.length).toBeLessThan(JSON.stringify(sample).length);
  });

  it('accepts surrounding whitespace from a paste', async () => {
    const back = await decodeLevel(`  ${await encodeLevel(sample)}\n`);
    expect(back.ok).toBe(true);
  });

  it('refuses text that is not a code', async () => {
    expect(await decodeLevel('hello')).toEqual({ ok: false, error: 'format' });
    expect(await decodeLevel('FF1-%%%')).toEqual({ ok: false, error: 'format' });
    expect(await decodeLevel('FF1-AAAA')).toEqual({ ok: false, error: 'format' });
  });

  it('refuses a code that is too long', async () => {
    expect(await decodeLevel('FF1-' + 'A'.repeat(13_000))).toEqual({ ok: false, error: 'too-large' });
  });

  it('refuses a code that expands past the size limit', async () => {
    // A long run of one value compresses to almost nothing but inflates far past the cap.
    const bomb = await (async () => {
      const raw = new Uint8Array(200_000);
      const out = new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw')));
      const bytes = new Uint8Array(await out.arrayBuffer());
      let s = '';
      for (const b of bytes) s += String.fromCharCode(b);
      return 'FF1-' + btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    })();
    expect(bomb.length).toBeLessThan(12_000);
    expect(await decodeLevel(bomb)).toEqual({ ok: false, error: 'too-large' });
  });

  it('refuses a valid-looking code whose level is invalid', async () => {
    const bad = { ...sample, blocks: [] };
    const bytes = new TextEncoder().encode(JSON.stringify(bad));
    const out = new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw')));
    const packed = new Uint8Array(await out.arrayBuffer());
    let s = '';
    for (const b of packed) s += String.fromCharCode(b);
    const code = 'FF1-' + btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(parseLevel(bad).ok).toBe(false);
    expect(await decodeLevel(code)).toEqual({ ok: false, error: 'invalid-level' });
  });
});

describe('pasted mission codes in play', () => {
  it('a valid code for a mission in a city that exists is a shared mission', async () => {
    const back = await decodeLevel(await encodeLevel(sample));
    expect(back.ok && campaign.worlds.some((w) => w.world === back.value.world)).toBe(true);
  });
});
