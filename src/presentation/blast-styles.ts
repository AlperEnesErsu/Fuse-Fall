/**
 * The look of each workshop blast style: fire, light, smoke and sparks. The
 * catalogue (content/workshop.ts) owns ids and prices; this module owns colours.
 * Unknown ids fall back to the classic look.
 */

export type Rgb = readonly [number, number, number];

export interface BlastPalette {
  /** Fireball colours from white-hot core to cooling rim. */
  readonly flame: { readonly core: Rgb; readonly mid: Rgb; readonly rim: Rgb };
  /** The light a blast throws on its surroundings. */
  readonly light: Rgb;
  /** Smoke column colour once the fire has cooled. */
  readonly smoke: string;
  readonly embers: readonly [string, string];
  /** Extra confetti thrown with every blast. */
  readonly confetti?: readonly string[];
}

const CLASSIC: BlastPalette = {
  flame: { core: [255, 245, 200], mid: [255, 150, 40], rim: [160, 40, 10] },
  light: [255, 170, 90],
  smoke: '#2a2827',
  embers: ['#ffb347', '#fff1c4'],
};

export const BLAST_PALETTES: Readonly<Record<string, BlastPalette>> = {
  classic: CLASSIC,
  thermite: {
    flame: { core: [255, 255, 255], mid: [215, 255, 225], rim: [70, 150, 90] },
    light: [220, 255, 230],
    smoke: '#3c4a3f',
    embers: ['#9dff8a', '#ffffff'],
  },
  rose: {
    flame: { core: [255, 240, 246], mid: [255, 122, 168], rim: [150, 40, 90] },
    light: [255, 150, 190],
    smoke: '#b4507a',
    embers: ['#ff9cc2', '#fff0f6'],
  },
  neon: {
    flame: { core: [232, 255, 255], mid: [54, 227, 240], rim: [90, 40, 160] },
    light: [80, 220, 255],
    smoke: '#4a2a6e',
    embers: ['#36e3f0', '#f05bd8'],
  },
  confetti: {
    ...CLASSIC,
    confetti: ['#f2b134', '#e5484d', '#3fb6a8', '#7c6cf0', '#4cb36a', '#ffffff'],
  },
  lightning: {
    flame: { core: [240, 250, 255], mid: [90, 170, 255], rim: [30, 50, 140] },
    light: [140, 200, 255],
    smoke: '#1d2846',
    embers: ['#8fd3ff', '#ffffff'],
  },
  gold: {
    flame: { core: [255, 250, 220], mid: [242, 177, 52], rim: [140, 80, 20] },
    light: [255, 211, 107],
    smoke: '#4a3c1f',
    embers: ['#ffd66b', '#fff6d0'],
    confetti: ['#ffd36b', '#f2b134', '#fff3c4', '#e0a526'],
  },
};

/** City sets (content/workshop.ts): each city's own blast. */
const CITY_PALETTES: Readonly<Record<string, BlastPalette>> = {
  'city-ankara': {
    flame: { core: [255, 255, 255], mid: [235, 50, 45], rim: [120, 10, 15] },
    light: [255, 110, 100],
    smoke: '#3a1d1f',
    embers: ['#ffffff', '#ff4a45'],
  },
  'city-paris': {
    ...CLASSIC,
    confetti: ['#2b4fb5', '#ffffff', '#e5484d'],
  },
  'city-london': {
    flame: { core: [255, 250, 225], mid: [245, 200, 90], rim: [120, 100, 60] },
    light: [255, 220, 140],
    smoke: '#7d8189',
    embers: ['#ffe08a', '#fff6dc'],
  },
  'city-rome': {
    flame: { core: [255, 210, 150], mid: [200, 40, 20], rim: [70, 10, 5] },
    light: [230, 80, 40],
    smoke: '#141212',
    embers: ['#ff6a2a', '#ffb070'],
  },
  'city-tokyo': {
    flame: { core: [255, 245, 250], mid: [255, 170, 200], rim: [170, 70, 110] },
    light: [255, 190, 215],
    smoke: '#5d3a4b',
    embers: ['#ffc4dd', '#ffffff'],
    confetti: ['#ffc4dd', '#ffe3ee', '#ff9cc2', '#ffffff'],
  },
  'city-istanbul': {
    flame: { core: [255, 250, 210], mid: [240, 70, 50], rim: [150, 30, 30] },
    light: [255, 160, 80],
    smoke: '#3b2a24',
    embers: ['#ffd23f', '#e5484d'],
    confetti: ['#e5484d', '#ffd23f', '#3fb6a8'],
  },
  'city-berlin': {
    flame: { core: [255, 235, 255], mid: [240, 60, 200], rim: [70, 20, 110] },
    light: [230, 90, 255],
    smoke: '#0d0d10',
    embers: ['#36e3f0', '#f05bd8'],
  },
  'city-madrid': {
    flame: { core: [255, 245, 200], mid: [230, 60, 30], rim: [130, 30, 10] },
    light: [255, 170, 60],
    smoke: '#3e2414',
    embers: ['#ffd36b', '#e5484d'],
    confetti: ['#c8102e', '#ffd36b'],
  },
  'city-newyork': {
    flame: { core: [255, 255, 230], mid: [255, 220, 40], rim: [200, 40, 160] },
    light: [255, 230, 120],
    smoke: '#1b1d2e',
    embers: ['#ffe600', '#ff3fa4'],
    confetti: ['#ffe600', '#ff3fa4', '#3fd0ff', '#ffffff'],
  },
};

export const blastPalette = (style: string): BlastPalette => BLAST_PALETTES[style] ?? CITY_PALETTES[style] ?? CLASSIC;

/** Every blast style that has its own look, for checking the catalogue against. */
export const BLAST_STYLE_IDS: readonly string[] = [...Object.keys(BLAST_PALETTES), ...Object.keys(CITY_PALETTES)];
