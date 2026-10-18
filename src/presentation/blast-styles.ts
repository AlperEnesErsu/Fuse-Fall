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

export const blastPalette = (style: string): BlastPalette => BLAST_PALETTES[style] ?? CLASSIC;
