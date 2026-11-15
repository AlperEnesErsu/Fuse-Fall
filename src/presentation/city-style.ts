/**
 * What makes a building belong to its city: the roof it wears, what hangs along its
 * floors, and how its windows are made. The blocks are the same everywhere (the physics
 * sees plain rectangles); only this dressing changes, drawn in each block's own frame so
 * it tilts and falls with the block.
 *
 * Roofs and floor trim reach a few pixels past the block they belong to. That is on
 * purpose and small: enough to give the building a skyline, not enough to mislead about
 * where the block is.
 */

type Ctx = CanvasRenderingContext2D;

export type WindowStyle = 'plain' | 'tall' | 'sash' | 'arched' | 'paper' | 'lattice' | 'awning';

interface CityStyle {
  /** Drawn above a roof part `w` wide whose top edge is at y = `top`. */
  readonly roof: (c: Ctx, w: number, top: number, seed: number) => void;
  /** Drawn along a floor slab: `top` and `bottom` are its edges. */
  readonly trim: (c: Ctx, w: number, top: number, bottom: number, seed: number) => void;
  readonly window: WindowStyle;
}

const fill = (c: Ctx, colour: string, x: number, y: number, w: number, h: number): void => {
  c.fillStyle = colour;
  c.fillRect(x, y, w, h);
};

const poly = (c: Ctx, colour: string, points: readonly (readonly [number, number])[]): void => {
  c.fillStyle = colour;
  c.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
  c.closePath();
  c.fill();
};

/** How tall a roof may stand on a part this wide: a real roof on a house, a low one on a small crate. */
const rise = (w: number, share = 0.3, max = 16): number => Math.max(5, Math.min(max, w * share));

/** A railing: a top bar and thin posts. */
const railing = (c: Ctx, colour: string, x0: number, x1: number, top: number, height: number, gap = 5): void => {
  fill(c, colour, x0, top, x1 - x0, 1.4);
  for (let x = x0; x <= x1 - 0.5; x += gap) fill(c, colour, x, top, 1, height);
};

const SLATE = '#56647a';
const SLATE_DARK = '#3d4759';
const TILE = '#b5553a';
const TILE_DARK = '#8a3d2a';
const IRON = 'rgba(26, 24, 28, 0.85)';

const ankara: CityStyle = {
  // A flat roof with a parapet and the solar water tank every block of flats carries.
  roof: (c, w, top, seed) => {
    fill(c, 'rgba(60, 56, 52, 0.75)', -w / 2, top - 3, w, 3);
    if (w < 30) return;
    const x = (seed & 1 ? -1 : 1) * w * 0.2;
    fill(c, '#3a4a5c', x - 7, top - 7, 14, 4);
    fill(c, '#d9dde2', x - 5, top - 13, 10, 6);
    fill(c, 'rgba(30, 28, 26, 0.8)', x - 6, top - 7, 1.2, 4);
    fill(c, 'rgba(30, 28, 26, 0.8)', x + 5, top - 7, 1.2, 4);
  },
  // A balcony rail along the floor.
  trim: (c, w, top) => railing(c, 'rgba(235, 232, 226, 0.75)', -w / 2 + 2, w / 2 - 2, top - 6, 6, 6),
  window: 'plain',
};

const paris: CityStyle = {
  // A zinc mansard: steep grey sides, a flat top, a dormer and chimney pots.
  roof: (c, w, top) => {
    const r = rise(w, 0.34, 18);
    poly(c, SLATE, [[-w / 2, top], [-w / 2 + r * 0.45, top - r], [w / 2 - r * 0.45, top - r], [w / 2, top]]);
    fill(c, SLATE_DARK, -w / 2 + r * 0.45, top - r, w - r * 0.9, 1.6);
    if (w >= 34) {
      fill(c, '#e9e2d0', -3.5, top - r * 0.78, 7, r * 0.6);
      fill(c, '#2a2630', -2, top - r * 0.66, 4, r * 0.42);
      fill(c, '#a5553e', w / 2 - r * 0.45 - 8, top - r - 5, 3, 5);
      fill(c, '#a5553e', w / 2 - r * 0.45 - 13, top - r - 4, 3, 4);
    }
  },
  // Wrought iron along every floor.
  trim: (c, w, top) => railing(c, IRON, -w / 2 + 2, w / 2 - 2, top - 5, 5, 3.5),
  window: 'tall',
};

const london: CityStyle = {
  // A pitched slate roof and a brick chimney stack with its pots.
  roof: (c, w, top, seed) => {
    const r = rise(w, 0.28, 15);
    poly(c, SLATE_DARK, [[-w / 2 - 1, top], [0, top - r], [w / 2 + 1, top]]);
    poly(c, SLATE, [[-w / 2 - 1, top], [0, top - r], [0, top]]);
    if (w < 30) return;
    const x = (seed & 1 ? -1 : 1) * w * 0.26;
    fill(c, '#8d4a3a', x - 4, top - r - 3, 8, r * 0.75 + 3);
    fill(c, '#3a2a26', x - 5, top - r - 4.5, 10, 2);
    fill(c, '#c98a6a', x - 3, top - r - 8, 2.4, 4);
    fill(c, '#c98a6a', x + 0.8, top - r - 8, 2.4, 4);
  },
  // A stone string course.
  trim: (c, w, top, bottom) => {
    fill(c, 'rgba(236, 228, 208, 0.55)', -w / 2, bottom - 2.5, w, 2.5);
    fill(c, 'rgba(0, 0, 0, 0.25)', -w / 2, top, w, 1.2);
  },
  window: 'sash',
};

const rome: CityStyle = {
  // A low terracotta roof with deep eaves.
  roof: (c, w, top) => {
    const r = rise(w, 0.18, 9);
    poly(c, TILE, [[-w / 2 - 3, top], [-w / 2 + 3, top - r], [w / 2 - 3, top - r], [w / 2 + 3, top]]);
    c.strokeStyle = TILE_DARK;
    c.lineWidth = 0.8;
    c.beginPath();
    for (let x = -w / 2 + 2; x < w / 2; x += 4) {
      c.moveTo(x, top);
      c.lineTo(x + 1.2, top - r);
    }
    c.stroke();
    fill(c, TILE_DARK, -w / 2 - 3, top - 1.4, w + 6, 1.4);
  },
  // A washing line under the floor: Rome dries its laundry in the street.
  trim: (c, w, _top, bottom, seed) => {
    if (w < 50) return;
    c.strokeStyle = 'rgba(40, 36, 32, 0.6)';
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(-w / 2 + 6, bottom + 2);
    c.quadraticCurveTo(0, bottom + 6, w / 2 - 6, bottom + 2);
    c.stroke();
    const colours = ['#f1ece0', '#c2584a', '#5f8fb5', '#e3c064'];
    for (let i = 0; i < 4; i++) {
      const t = (i + 0.5) / 4;
      const x = -w / 2 + 6 + (w - 12) * t;
      const y = bottom + 2 + 4 * 4 * t * (1 - t) * 0.5;
      fill(c, colours[(i + seed) % colours.length] ?? '#f1ece0', x - 2.5, y, 5, 6);
    }
  },
  window: 'arched',
};

const tokyo: CityStyle = {
  // A tiled roof with wide eaves that turn up at the corners.
  roof: (c, w, top) => {
    const r = rise(w, 0.22, 11);
    const e = Math.min(8, w * 0.16);
    c.fillStyle = '#2f3540';
    c.beginPath();
    c.moveTo(-w / 2 - e, top - 2);
    c.quadraticCurveTo(-w / 2, top - 1, -w * 0.3, top - r);
    c.lineTo(w * 0.3, top - r);
    c.quadraticCurveTo(w / 2, top - 1, w / 2 + e, top - 2);
    c.lineTo(w / 2 + e, top + 1);
    c.lineTo(-w / 2 - e, top + 1);
    c.closePath();
    c.fill();
    fill(c, '#1f242c', -w * 0.3, top - r - 1.5, w * 0.6, 2);
  },
  // Paper lanterns hanging under the floor.
  trim: (c, w, _top, bottom) => {
    const n = Math.max(1, Math.floor(w / 26));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      fill(c, 'rgba(30, 26, 24, 0.7)', x - 0.4, bottom, 0.8, 2.5);
      c.fillStyle = '#d8402f';
      c.beginPath();
      c.ellipse(x, bottom + 5.5, 2.8, 3.4, 0, 0, Math.PI * 2);
      c.fill();
      fill(c, '#f4d27a', x - 1.6, bottom + 4.8, 3.2, 1);
    }
  },
  window: 'paper',
};

const istanbul: CityStyle = {
  // A red tile roof, low and broad.
  roof: (c, w, top) => {
    const r = rise(w, 0.2, 10);
    poly(c, TILE, [[-w / 2 - 3, top], [0, top - r], [w / 2 + 3, top]]);
    poly(c, TILE_DARK, [[0, top - r], [w / 2 + 3, top], [0, top]]);
    fill(c, '#6e2f22', -w / 2 - 3, top - 1.2, w + 6, 1.2);
  },
  // Timber brackets under the floor: the upper storey of an old wooden house leans out over the street.
  trim: (c, w, _top, bottom) => {
    const n = Math.max(2, Math.floor(w / 22));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 4 + ((w - 8) / (n - 1)) * i;
      poly(c, '#5b3d27', [[x - 1.6, bottom], [x + 1.6, bottom], [x + (i < n / 2 ? 5 : -5), bottom + 6], [x + (i < n / 2 ? 3 : -3), bottom + 6]]);
    }
    fill(c, '#6b4a30', -w / 2, bottom - 2, w, 2);
  },
  window: 'lattice',
};

const berlin: CityStyle = {
  // A stepped gable, rising to the middle.
  roof: (c, w, top) => {
    const r = rise(w, 0.3, 15);
    const steps = w >= 40 ? 3 : 2;
    for (let i = 0; i < steps; i++) {
      const sw = w * (1 - (i + 1) / (steps + 1));
      fill(c, i % 2 ? '#b9ad94' : '#cdc2aa', -sw / 2, top - (r / steps) * (i + 1), sw, r / steps + 0.5);
      fill(c, 'rgba(0, 0, 0, 0.25)', -sw / 2, top - (r / steps) * (i + 1), sw, 1);
    }
  },
  // A plain rendered band with a dark line: sober and square.
  trim: (c, w, top, bottom) => {
    fill(c, 'rgba(205, 194, 170, 0.6)', -w / 2, top, w, Math.min(3, (bottom - top) * 0.3));
    fill(c, 'rgba(0, 0, 0, 0.3)', -w / 2, bottom - 1.2, w, 1.2);
  },
  window: 'tall',
};

const madrid: CityStyle = {
  // A flat roof behind a stone balustrade.
  roof: (c, w, top) => {
    fill(c, '#e2d6bb', -w / 2, top - 7, w, 1.8);
    for (let x = -w / 2 + 2; x < w / 2 - 1; x += 4) fill(c, '#d3c6a8', x, top - 5.5, 1.8, 5.5);
    fill(c, '#c9bb9b', -w / 2, top - 1.2, w, 1.2);
  },
  // Striped awnings hanging under the floor.
  trim: (c, w, _top, bottom) => {
    const n = Math.max(1, Math.floor(w / 30));
    const aw = Math.min(20, (w / n) * 0.7);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      for (let s = 0; s < 5; s++) {
        poly(c, s % 2 ? '#f2ead8' : '#c8452f', [
          [x - aw / 2 + (aw / 5) * s, bottom],
          [x - aw / 2 + (aw / 5) * (s + 1), bottom],
          [x - aw / 2 - 2 + ((aw + 4) / 5) * (s + 1), bottom + 6],
          [x - aw / 2 - 2 + ((aw + 4) / 5) * s, bottom + 6],
        ]);
      }
    }
  },
  window: 'awning',
};

const newyork: CityStyle = {
  // A wooden water tank on its steel legs.
  roof: (c, w, top, seed) => {
    fill(c, 'rgba(40, 38, 36, 0.8)', -w / 2, top - 2.5, w, 2.5);
    if (w < 30) return;
    const x = (seed & 1 ? -1 : 1) * w * 0.18;
    fill(c, '#2c2a28', x - 5.5, top - 8, 1.2, 6);
    fill(c, '#2c2a28', x + 4.3, top - 8, 1.2, 6);
    fill(c, '#7a563a', x - 6.5, top - 17, 13, 9.5);
    fill(c, '#5c3f2a', x + 1.5, top - 17, 5, 9.5);
    fill(c, '#3a2a1e', x - 6.5, top - 13, 13, 1);
    poly(c, '#4a4640', [[x - 7.5, top - 17], [x, top - 21.5], [x + 7.5, top - 17]]);
  },
  // A fire escape: a landing rail and the ladder down to the next floor.
  trim: (c, w, _top, bottom) => {
    if (w < 44) return;
    railing(c, IRON, -w * 0.28, w * 0.28, bottom + 1, 5, 4);
    c.strokeStyle = IRON;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-w * 0.28, bottom + 6);
    c.lineTo(-w * 0.28 + 9, bottom + 14);
    c.moveTo(-w * 0.28 + 3, bottom + 6);
    c.lineTo(-w * 0.28 + 12, bottom + 14);
    c.stroke();
  },
  window: 'sash',
};

const STYLES: Readonly<Record<string, CityStyle>> = { ankara, paris, london, rome, tokyo, istanbul, berlin, madrid, newyork };

/** Cities with a building style of their own. */
export const STYLED_CITIES: readonly string[] = Object.keys(STYLES);

export const cityRoof = (c: Ctx, city: string, w: number, top: number, seed: number): boolean => {
  const style = STYLES[city];
  style?.roof(c, w, top, seed);
  return style !== undefined;
};

export const cityTrim = (c: Ctx, city: string, w: number, top: number, bottom: number, seed: number): void => {
  STYLES[city]?.trim(c, w, top, bottom, seed);
};

export const cityWindow = (city: string): WindowStyle => STYLES[city]?.window ?? 'plain';

/**
 * One lit window in the city's manner, in the box `x`, `y`, `ww` × `wh`.
 * `warm` picks lamp light over daylight on the glass.
 */
export const drawWindow = (c: Ctx, style: WindowStyle, x: number, y: number, ww: number, wh: number, warm: boolean): void => {
  const glass = warm ? '#ffd98a' : '#9cc4dd';
  const frame = 'rgba(28, 24, 22, 0.55)';
  if (style === 'arched') {
    const r = ww / 2;
    c.fillStyle = frame;
    c.beginPath();
    c.moveTo(x - 1.5, y + wh + 1.5);
    c.lineTo(x - 1.5, y + r);
    c.arc(x + r, y + r, r + 1.5, Math.PI, 0);
    c.lineTo(x + ww + 1.5, y + wh + 1.5);
    c.closePath();
    c.fill();
    c.fillStyle = glass;
    c.beginPath();
    c.moveTo(x, y + wh);
    c.lineTo(x, y + r);
    c.arc(x + r, y + r, r, Math.PI, 0);
    c.lineTo(x + ww, y + wh);
    c.closePath();
    c.fill();
    // Green shutters, folded back.
    fill(c, '#3f6b4c', x - 4, y + r * 0.6, 3, wh - r * 0.6);
    fill(c, '#3f6b4c', x + ww + 1, y + r * 0.6, 3, wh - r * 0.6);
    return;
  }
  fill(c, frame, x - 1.5, y - 1.5, ww + 3, wh + 3);
  if (style === 'paper') {
    // A paper screen: pale, in a fine dark grid.
    fill(c, warm ? '#f6e7c2' : '#e9e6da', x, y, ww, wh);
    c.fillStyle = 'rgba(60, 44, 30, 0.7)';
    for (let i = 1; i < 3; i++) c.fillRect(x + (ww / 3) * i - 0.4, y, 0.8, wh);
    for (let i = 1; i < 3; i++) c.fillRect(x, y + (wh / 3) * i - 0.4, ww, 0.8);
    return;
  }
  fill(c, glass, x, y, ww, wh);
  if (style === 'lattice') {
    // The wooden lattice of an old Istanbul house over the lower half of the window.
    c.save();
    c.beginPath();
    c.rect(x, y + wh / 2, ww, wh / 2);
    c.clip();
    c.strokeStyle = 'rgba(70, 46, 28, 0.85)';
    c.lineWidth = 0.7;
    c.beginPath();
    for (let d = -wh; d < ww + wh; d += 3) {
      c.moveTo(x + d, y + wh);
      c.lineTo(x + d + wh / 2, y + wh / 2);
      c.moveTo(x + d, y + wh / 2);
      c.lineTo(x + d + wh / 2, y + wh);
    }
    c.stroke();
    c.restore();
    fill(c, 'rgba(70, 46, 28, 0.85)', x, y + wh / 2 - 0.6, ww, 1.2);
    return;
  }
  if (style === 'sash') {
    // Two sashes, the frame painted white.
    fill(c, 'rgba(245, 242, 234, 0.9)', x, y + wh / 2 - 0.7, ww, 1.4);
    fill(c, 'rgba(245, 242, 234, 0.9)', x + ww / 2 - 0.5, y, 1, wh);
    fill(c, 'rgba(245, 242, 234, 0.7)', x - 2, y + wh + 0.5, ww + 4, 2);
    return;
  }
  if (style === 'tall') {
    // French windows with a low iron guard.
    fill(c, 'rgba(30, 26, 22, 0.55)', x + ww / 2 - 0.5, y, 1, wh);
    for (let gx = x; gx <= x + ww; gx += 2.5) fill(c, IRON, gx, y + wh * 0.68, 0.8, wh * 0.32);
    fill(c, IRON, x - 1, y + wh * 0.68, ww + 2, 1);
    return;
  }
  if (style === 'awning') {
    fill(c, 'rgba(30, 26, 22, 0.5)', x + ww / 2 - 0.5, y, 1, wh);
    poly(c, '#c8452f', [[x - 2, y - 1.5], [x + ww + 2, y - 1.5], [x + ww + 3.5, y + wh * 0.3], [x - 3.5, y + wh * 0.3]]);
    fill(c, '#f2ead8', x + ww * 0.25, y - 1.5, ww * 0.2, wh * 0.3 + 1.5);
    fill(c, '#f2ead8', x + ww * 0.65, y - 1.5, ww * 0.2, wh * 0.3 + 1.5);
    return;
  }
  // Plain: a curtain to one side, a sill below.
  fill(c, 'rgba(120, 60, 40, 0.55)', x, y, ww * 0.35, wh);
  fill(c, 'rgba(30, 26, 22, 0.5)', x + ww / 2 - 0.5, y, 1, wh);
  fill(c, 'rgba(240, 232, 214, 0.5)', x - 2.5, y + wh + 1, ww + 5, 2);
};
