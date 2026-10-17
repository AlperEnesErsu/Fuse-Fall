import { describe, expect, it } from 'vitest';
import { emptyProgress, parseProgress } from '../src/core/progress';
import { loadCampaign } from '../src/content/levels';
import { contentText, englishCoverage } from '../src/content/text';
import { tutorialFor, tutorialIds } from '../src/content/tutorials';
import { resolveLanguage } from '../src/presentation/strings';

const campaign = loadCampaign();

describe('English content', () => {
  it.each(campaign.levels.map((l) => [l.id, l] as const))('%s has an English name and hint', (id, level) => {
    const entry = englishCoverage.levels[id];
    expect(entry?.name).toBeTruthy();
    if (level.hint) expect(entry?.hint).toBeTruthy();
  });

  it('has every city, including the coming-soon ones', () => {
    for (const w of campaign.worlds) expect(englishCoverage.cities[w.key]?.city, w.key).toBeTruthy();
  });

  it('falls back to Turkish source text, never to blanks', () => {
    const en = contentText('en');
    const tr = contentText('tr');
    const level = campaign.levels[0];
    if (!level) throw new Error('no levels');
    expect(tr.levelName(level)).toBe(level.name);
    expect(en.levelName(level)).not.toBe('');
  });

  it('has tutorials for real missions in both languages', () => {
    for (const id of tutorialIds()) {
      expect(campaign.levels.some((l) => l.id === id), id).toBe(true);
      const tr = tutorialFor(id, 'tr') ?? [];
      const en = tutorialFor(id, 'en') ?? [];
      expect(en.map((s) => s.until)).toEqual(tr.map((s) => s.until));
      expect(en.every((s) => s.text.length > 0)).toBe(true);
    }
  });
});

describe('language choice', () => {
  it('follows the device when set to auto', () => {
    expect(resolveLanguage('auto', ['tr-TR', 'en-US'])).toBe('tr');
    expect(resolveLanguage('auto', ['de-DE', 'en-GB'])).toBe('en');
    expect(resolveLanguage('auto', [])).toBe('en');
  });

  it('respects an explicit choice', () => {
    expect(resolveLanguage('tr', ['en-US'])).toBe('tr');
    expect(resolveLanguage('en', ['tr-TR'])).toBe('en');
  });

  it('is saved, and defaults to auto for older or broken saves', () => {
    const p = { ...emptyProgress(), settings: { ...emptyProgress().settings, language: 'en' } };
    const parsed = parseProgress(JSON.parse(JSON.stringify(p)));
    expect(parsed.ok && parsed.value.settings.language).toBe('en');
    const broken = parseProgress({ ...p, settings: { ...p.settings, language: 'xx' } });
    expect(broken.ok && broken.value.settings.language).toBe('auto');
  });
});
