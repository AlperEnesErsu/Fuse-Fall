import { describe, expect, it } from 'vitest';
import { FEEDBACK_NOTE_MAX, feedbackReport } from '../src/core/feedback';
import { emptyProgress, recordCampaignRun, recordStars, updateSettings } from '../src/core/progress';
import { loadCampaign } from '../src/content/levels';

const campaign = loadCampaign();
const build = { version: '1.2.0', platform: 'android', language: 'tr' };

describe('feedback text', () => {
  it('carries the note and the game facts that help, and nothing else', () => {
    let p = recordStars(emptyProgress(), 'w1-01', 3);
    p = recordStars(p, 'w1-02', 2);
    for (let i = 0; i < 4; i++) p = recordCampaignRun(p, 'w1-10', false);
    p = recordCampaignRun(p, 'w1-03', false);
    p = updateSettings(p, { largeText: true });
    const text = feedbackReport(p, campaign, build, '  The bridge level is too hard.  ');
    expect(text).toContain('The bridge level is too hard.');
    expect(text).toContain('version 1.2.0 · android · tr');
    expect(text).toContain('ankara 2/10 won, 5/30 stars');
    // Most-missed first.
    expect(text).toContain('stuck on: w1-10 ×4, w1-03 ×1');
    expect(text).toContain('settings: large-text');
    // A city not started yet adds nothing.
    expect(text).not.toContain('paris');
  });

  it('says so when there is no note, and cuts a very long one', () => {
    expect(feedbackReport(emptyProgress(), campaign, build, '   ')).toContain('(no note)');
    const long = feedbackReport(emptyProgress(), campaign, build, 'x'.repeat(FEEDBACK_NOTE_MAX + 500));
    expect(long).toContain('x'.repeat(FEEDBACK_NOTE_MAX));
    expect(long).not.toContain('x'.repeat(FEEDBACK_NOTE_MAX + 1));
  });

  it('holds nothing about the person: no scrap, purchases, ads or contracts', () => {
    const text = feedbackReport(emptyProgress(), campaign, build, '');
    for (const word of ['scrap', 'purchase', 'token', 'wallet', 'ads', 'contract']) expect(text.toLowerCase()).not.toContain(word);
  });
});
