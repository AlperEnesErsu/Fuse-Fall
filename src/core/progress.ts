import { adsToday, credit, creditPurchase, purchase, type PurchaseError, type ShopItem, type Wallet } from './economy';
import {
  advanceContracts,
  CONTRACT_KINDS,
  CONTRACTS_PER_WEEK,
  NO_CONTRACTS,
  type ContractDef,
  type ContractKind,
  type ContractProgress,
  type JobFacts,
} from './contracts';
import type { LevelDefinition } from './level';
import { err, ok, type Result } from './result';
import type { Stars } from './scoring';
import type { WorldDefinition } from './world';

export const PROGRESS_VERSION = 1;

/** `auto` follows the device language. */
export type LanguageChoice = 'auto' | 'tr' | 'en';

export interface Settings {
  readonly language: LanguageChoice;
  readonly sfxVolume: number;
  /** Background music, 0 turns it off. */
  readonly musicVolume: number;
  readonly screenShake: boolean;
  readonly flashes: boolean;
  readonly haptics: boolean;
  /** Fire and detonator on the left, charge types on the right. */
  readonly leftHanded: boolean;
  /** No slow motion, camera push-ins, shake or confetti. */
  readonly reducedMotion: boolean;
  readonly largeText: boolean;
}

export interface Progress {
  readonly version: typeof PROGRESS_VERSION;
  readonly stars: Readonly<Record<string, Stars>>;
  /** Best score per level. Added after v0.2; older saves simply start empty. */
  readonly best: Readonly<Record<string, number>>;
  /** Campaign levels won in full: only the first full win pays the clear bonus. */
  readonly cleared: Readonly<Record<string, true>>;
  /** Campaign levels attempted at least once: only the first failure pays its salvage. */
  readonly played: Readonly<Record<string, true>>;
  /** Unlocked achievement ids. */
  readonly achievements: readonly string[];
  /** Daily mission streak: the last day (YYYY-MM-DD) a daily was won, and how many days in a row. */
  readonly daily: {
    readonly lastWon: string | undefined;
    readonly streak: number;
    /** The last day a daily was attempted: only that day's first failure pays its salvage. */
    readonly lastPlayed: string | undefined;
  };
  /** Scrap: spendable balance and lifetime earnings (the career rank). */
  readonly wallet: Wallet;
  /** Workshop items bought, and the blast style in use. */
  readonly workshop: { readonly owned: readonly string[]; readonly blastStyle: string; readonly blockTheme: string };
  /** Lifetime totals for the career statistics. */
  readonly career: CareerStats;
  /** Rewarded ads watched, by day, for the daily cap. */
  readonly ads: { readonly day: string; readonly count: number };
  /** Features whose intro card the player has seen (see content/features.ts). */
  readonly seenFeatures: readonly string[];
  /** This week's contracts and how far each has come. */
  readonly contracts: ContractProgress;
  /** Store payment tokens already credited (the latest few), so a payment is never credited twice. */
  readonly purchases: readonly string[];
  /** One Shot: the best collapse (whole percent) per Free Site structure. */
  readonly oneShot: Readonly<Record<string, number>>;
  readonly settings: Settings;
}

export interface CareerStats {
  /** Jobs finished (campaign and daily), and how many of them were cleared. */
  readonly jobs: number;
  readonly cleared: number;
  /** Every blast set off, chain reactions included. */
  readonly blasts: number;
  /** Structure brought down, in px² of the 960×540 world. */
  readonly area: number;
  readonly barrels: number;
  readonly cars: number;
}

const NO_CAREER: CareerStats = { jobs: 0, cleared: 0, blasts: 0, area: 0, barrels: 0, cars: 0 };

/** The blast style and block theme everyone starts with. */
export const DEFAULT_BLAST_STYLE = 'classic';
export const DEFAULT_BLOCK_THEME = 'theme:standard';

export const DEFAULT_SETTINGS: Settings = {
  language: 'auto',
  sfxVolume: 0.8,
  musicVolume: 0.5,
  screenShake: true,
  flashes: true,
  haptics: true,
  leftHanded: false,
  reducedMotion: false,
  largeText: false,
};

export const emptyProgress = (): Progress => ({
  version: PROGRESS_VERSION,
  stars: {},
  best: {},
  cleared: {},
  played: {},
  achievements: [],
  daily: { lastWon: undefined, streak: 0, lastPlayed: undefined },
  wallet: { balance: 0, earned: 0 },
  workshop: { owned: [], blastStyle: DEFAULT_BLAST_STYLE, blockTheme: DEFAULT_BLOCK_THEME },
  oneShot: {},
  career: NO_CAREER,
  ads: { day: '', count: 0 },
  purchases: [],
  contracts: NO_CONTRACTS,
  seenFeatures: [],
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

const count = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0);

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
  const flags = (v: unknown): Record<string, true> => {
    const out: Record<string, true> = {};
    if (isRecord(v)) for (const [id, on] of Object.entries(v)) if (on === true) out[id] = true;
    return out;
  };
  const achievements = Array.isArray(input.achievements)
    ? input.achievements.filter((a): a is string => typeof a === 'string')
    : [];
  const d = isRecord(input.daily) ? input.daily : {};
  const daily = {
    lastWon: typeof d.lastWon === 'string' && DAY.test(d.lastWon) ? d.lastWon : undefined,
    streak: typeof d.streak === 'number' && Number.isInteger(d.streak) && d.streak >= 0 ? d.streak : 0,
    lastPlayed: typeof d.lastPlayed === 'string' && DAY.test(d.lastPlayed) ? d.lastPlayed : undefined,
  };
  const w = isRecord(input.wallet) ? input.wallet : {};
  const wallet = { balance: count(w.balance), earned: count(w.earned) };
  const ws = isRecord(input.workshop) ? input.workshop : {};
  const owned = Array.isArray(ws.owned) ? ws.owned.filter((id): id is string => typeof id === 'string') : [];
  // Whether a saved style id still exists is the catalogue's call, made where it is applied.
  const workshop = {
    owned,
    blastStyle: typeof ws.blastStyle === 'string' ? ws.blastStyle : DEFAULT_BLAST_STYLE,
    blockTheme: typeof ws.blockTheme === 'string' ? ws.blockTheme : DEFAULT_BLOCK_THEME,
  };
  const oneShot: Record<string, number> = {};
  if (isRecord(input.oneShot)) {
    for (const [id, value] of Object.entries(input.oneShot)) {
      if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100) oneShot[id] = value;
    }
  }
  const c = isRecord(input.career) ? input.career : {};
  const career: CareerStats = {
    jobs: count(c.jobs),
    cleared: count(c.cleared),
    blasts: count(c.blasts),
    area: count(c.area),
    barrels: count(c.barrels),
    cars: count(c.cars),
  };
  const a = isRecord(input.ads) ? input.ads : {};
  const ads = { day: typeof a.day === 'string' && DAY.test(a.day) ? a.day : '', count: count(a.count) };
  const purchases = Array.isArray(input.purchases)
    ? input.purchases.filter((t): t is string => typeof t === 'string' && t.length > 0 && t.length <= MAX_TOKEN).slice(-KEPT_PURCHASES)
    : [];
  const k = isRecord(input.contracts) ? input.contracts : {};
  const kinds = Array.isArray(k.kinds)
    ? [...new Set(k.kinds.filter((x): x is ContractKind => (CONTRACT_KINDS as readonly unknown[]).includes(x)))].slice(0, CONTRACTS_PER_WEEK)
    : [];
  const savedCounts = isRecord(k.counts) ? k.counts : {};
  const contractCounts: Partial<Record<ContractKind, number>> = {};
  for (const kind of kinds) contractCounts[kind] = count(savedCounts[kind]);
  const contracts: ContractProgress =
    typeof k.week === 'string' && /^\d{4}-W\d{2}$/.test(k.week) && kinds.length > 0 ? { week: k.week, kinds, counts: contractCounts } : NO_CONTRACTS;
  const s = isRecord(input.settings) ? input.settings : {};
  return ok({
    version: PROGRESS_VERSION,
    stars,
    best,
    // Saves from before these records: every level with a star counts as cleared and played,
    // so an old win does not pay its first-clear bonus a second time.
    cleared: isRecord(input.cleared) ? flags(input.cleared) : Object.fromEntries(Object.entries(stars).filter(([, s]) => s > 0).map(([id]) => [id, true as const])),
    played: isRecord(input.played) ? flags(input.played) : Object.fromEntries([...Object.keys(stars), ...Object.keys(best)].map((id) => [id, true as const])),
    achievements,
    daily,
    wallet,
    workshop,
    oneShot,
    career,
    ads,
    purchases,
    contracts,
    seenFeatures: Array.isArray(input.seenFeatures)
      ? [...new Set(input.seenFeatures.filter((f): f is string => typeof f === 'string' && /^[a-z-]{1,24}$/.test(f)))].slice(0, 64)
      : [],
    settings: {
      language: s.language === 'tr' || s.language === 'en' || s.language === 'auto' ? s.language : DEFAULT_SETTINGS.language,
      sfxVolume: volume(s.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
      musicVolume: volume(s.musicVolume, DEFAULT_SETTINGS.musicVolume),
      screenShake: flag(s.screenShake, DEFAULT_SETTINGS.screenShake),
      flashes: flag(s.flashes, DEFAULT_SETTINGS.flashes),
      haptics: flag(s.haptics, DEFAULT_SETTINGS.haptics),
      leftHanded: flag(s.leftHanded, DEFAULT_SETTINGS.leftHanded),
      reducedMotion: flag(s.reducedMotion, DEFAULT_SETTINGS.reducedMotion),
      largeText: flag(s.largeText, DEFAULT_SETTINGS.largeText),
    },
  });
};

/** Keeps the best result; never lowers stars. */
export const recordStars = (progress: Progress, levelId: string, stars: Stars): Progress => {
  const previous = progress.stars[levelId] ?? 0;
  if (stars <= previous) return progress;
  return { ...progress, stars: { ...progress.stars, [levelId]: stars } };
};

/** Records a campaign run: attempted, and won in full when it was cleared. */
export const recordCampaignRun = (progress: Progress, levelId: string, cleared: boolean): Progress => ({
  ...progress,
  played: { ...progress.played, [levelId]: true },
  cleared: cleared ? { ...progress.cleared, [levelId]: true } : progress.cleared,
});

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
  return { ...progress, daily: { ...progress.daily, lastWon: day, streak: lastWon === previousDay(day) ? streak + 1 : 1 } };
};

/** Records that the day's daily was attempted. */
export const recordDailyPlayed = (progress: Progress, day: string): Progress =>
  progress.daily.lastPlayed === day ? progress : { ...progress, daily: { ...progress.daily, lastPlayed: day } };

/** A streak only counts while it is unbroken: yesterday or today must have been won. */
export const currentStreak = (progress: Progress, today: string): number => {
  const { lastWon, streak } = progress.daily;
  return lastWon === today || lastWon === previousDay(today) ? streak : 0;
};

export const earnScrap = (progress: Progress, amount: number): Progress => {
  const wallet = credit(progress.wallet, amount);
  return wallet === progress.wallet ? progress : { ...progress, wallet };
};

/** Adds one finished job to the lifetime totals. */
export const recordCareer = (
  progress: Progress,
  job: { readonly cleared: boolean; readonly blasts: number; readonly area: number; readonly barrels: number; readonly cars: number },
): Progress => {
  const c = progress.career;
  return {
    ...progress,
    career: {
      jobs: c.jobs + 1,
      cleared: c.cleared + Number(job.cleared),
      blasts: c.blasts + job.blasts,
      area: c.area + Math.round(job.area),
      barrels: c.barrels + job.barrels,
      cars: c.cars + job.cars,
    },
  };
};

/** Marks feature intro cards as seen, so each shows once. */
export const markFeaturesSeen = (progress: Progress, ids: readonly string[]): Progress => {
  const fresh = [...new Set(ids)].filter((id) => !progress.seenFeatures.includes(id));
  return fresh.length === 0 ? progress : { ...progress, seenFeatures: [...progress.seenFeatures, ...fresh] };
};

/** Adds a finished job to this week's contracts and pays for each one it finishes. */
export const recordContracts = (progress: Progress, week: string, job: JobFacts): { progress: Progress; finished: ContractDef[] } => {
  const advanced = advanceContracts(progress.contracts, week, totalStars(progress), job);
  const paid = advanced.finished.reduce((p, c) => earnScrap(p, c.reward), { ...progress, contracts: advanced.progress });
  return { progress: paid, finished: advanced.finished };
};

/** A rewarded ad watched today: its scrap, counted against the daily cap. */
export const rewardAd = (progress: Progress, today: string, scrap: number): Progress => ({
  ...earnScrap(progress, scrap),
  ads: { day: today, count: adsToday(progress.ads, today) + 1 },
});

/** Credited payment tokens kept: the store settles a payment long before this many more are made. */
const KEPT_PURCHASES = 20;
const MAX_TOKEN = 1024;

/** A scrap pack paid for: spendable scrap, not career earnings. A payment already credited changes nothing. */
export const addBoughtScrap = (progress: Progress, scrap: number, token: string): Progress =>
  progress.purchases.includes(token)
    ? progress
    : {
        ...progress,
        wallet: creditPurchase(progress.wallet, scrap),
        purchases: [...progress.purchases, token].slice(-KEPT_PURCHASES),
      };

export const buyItem = (progress: Progress, item: ShopItem): Result<Progress, PurchaseError> => {
  const bought = purchase(progress.wallet, progress.workshop.owned, item);
  if (!bought.ok) return bought;
  return ok({ ...progress, wallet: bought.value.wallet, workshop: { ...progress.workshop, owned: bought.value.owned } });
};

/** Keeps the best One Shot collapse for a structure; never lowers it. */
export const recordOneShot = (progress: Progress, structure: string, percent: number): Progress => {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  if (pct <= (progress.oneShot[structure] ?? -1)) return progress;
  return { ...progress, oneShot: { ...progress.oneShot, [structure]: pct } };
};

/** Puts a workshop look into use: a blast style or a block theme. */
export const equip = (progress: Progress, slot: 'blastStyle' | 'blockTheme', id: string): Progress => ({
  ...progress,
  workshop: { ...progress.workshop, [slot]: id },
});

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
