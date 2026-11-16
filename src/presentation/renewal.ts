import { hashString } from '../core/math';
import { cityRoof, cityWindow, drawWindow } from './city-style';

/**
 * What a cleared lot becomes. The company brings condemned buildings down so the city
 * can use the ground again: every job won leaves something new on its lot, shown on the
 * report and along the street on the city's card. Unfinished lots stay behind a hoarding.
 *
 * Every drawing fits the lot it is given: `x0` to `x0 + w` across, up to RENEWAL_HEIGHT
 * above `ground`, nothing below it.
 */

export type RenewalKind = 'park' | 'homes' | 'square' | 'playground';

export const RENEWAL_KINDS: readonly RenewalKind[] = ['park', 'homes', 'square', 'playground'];

/** The tallest a renewal or a hoarding stands above the ground, in world px. */
export const RENEWAL_HEIGHT = 74;

/** The same job always leaves the same thing behind. */
export const renewalOf = (levelId: string): RenewalKind =>
  RENEWAL_KINDS[hashString(`renewal:${levelId}`) % RENEWAL_KINDS.length] ?? 'park';

type Ctx = CanvasRenderingContext2D;

const fill = (c: Ctx, colour: string, x: number, y: number, w: number, h: number): void => {
  c.fillStyle = colour;
  c.fillRect(x, y, w, h);
};

const disc = (c: Ctx, colour: string, x: number, y: number, r: number): void => {
  c.fillStyle = colour;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
};

const GRASS = '#5d9a4c';
const GRASS_DARK = '#477d3a';
const PAVING = '#c9c1b0';

const tree = (c: Ctx, x: number, ground: number, size: number): void => {
  fill(c, '#6b4a30', x - size * 0.08, ground - size * 0.9, size * 0.16, size * 0.9);
  disc(c, '#3f7d3a', x, ground - size * 1.05, size * 0.48);
  disc(c, '#4e9445', x - size * 0.22, ground - size * 0.95, size * 0.32);
  disc(c, '#5fa652', x + size * 0.12, ground - size * 1.22, size * 0.28);
};

const bench = (c: Ctx, x: number, ground: number): void => {
  fill(c, '#8a5a36', x - 9, ground - 7, 18, 2.5);
  fill(c, '#8a5a36', x - 9, ground - 12, 18, 2);
  fill(c, '#2c2a28', x - 8, ground - 7, 1.5, 7);
  fill(c, '#2c2a28', x + 6.5, ground - 7, 1.5, 7);
};

const lamp = (c: Ctx, x: number, ground: number): void => {
  fill(c, '#2c2a28', x - 0.8, ground - 30, 1.6, 30);
  disc(c, '#ffe39a', x, ground - 31, 2.6);
};

const park = (c: Ctx, x0: number, ground: number, w: number, seed: number): void => {
  fill(c, GRASS, x0, ground - 4, w, 4);
  const n = Math.max(2, Math.round(w / 34));
  for (let i = 0; i < n; i++) {
    const size = 30 + ((seed >> (i + 3)) & 7);
    // The crown is the widest part (its left lobe reaches 0.54 of the size, its right 0.48): keep it on this lot.
    const x = Math.min(x0 + w - size * 0.48, Math.max(x0 + size * 0.54, x0 + (w / n) * (i + 0.5) + ((seed >> i) & 3) - 1.5));
    tree(c, x, ground - 2, size);
  }
  bench(c, x0 + w * 0.5, ground - 2);
};

const homes = (c: Ctx, x0: number, ground: number, w: number, seed: number, city: string): void => {
  // A new block of flats, dressed in the city's own manner, with a strip of garden.
  const bw = w * 0.74;
  const bh = 50;
  const bx = x0 + (w - bw) / 2;
  fill(c, GRASS_DARK, x0, ground - 3, w, 3);
  fill(c, '#e6ddca', bx, ground - bh, bw, bh);
  fill(c, 'rgba(0, 0, 0, 0.12)', bx + bw * 0.72, ground - bh, bw * 0.28, bh);
  const style = cityWindow(city);
  const cols = Math.max(2, Math.floor(bw / 18));
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < cols; col++) {
      const wx = bx + (bw / cols) * (col + 0.5) - 4.5;
      const wy = ground - bh + 7 + row * 22;
      drawWindow(c, style, wx, wy, 9, 11, ((seed >> (row * cols + col)) & 1) === 1);
    }
  }
  fill(c, '#5a3e2c', bx + bw / 2 - 4, ground - 12, 8, 12);
  c.save();
  c.translate(bx + bw / 2, 0);
  // The roof stays inside the lot: the city's roofs are drawn for the building's own width.
  cityRoof(c, city, bw, ground - bh, seed);
  c.restore();
};

const square = (c: Ctx, x0: number, ground: number, w: number): void => {
  fill(c, PAVING, x0, ground - 5, w, 5);
  c.strokeStyle = 'rgba(0, 0, 0, 0.18)';
  c.lineWidth = 0.6;
  c.beginPath();
  for (let x = x0 + 4; x < x0 + w; x += 6) {
    c.moveTo(x, ground - 5);
    c.lineTo(x, ground);
  }
  c.stroke();
  // A fountain: basin, column, the water.
  const cx = x0 + w / 2;
  fill(c, '#a99f8c', cx - 14, ground - 11, 28, 6);
  fill(c, '#7fb6d6', cx - 12, ground - 10, 24, 2.5);
  fill(c, '#a99f8c', cx - 2, ground - 24, 4, 13);
  c.strokeStyle = 'rgba(160, 205, 230, 0.9)';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(cx, ground - 24);
  c.quadraticCurveTo(cx - 8, ground - 30, cx - 10, ground - 11);
  c.moveTo(cx, ground - 24);
  c.quadraticCurveTo(cx + 8, ground - 30, cx + 10, ground - 11);
  c.stroke();
  lamp(c, x0 + 7, ground - 5);
  lamp(c, x0 + w - 7, ground - 5);
};

const playground = (c: Ctx, x0: number, ground: number, w: number): void => {
  fill(c, '#d9b56e', x0, ground - 4, w, 4);
  // A slide: ladder, platform, chute.
  const sx = x0 + w * 0.22;
  fill(c, '#d8402f', sx, ground - 28, 2, 28);
  fill(c, '#d8402f', sx + 8, ground - 28, 2, 28);
  for (let y = ground - 24; y < ground - 2; y += 5) fill(c, '#d8402f', sx, y, 10, 1.4);
  fill(c, '#3a7bbf', sx - 1, ground - 30, 12, 3);
  c.fillStyle = '#f2c230';
  c.beginPath();
  c.moveTo(sx + 10, ground - 30);
  c.lineTo(sx + 26, ground - 4);
  c.lineTo(sx + 21, ground - 4);
  c.lineTo(sx + 10, ground - 25);
  c.closePath();
  c.fill();
  // A swing: an A-frame and two seats.
  const wx = x0 + w * 0.72;
  c.strokeStyle = '#2c2a28';
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(wx - 14, ground - 4);
  c.lineTo(wx - 10, ground - 34);
  c.lineTo(wx + 10, ground - 34);
  c.lineTo(wx + 14, ground - 4);
  c.stroke();
  c.lineWidth = 0.8;
  c.beginPath();
  for (const sx2 of [wx - 5, wx + 5]) {
    c.moveTo(sx2 - 2, ground - 34);
    c.lineTo(sx2 - 2, ground - 14);
    c.moveTo(sx2 + 2, ground - 34);
    c.lineTo(sx2 + 2, ground - 14);
  }
  c.stroke();
  for (const sx2 of [wx - 5, wx + 5]) fill(c, '#3a7bbf', sx2 - 3, ground - 14, 6, 2);
};

/** Draws what lot `levelId` became, in `city`, on the ground between `x0` and `x0 + w`. */
export const drawRenewal = (c: Ctx, city: string, levelId: string, x0: number, ground: number, w: number): void => {
  const seed = hashString(`lot:${levelId}`);
  const kind = renewalOf(levelId);
  if (kind === 'park') park(c, x0, ground, w, seed);
  else if (kind === 'homes') homes(c, x0, ground, w, seed, city);
  else if (kind === 'square') square(c, x0, ground, w);
  else playground(c, x0, ground, w);
};

/** A lot still waiting for the company: a plywood hoarding, a caution band, and the condemned building's stump behind it. */
export const drawHoarding = (c: Ctx, x0: number, ground: number, w: number): void => {
  fill(c, '#4a4440', x0 + w * 0.25, ground - 44, w * 0.5, 44);
  fill(c, '#3a3532', x0 + w * 0.25, ground - 44, w * 0.5, 3);
  for (let i = 0; i < 3; i++) fill(c, '#1f1c1a', x0 + w * (0.31 + i * 0.15), ground - 36, w * 0.07, 9);
  fill(c, '#b89a6c', x0 + 1, ground - 22, w - 2, 22);
  c.strokeStyle = 'rgba(90, 70, 46, 0.6)';
  c.lineWidth = 0.7;
  c.beginPath();
  for (let x = x0 + 1 + w / 6; x < x0 + w - 1; x += w / 6) {
    c.moveTo(x, ground - 22);
    c.lineTo(x, ground);
  }
  c.stroke();
  // The caution band across the boards.
  c.save();
  c.beginPath();
  c.rect(x0 + 1, ground - 16, w - 2, 5);
  c.clip();
  fill(c, '#f2c230', x0 + 1, ground - 16, w - 2, 5);
  c.fillStyle = '#1d1b18';
  for (let x = x0 - 4; x < x0 + w; x += 7) {
    c.beginPath();
    c.moveTo(x, ground - 11);
    c.lineTo(x + 3.5, ground - 16);
    c.lineTo(x + 6, ground - 16);
    c.lineTo(x + 2.5, ground - 11);
    c.closePath();
    c.fill();
  }
  c.restore();
};

/**
 * The street along a city's card: one lot per job in campaign order, renewed where the
 * job has been won, behind a hoarding where it has not. `lots` are in world px; the
 * caller sets the transform.
 */
export const paintStreet = (c: Ctx, city: string, lots: readonly { readonly id: string; readonly cleared: boolean }[], width: number, ground: number): void => {
  if (lots.length === 0) return;
  const pitch = width / lots.length;
  const lotW = pitch * 0.86;
  lots.forEach((lot, i) => {
    const x0 = pitch * i + (pitch - lotW) / 2;
    if (lot.cleared) drawRenewal(c, city, lot.id, x0, ground, lotW);
    else drawHoarding(c, x0, ground, lotW);
  });
};
