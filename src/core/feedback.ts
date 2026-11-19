import { levelsOf, worldStars, type Campaign, type Progress } from './progress';

/**
 * A player's feedback, as plain text for the share sheet. The game never sends it:
 * the player reads it, chooses where it goes, and can delete anything first.
 *
 * Only game facts go in: version, platform kind, language, stars and wins per city,
 * where the player got stuck, lifetime totals and the accessibility settings. Nothing
 * that identifies a person or a device.
 */
export interface FeedbackContext {
  readonly version: string;
  /** 'android', 'ios' or 'web': the kind of build, not the device. */
  readonly platform: string;
  readonly language: string;
}

/** A note longer than this is cut: the share sheet is for a message, not a document. */
export const FEEDBACK_NOTE_MAX = 1000;
/** Jobs listed where the player missed most often in a row. */
const STUCK_SHOWN = 5;

export const feedbackReport = (progress: Progress, campaign: Campaign, context: FeedbackContext, note: string): string => {
  const trimmed = note.trim().slice(0, FEEDBACK_NOTE_MAX);
  // The cities the player has started, and always the first one: how far the game was played.
  const cities = campaign.worlds.flatMap((w, i) => {
    const levels = levelsOf(campaign, w.world);
    const won = levels.filter((l) => (progress.stars[l.id] ?? 0) > 0).length;
    if (levels.length === 0 || (won === 0 && i > 0)) return [];
    return [`${w.key} ${won}/${levels.length} won, ${worldStars(progress, campaign, w.world)}/${levels.length * 3} stars`];
  });
  const stuck = Object.entries(progress.stuck)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, STUCK_SHOWN)
    .map(([id, n]) => `${id} ×${n}`);
  const c = progress.career;
  const s = progress.settings;
  const on = (flag: boolean, name: string) => (flag ? [name] : []);
  const access = [...on(s.leftHanded, 'left-handed'), ...on(s.reducedMotion, 'reduced-motion'), ...on(s.largeText, 'large-text'), ...on(!s.screenShake, 'no-shake'), ...on(!s.flashes, 'no-flashes')];
  return [
    'Fuse & Fall feedback',
    '',
    trimmed.length > 0 ? trimmed : '(no note)',
    '',
    '---',
    `version ${context.version} · ${context.platform} · ${context.language}`,
    ...cities,
    `stuck on: ${stuck.length > 0 ? stuck.join(', ') : 'nothing'}`,
    `jobs ${c.jobs}, cleared ${c.cleared}, blasts ${c.blasts}, daily streak ${progress.daily.streak}`,
    `settings: ${access.length > 0 ? access.join(', ') : 'defaults'}`,
  ].join('\n');
};
