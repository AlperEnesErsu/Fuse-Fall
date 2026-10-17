import { levelsOf, type Campaign, type Progress } from './progress';
import type { LevelResult } from './scoring';

/** What happened in the attempt that just ended, beyond its result. */
export interface AttemptStats {
  readonly barrelsBlown: number;
  readonly carsWrecked: number;
}

export interface AchievementContext {
  readonly progress: Progress;
  readonly campaign: Campaign;
  readonly result: LevelResult;
  readonly stats: AttemptStats;
  readonly streak: number;
}

export interface AchievementDef {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly earned: (c: AchievementContext) => boolean;
}

const cityPerfect = (c: AchievementContext): boolean =>
  c.campaign.worlds.some((w) => {
    const levels = levelsOf(c.campaign, w.world);
    return levels.length > 0 && levels.every((l) => c.progress.stars[l.id] === 3);
  });

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first-job', title: 'İlk Sözleşme', description: 'Bir görevi başarıyla tamamla.', earned: (c) => c.result.success },
  {
    id: 'lean',
    title: 'Tasarruf',
    description: 'Birden fazla şarj hakkı olan bir görevi tek şarjla bitir.',
    earned: (c) => c.result.success && c.result.chargesMax > 1 && c.result.chargesUsed === 1,
  },
  {
    id: 'chain',
    title: 'Zincirleme Reaksiyon',
    description: 'Tek görevde üç varil patlat.',
    earned: (c) => c.stats.barrelsBlown >= 3,
  },
  {
    id: 'traffic',
    title: 'Trafik Kontrolü',
    description: 'Tek görevde iki aracı hurdaya çevir.',
    earned: (c) => c.result.success && c.stats.carsWrecked >= 2,
  },
  {
    id: 'clean',
    title: 'Temiz İş',
    description: 'Korunan yapısı olan bir görevi üç yıldızla bitir.',
    earned: (c) => c.result.success && c.result.protectedTotal > 0 && c.result.stars === 3,
  },
  {
    id: 'total',
    title: 'Tam Yıkım',
    description: 'Bir görevde yapıların tamamını indir.',
    earned: (c) => c.result.success && c.result.blocksTotal > 0 && c.result.collapseRatio >= 1,
  },
  { id: 'perfect-city', title: 'Kusursuz Saha', description: 'Bir şehrin tüm görevlerinde üç yıldız al.', earned: cityPerfect },
  { id: 'streak-3', title: 'Düzenli Mesai', description: 'Günlük görevi üç gün üst üste kazan.', earned: (c) => c.streak >= 3 },
  { id: 'streak-7', title: 'Haftalık Vardiya', description: 'Günlük görevi yedi gün üst üste kazan.', earned: (c) => c.streak >= 7 },
];

/** Achievements earned by this attempt that the player does not have yet. */
export const newAchievements = (c: AchievementContext): AchievementDef[] =>
  ACHIEVEMENTS.filter((a) => !c.progress.achievements.includes(a.id) && a.earned(c));
