/**
 * Soft round sprites rendered once and reused. Drawing a cached bitmap is far
 * cheaper than building a radial gradient per particle per frame, which
 * matters on phone GPUs during big explosions (NFR-01).
 */
import { blastPalette, type Rgb } from './blast-styles';

const SIZE = 64;
const cache = new Map<string, HTMLCanvasElement>();

const make = (key: string, paint: (g: CanvasGradient) => void): HTMLCanvasElement => {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const c = canvas.getContext('2d');
  if (c) {
    const g = c.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
    paint(g);
    c.fillStyle = g;
    c.fillRect(0, 0, SIZE, SIZE);
  }
  cache.set(key, canvas);
  return canvas;
};

const rgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

/** A feathered puff of one colour: solid core, soft rim. Tint per particle with globalAlpha. */
export const puff = (hex: string): HTMLCanvasElement =>
  make(`puff${hex}`, (g) => {
    const [r, gr, b] = rgb(hex);
    g.addColorStop(0, `rgba(${r},${gr},${b},1)`);
    g.addColorStop(0.55, `rgba(${r},${gr},${b},0.7)`);
    g.addColorStop(1, `rgba(${r},${gr},${b},0)`);
  });

/** Flame sprites per blast style in a few heat steps: hot ones glow at the core, cool ones show the rim colour. */
const FLAME_STEPS = 6;
export const flame = (heat: number, style: string): HTMLCanvasElement => {
  const step = Math.max(0, Math.min(FLAME_STEPS - 1, Math.round(heat * (FLAME_STEPS - 1))));
  const h = step / (FLAME_STEPS - 1);
  const { core, mid, rim } = blastPalette(style).flame;
  const mix = (a: Rgb, b: Rgb, t: number) => a.map((v, i) => Math.round(v + ((b[i] ?? v) - v) * t)).join(', ');
  return make(`flame-${style}-${step}`, (g) => {
    g.addColorStop(0, `rgba(${mix(mid, core, h)}, 0.9)`);
    g.addColorStop(0.45, `rgba(${mix(rim, mid, 0.4 + 0.6 * h)}, 0.6)`);
    g.addColorStop(1, `rgba(${rim.join(', ')}, 0)`);
  });
};
