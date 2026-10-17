import type { LevelDefinition } from './level';
import { err, ok, type Result } from './result';
import type { Stars } from './scoring';
import type { WorldDefinition } from './world';

export const PROGRESS_VERSION = 1;

export interface Settings {
  readonly sfxVolume: number;
  readonly screenShake: boolean;
  readonly flashes: boolean;
  readonly haptics: boolean;
}

export interface Progress {
  readonly version: typeof PROGRESS_VERSION;
  readonly stars: Readonly<Record<string, Stars>>;
  /** Best score per level. Added after v0.2; older saves simply start empty. */
  readonly best: Readonly<Record<string, number>>;
  /** Unlocked achievement ids. */
  readonly achievements: readonly string[];
  /** Daily mission streak: the last day (YYYY-MM-DD) a daily was won, and how many days in a row. */
  readonly daily: { readonly lastWon: string | undefined; readonly streak: number };
  readonly settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  sfxVolume: 0.8,
  screenShake: true,
  flashes: true,
  haptics: true,
};

export const emptyProgress = (): Progress => ({
  version: PROGRESS_VERSION,
  stars: {},
  best: {},
  achievements: [],
  daily: { lastWon: undefined, streak: 0 },
  settings: DEFAULT_SETTINGS,
});

export interface ProgressError {
  readonly kind: 'invalid-progress';
  readonly message: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const volume = (v: unknown, fallback: number): number =>
  typeof v === 'number' && v >= 0 && v <= 1 ? v : fallback;

const flag = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/**
 * Parses saved progress. A wrong version or broken shape is an error so the
 * repository can fall back to its backup; individual bad settings fall back to defaults.
 */
export const parseProgress = (input: unknown): Result<Progress, ProgressError> => {
  if (!isRecord(input)) return err({ kind: 'invalid-progress', message: 'not an object' });
  if (input.version !== PROGRESS_VERSION) {
    return err({ kind: 'invalid-progress', message: `unsupported version ${String(input.version)}` });
  }
  if (!isRecord(input.stars)) return err({ kind: 'invalid-progress', message: 'stars missing' });
  const stars: Record<string, Stars> = {};
  for (const [id, value] of Object.entries(input.stars)) {
    if (value !== 0 && value !== 1 && value !== 2 && value !== 3) {
      return err({ kind: 'invalid-progress', message: `bad stars for ${id}` });
    }
    stars[id] = value;
  }
  const best: Record<string, number> = {};
  if (isRecord(input.best)) {
    for (const [id, value] of Object.entries(input.best)) {
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) best[id] = Math.round(value);
    }
  }
  // Fields added after the first release are optional: older saves start them empty.
  const achievements = Array.isArray(input.achievements)
    ? input.achievements.filter((a): a is string => typeof a === 'string')
    : [];
  const d = isRecord(input.daily) ? input.daily : {};
  const daily = {
    lastWon: typeof d.lastWon === 'string' && DAY.test(d.lastWon) ? d.lastWon : undefined,
    streak: typeof d.streak === 'number' && Number.isInteger(d.streak) && d.streak >= 0 ? d.streak : 0,
  };
  const s = isRecord(input.settings) ? input.settings : {};
  return ok({
    version: PROGRESS_VERSION,
    stars,
    best,
    achievements,
    daily,
    settings: {
      sfxVolume: volume(s.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
      screenShake: flag(s.screenShake, DEFAULT_SETTINGS.screenShake),
      flashes: flag(s.flashes, DEFAULT_SETTINGS.flashes),
      haptics: flag(s.haptics, DEFAULT_SETTINGS.haptics),
    },
  });
};

/** Keeps the best result; never lowers stars. */
export const recordStars = (progress: Progress, levelId: string, stars: Stars): Progress => {
  const previous = progress.stars[levelId] ?? 0;
  if (stars <= previous) return progress;
  return { ...progress, stars: { ...progress.stars, [levelId]: stars } };
};

/** Keeps the highest score; never lowers it. */
export const recordScore = (progress: Progress, levelId: string, score: number): Progress => {
  if (score <= (progress.best[levelId] ?? 0)) return progress;
  return { ...progress, best: { ...progress.best, [levelId]: score } };
};

export const unlockAchievements = (progress: Progress, ids: readonly string[]): Progress => {
  const fresh = ids.filter((id) => !progress.achievements.includes(id));
  return fresh.length === 0 ? progress : { ...progress, achievements: [...progress.achievements, ...fresh] };
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The day before a YYYY-MM-DD date, computed on the calendar (not in milliseconds, so DST cannot shift it). */
export const previousDay = (day: string): string => {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) - 1));
  return date.toISOString().slice(0, 10);
};

/** Winning a daily extends the streak if yesterday was won too; winning twice in a day changes nothing. */
export const recordDailyWin = (progress: Progress, day: string): Progress => {
  const { lastWon, streak } = progress.daily;
  if (lastWon === day) return progress;
  return { ...progress, daily: { lastWon: day, streak: lastWon === previousDay(day) ? streak + 1 : 1 } };
};

/** A streak only counts while it is unbroken: yesterday or today must have been won. */
export const currentStreak = (progress: Progress, today: string): number => {
  const { lastWon, streak } = progress.daily;
  return lastWon === today || lastWon === previousDay(today) ? streak : 0;
};

export const updateSettings = (progress: Progress, patch: Partial<Settings>): Progress => ({
  ...progress,
  settings: { ...progress.settings, ...patch },
});

export const totalStars = (progress: Progress): number =>
  Object.values(progress.stars).reduce<number>((sum, s) => sum + s, 0);

/** All content the progression rules look at. */
export interface Campaign {
  readonly worlds: readonly WorldDefinition[];
  readonly levels: readonly LevelDefinition[];
}

export type WorldStatus =
  | { readonly kind: 'open' }
  | { readonly kind: 'coming-soon' }
  | { readonly kind: 'locked'; readonly needsStars: number; readonly needsPrevious: boolean };

export const levelsOf = (campaign: Campaign, world: number): LevelDefinition[] =>
  campaign.levels.filter((l) => l.world === world).sort((a, b) => a.order - b.order);

export const worldStars = (progress: Progress, campaign: Campaign, world: number): number =>
  levelsOf(campaign, world).reduce((sum, l) => sum + (progress.stars[l.id] ?? 0), 0);

/**
 * A city opens when every level of the previous city has at least one star and
 * the player holds its star requirement. A city without levels is "coming soon".
 */
export const worldStatus = (progress: Progress, campaign: Campaign, world: number): WorldStatus => {
  const def = campaign.worlds.find((w) => w.world === world);
  if (!def || levelsOf(campaign, world).length === 0) return { kind: 'coming-soon' };
  const index = campaign.worlds.indexOf(def);
  const previous = index > 0 ? campaign.worlds[index - 1] : undefined;
  const needsPrevious =
    previous !== undefined && levelsOf(campaign, previous.world).some((l) => (progress.stars[l.id] ?? 0) === 0);
  const needsStars = Math.max(0, def.unlockStars - totalStars(progress));
  return needsPrevious || needsStars > 0 ? { kind: 'locked', needsStars, needsPrevious } : { kind: 'open' };
};

/** A level is open when its city is open and the previous level in that city has a star. */
export const isLevelUnlocked = (progress: Progress, campaign: Campaign, levelId: string): boolean => {
  const level = campaign.levels.find((l) => l.id === levelId);
  if (!level || worldStatus(progress, campaign, level.world).kind !== 'open') return false;
  const sameWorld = levelsOf(campaign, level.world);
  const previous = sameWorld[sameWorld.indexOf(level) - 1];
  return previous === undefined || (progress.stars[previous.id] ?? 0) > 0;
};
