import type { AchievementId } from '../../core/achievements';
import type { FailureReason } from '../../core/scoring';
import type { PlacementError } from '../../core/session';

/** Turkish: the source language. Tone: a professional demolition crew; short, factual, a little dry. */
export const tr = {
  subtitle: 'KONTROLLÜ YIKIM',
  tagline: 'Doğru yere doğru şarj. Gerisini fizik halleder.',
  play: 'Operasyonlar',
  daily: 'Günlük görev',
  dailyTitle: 'Günlük görev',
  dailyInfo: (name: string, streak: number, done: boolean) =>
    `${name}${done ? ' · bugün tamam' : ''}${streak > 0 ? ` · ${streak} gün seri` : ''}`,
  dailyRule: (par: number) => `Günlük kural: yalnızca ${par} şarj. Fazlası yok.`,
  achievementsTitle: 'Başarımlar',
  achievementsCount: (n: number, total: number) => `${n} / ${total}`,
  achievementUnlocked: (titles: string) => `Başarım açıldı: ${titles}`,
  replay: 'Tekrar izle',
  replayLabel: 'TEKRAR · YAVAŞ ÇEKİM',
  settings: 'Ayarlar',
  back: 'Geri',
  cities: 'Operasyon Sahaları',
  levels: 'Görevler',
  site: (n: number) => `SAHA ${String(n).padStart(2, '0')}`,
  mission: (n: number) => String(n).padStart(2, '0'),
  fire: 'ATEŞLE',
  retry: 'Tekrar dene',
  next: 'Sonraki görev',
  menu: 'Menü',
  charges: 'Şarj',
  delayTitle: 'Ateşleme gecikmesi (ms)',
  ms: (seconds: number) => `+${Math.round(seconds * 1000)} ms`,
  targets: 'Hedef',
  protectedLabel: 'Korunan',
  offline: 'Çevrimdışı çalışır',
  totalStars: (n: number) => `Toplam ★ ${n}`,
  best: (n: number) => `En iyi ${n}`,
  placeHint: 'Şarjı işaretli alana yerleştir.',
  carHint: 'Araç rotasında ilerliyor. Doğru anda ateşle.',
  protectedHint: 'Korunan yapılara hasar verme; sözleşme anında iptal olur.',
  comingSoon: 'Yakında',
  needsPrevious: (city: string) => `Önce ${city} tamamlanmalı`,
  needsStars: (n: number) => `${n} yıldız daha gerekli`,
  rotate: 'Yatay modda oyna',
  sfx: 'Efekt sesi',
  testSound: 'Patlama sesini dinle',
  skip: 'Atla',
  shake: 'Ekran sarsıntısı',
  flashes: 'Flaş ve parlama',
  haptics: 'Titreşim',
  languageLabel: 'Dil',
  languageAuto: 'Cihaz dili',
  achievements: {
    'first-job': { title: 'İlk Sözleşme', description: 'Bir görevi başarıyla tamamla.' },
    lean: { title: 'Tasarruf', description: 'Birden fazla şarj hakkı olan bir görevi tek şarjla bitir.' },
    chain: { title: 'Zincirleme Reaksiyon', description: 'Tek görevde üç varil patlat.' },
    traffic: { title: 'Trafik Kontrolü', description: 'Tek görevde iki aracı hurdaya çevir.' },
    clean: { title: 'Temiz İş', description: 'Korunan yapısı olan bir görevi üç yıldızla bitir.' },
    total: { title: 'Tam Yıkım', description: 'Bir görevde yapıların tamamını indir.' },
    'perfect-city': { title: 'Kusursuz Saha', description: 'Bir şehrin tüm görevlerinde üç yıldız al.' },
    'streak-3': { title: 'Düzenli Mesai', description: 'Günlük görevi üç gün üst üste kazan.' },
    'streak-7': { title: 'Haftalık Vardiya', description: 'Günlük görevi yedi gün üst üste kazan.' },
  },
  report: {
    title: 'YIKIM RAPORU',
    heading: (city: string, order: number) => `${city.toUpperCase()} · GÖREV ${String(order).padStart(2, '0')}`,
    success: 'BAŞARILI',
    failure: 'BAŞARISIZ',
    reasons: {
      'target-standing': 'Hedef ayakta kaldı.',
      'collateral-damage': 'Korunan yapı hasar gördü. Sözleşme iptal.',
    },
    cityComplete: (city: string) => `${city} sahası tamamlandı.`,
    targets: 'Hedefler',
    charges: 'Kullanılan şarj',
    par: (n: number) => `par ${n}`,
    collapse: 'Yıkım oranı',
    protectedRow: 'Korunan yapılar',
    intact: 'Hasarsız',
    damaged: (n: number) => `${n} hasarlı`,
    none: '—',
    duration: 'Süre',
    seconds: (s: number) => `${s.toFixed(1).replace('.', ',')} sn`,
    score: 'PUAN',
    newBest: 'YENİ REKOR',
    criteria: ['Hedefler indirildi', 'Par içinde kalındı', 'Yıkım bonusu'] as const,
  },
  placement: {
    'outside-zone': 'Sadece işaretli alana',
    'too-close': 'Diğer şarja çok yakın',
    'no-charges-left': 'Şarj kalmadı',
    'not-placing': '',
    'unknown-charge': '',
  },
};

/** Every language provides exactly this shape. */
export type Strings = Omit<typeof tr, 'report' | 'placement' | 'achievements'> & {
  readonly achievements: Readonly<Record<AchievementId, { readonly title: string; readonly description: string }>>;
  readonly report: Omit<typeof tr.report, 'reasons' | 'criteria'> & {
    readonly reasons: Readonly<Record<FailureReason, string>>;
    readonly criteria: readonly [string, string, string];
  };
  readonly placement: Readonly<Record<PlacementError, string>>;
};
