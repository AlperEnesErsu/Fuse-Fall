import { describe, expect, it } from 'vitest';
import { FEATURE_IDS, featureCard, featuresOf, newFeatures } from '../src/content/features';
import { loadCampaign } from '../src/content/levels';
import { emptyProgress, markFeaturesSeen, parseProgress } from '../src/core/progress';

const levels = loadCampaign().levels;

describe('feature intro cards', () => {
  it('every feature turns up somewhere in the campaign, with text in both languages', () => {
    const met = new Set(levels.flatMap(featuresOf));
    for (const id of FEATURE_IDS) {
      expect(met.has(id), id).toBe(true);
      const card = featureCard(id);
      for (const t of [card.title, card.text, card.tip]) {
        expect(t.tr.length).toBeGreaterThan(0);
        expect(t.en.length).toBeGreaterThan(0);
      }
    }
  });

  it('introduces each feature once, at the first job that has it', () => {
    let progress = emptyProgress();
    const firstAt = new Map<string, string>();
    for (const l of levels) {
      const fresh = newFeatures(l, progress.seenFeatures);
      for (const id of fresh) firstAt.set(id, l.id);
      progress = markFeaturesSeen(progress, fresh);
    }
    expect(firstAt.get('roller')).toBe('w9-01');
    expect(firstAt.get('loadout')).toBe('w9-04');
    expect(firstAt.get('protected')?.startsWith('w1-')).toBe(true);
    expect(progress.seenFeatures).toHaveLength(FEATURE_IDS.length);
  });

  it('remembers seen cards across a save, and ignores junk', () => {
    const p = markFeaturesSeen(emptyProgress(), ['roller', 'roller', 'balls']);
    expect(p.seenFeatures).toEqual(['roller', 'balls']);
    const parsed = parseProgress({ ...JSON.parse(JSON.stringify(p)), seenFeatures: ['roller', 7, 'x'.repeat(40), 'Bad Id'] });
    expect(parsed.ok && parsed.value.seenFeatures).toEqual(['roller']);
  });
});
