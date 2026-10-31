import type { MaterialId } from '../core/materials';
import { createRng } from '../core/math';

/**
 * Material surfaces. Each texture is painted once (at 2x for sharpness) and
 * reused as a canvas pattern, so a detailed look costs one fill per body. The
 * pattern lives in the body's local space, so the grain moves with the body.
 */

type Paint = (c: CanvasRenderingContext2D, size: number, rng: () => number) => void;

const TILE = 64;
const SUPERSAMPLE = 2;

const wood: Paint = (c, s, rng) => {
  c.fillStyle = '#b9844f';
  c.fillRect(0, 0, s, s);
  // Grain: long, slightly wavy darker lines.
  for (let i = 0; i < 14; i++) {
    const y = rng() * s;
    c.strokeStyle = `rgba(110, 70, 35, ${0.25 + rng() * 0.3})`;
    c.lineWidth = 0.6 + rng() * 1.2;
    c.beginPath();
    c.moveTo(0, y);
    for (let x = 0; x <= s; x += 8) c.lineTo(x, y + Math.sin((x / s) * Math.PI * 2 + i) * 1.5);
    c.stroke();
  }
  // A knot.
  const kx = rng() * s;
  const ky = rng() * s;
  c.fillStyle = 'rgba(95, 58, 28, 0.6)';
  c.beginPath();
  c.ellipse(kx, ky, 5, 2.5, 0, 0, Math.PI * 2);
  c.fill();
};

const concrete: Paint = (c, s, rng) => {
  c.fillStyle = '#8f9399';
  c.fillRect(0, 0, s, s);
  // Aggregate: light and dark specks.
  for (let i = 0; i < 260; i++) {
    const light = rng() < 0.5;
    c.fillStyle = light ? `rgba(200, 203, 208, ${rng() * 0.35})` : `rgba(60, 63, 68, ${rng() * 0.35})`;
    c.fillRect(rng() * s, rng() * s, 1 + rng() * 1.5, 1 + rng() * 1.5);
  }
  // Formwork tie holes.
  c.fillStyle = 'rgba(55, 58, 63, 0.55)';
  for (const [x, y] of [[16, 16], [48, 48]] as const) {
    c.beginPath();
    c.arc(x, y, 1.6, 0, Math.PI * 2);
    c.fill();
  }
};

const brick: Paint = (c, s, rng) => {
  c.fillStyle = '#cdc5b8'; // mortar
  c.fillRect(0, 0, s, s);
  const bw = 16;
  const bh = 8;
  for (let row = 0; row * bh < s; row++) {
    const offset = row % 2 === 0 ? 0 : bw / 2;
    for (let x = -bw; x < s + bw; x += bw) {
      const r = 150 + Math.floor(rng() * 30);
      const g = 70 + Math.floor(rng() * 20);
      c.fillStyle = `rgb(${r}, ${g}, ${50 + Math.floor(rng() * 15)})`;
      c.fillRect(x + offset + 0.8, row * bh + 0.8, bw - 1.6, bh - 1.6);
    }
  }
};

const metal: Paint = (c, s, rng) => {
  const g = c.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, '#6b7783');
  g.addColorStop(0.5, '#56616c');
  g.addColorStop(1, '#4a545e');
  c.fillStyle = g;
  c.fillRect(0, 0, s, s);
  // Brushed streaks.
  for (let i = 0; i < 30; i++) {
    c.fillStyle = `rgba(255, 255, 255, ${rng() * 0.05})`;
    c.fillRect(0, rng() * s, s, 1);
  }
};

const PAINTS: Partial<Record<MaterialId, Paint>> = { wood, concrete, brick, metal, vehicle: metal };

/** Corrugated card in the material's own shade, with a strip of packing tape. */
const cardboard =
  (base: string): Paint =>
  (c, s, rng) => {
    c.fillStyle = base;
    c.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 4) {
      c.fillStyle = `rgba(80, 55, 25, ${0.1 + rng() * 0.06})`;
      c.fillRect(x, 0, 1.5, s);
    }
    c.fillStyle = 'rgba(240, 225, 190, 0.45)';
    c.fillRect(0, s * 0.42, s, s * 0.16);
  };

/** Glassy ice: pale blue, frosted streaks and a few cracks. */
const ice =
  (base: string): Paint =>
  (c, s, rng) => {
    c.fillStyle = base;
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 10; i++) {
      c.fillStyle = `rgba(255, 255, 255, ${0.08 + rng() * 0.12})`;
      c.fillRect(rng() * s, 0, 2 + rng() * 5, s);
    }
    c.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    c.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      let x = rng() * s;
      let y = rng() * s;
      c.beginPath();
      c.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (rng() - 0.5) * 18;
        y += (rng() - 0.5) * 18;
        c.lineTo(x, y);
      }
      c.stroke();
    }
  };

/** Dressed stone: courses of blocks in the base colour, fine joints and a little grit. */
const stone =
  (base: string, joint: string): Paint =>
  (c, s, rng) => {
    c.fillStyle = joint;
    c.fillRect(0, 0, s, s);
    const course = s / 4;
    for (let row = 0; row < 4; row++) {
      const offset = row % 2 === 0 ? 0 : s / 4;
      for (let x = -s / 2; x < s; x += s / 2) {
        c.fillStyle = base;
        c.fillRect(x + offset + 1, row * course + 1, s / 2 - 2, course - 2);
      }
    }
    for (let i = 0; i < 120; i++) {
      c.fillStyle = `rgba(0, 0, 0, ${rng() * 0.12})`;
      c.fillRect(rng() * s, rng() * s, 1, 1);
    }
  };

/** Brick in a range of shades from `[r, g, b]`, plus `spread` per channel, laid in stretcher bond. */
const tintedBrick =
  (mortar: string, rgb: readonly [number, number, number], spread: number): Paint =>
  (c, s, rng) => {
    c.fillStyle = mortar;
    c.fillRect(0, 0, s, s);
    const bw = 16;
    const bh = 8;
    for (let row = 0; row * bh < s; row++) {
      const offset = row % 2 === 0 ? 0 : bw / 2;
      for (let x = -bw; x < s + bw; x += bw) {
        const v = (k: number) => Math.min(255, (rgb[k] ?? 0) + Math.floor(rng() * spread));
        c.fillStyle = `rgb(${v(0)}, ${v(1)}, ${v(2)})`;
        c.fillRect(x + offset + 0.8, row * bh + 0.8, bw - 1.6, bh - 1.6);
      }
    }
  };

/** Polished marble: a pale ground with soft wandering veins. */
const marble =
  (base: string, vein: string): Paint =>
  (c, s, rng) => {
    c.fillStyle = base;
    c.fillRect(0, 0, s, s);
    c.strokeStyle = vein;
    for (let i = 0; i < 5; i++) {
      c.lineWidth = 0.5 + rng() * 1.5;
      c.globalAlpha = 0.25 + rng() * 0.35;
      let x = rng() * s;
      let y = 0;
      c.beginPath();
      c.moveTo(x, y);
      while (y < s) {
        x += (rng() - 0.5) * 10;
        y += 4 + rng() * 6;
        c.lineTo(x, y);
      }
      c.stroke();
    }
    c.globalAlpha = 1;
  };

/** Lacquer: a deep glossy colour with a soft band of shine. */
const lacquer =
  (base: string, shine: string): Paint =>
  (c, s) => {
    c.fillStyle = base;
    c.fillRect(0, 0, s, s);
    const g = c.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, 'rgba(255, 255, 255, 0)');
    g.addColorStop(0.45, shine);
    g.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  };

/** Glazed tiles: square tiles with a four-petal motif in the accent colour. */
const tile =
  (base: string, accent: string, grout: string): Paint =>
  (c, s) => {
    c.fillStyle = grout;
    c.fillRect(0, 0, s, s);
    const t = s / 2;
    for (let y = 0; y < s; y += t) {
      for (let x = 0; x < s; x += t) {
        c.fillStyle = base;
        c.fillRect(x + 1, y + 1, t - 2, t - 2);
        c.fillStyle = accent;
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
          c.beginPath();
          c.ellipse(x + t / 2 + dx * 6, y + t / 2 + dy * 6, dx === 0 ? 3 : 5, dx === 0 ? 5 : 3, 0, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
  };

/** Concrete in spray paint: grey ground with bright blobs and drips. */
const graffiti =
  (base: string, colours: readonly string[]): Paint =>
  (c, s, rng) => {
    c.fillStyle = base;
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 6; i++) {
      c.fillStyle = colours[Math.floor(rng() * colours.length)] ?? '#ffffff';
      c.globalAlpha = 0.55 + rng() * 0.35;
      const x = rng() * s;
      const y = rng() * s;
      c.beginPath();
      c.arc(x, y, 5 + rng() * 9, 0, Math.PI * 2);
      c.fill();
      c.fillRect(x - 1, y, 2, 6 + rng() * 12);
    }
    c.globalAlpha = 1;
  };

/** Theme surfaces for structural materials; vehicles and glass keep their real look. */
const THEMES: Readonly<Record<string, Partial<Record<MaterialId, Paint>>>> = {
  'theme:cardboard': {
    wood: cardboard('#c9a46b'),
    brick: cardboard('#b98a62'),
    concrete: cardboard('#a99f8f'),
    metal: cardboard('#8d8476'),
  },
  'theme:ice': {
    wood: ice('#bfe3f2'),
    brick: ice('#a9d6ec'),
    concrete: ice('#9ccbe4'),
    metal: ice('#86b9d8'),
  },
  // City sets (content/workshop.ts).
  'theme:ankara': {
    wood: stone('#c9a19a', '#9c7a74'),
    brick: stone('#b98d86', '#8c6a64'),
    concrete: stone('#a88a85', '#7f6762'),
    metal: stone('#8d7471', '#685452'),
  },
  'theme:paris': {
    wood: stone('#e8dcc2', '#bfb294'),
    brick: stone('#ddd0b3', '#b3a689'),
    concrete: stone('#d4c6a6', '#a99b7d'),
    metal: stone('#9aa3a8', '#6e777c'),
  },
  'theme:london': {
    wood: tintedBrick('#cfc8b6', [200, 168, 100], 30),
    brick: tintedBrick('#cfc8b6', [185, 150, 85], 30),
    concrete: tintedBrick('#bdb6a5', [165, 140, 95], 25),
    metal: tintedBrick('#9c968a', [120, 110, 95], 20),
  },
  'theme:rome': {
    wood: marble('#f2efe8', '#8a8478'),
    brick: marble('#efe6dc', '#a07a5a'),
    concrete: marble('#e6e3dc', '#6e6a62'),
    metal: marble('#c9cdd2', '#5c636b'),
  },
  'theme:tokyo': {
    wood: lacquer('#b3261e', 'rgba(255, 255, 255, 0.35)'),
    brick: lacquer('#8f1d18', 'rgba(255, 255, 255, 0.3)'),
    concrete: lacquer('#1d1a1a', 'rgba(255, 255, 255, 0.25)'),
    metal: lacquer('#2b2626', 'rgba(255, 220, 160, 0.3)'),
  },
  'theme:istanbul': {
    wood: tile('#f5f2ea', '#2a8fb0', '#d6d0c2'),
    brick: tile('#2a8fb0', '#f5f2ea', '#1f6f88'),
    concrete: tile('#e9f3f2', '#c0392b', '#c6d3d2'),
    metal: tile('#1f5f7a', '#4fc1c9', '#173f52'),
  },
  'theme:berlin': {
    wood: graffiti('#8f9399', ['#f05bd8', '#36e3f0', '#ffe600']),
    brick: graffiti('#7f8389', ['#ff3f3f', '#ffe600', '#4cb36a']),
    concrete: graffiti('#9a9ea4', ['#7c6cf0', '#36e3f0', '#ffffff']),
    metal: graffiti('#5d646c', ['#f2b134', '#f05bd8']),
  },
  'theme:madrid': {
    wood: stone('#c8714a', '#9a5235'),
    brick: tintedBrick('#e0c9b0', [190, 95, 60], 25),
    concrete: stone('#d48a5f', '#a86845'),
    metal: stone('#9b5f45', '#734331'),
  },
  'theme:newyork': {
    wood: stone('#7a4a3a', '#5a3428'),
    brick: tintedBrick('#b8aa98', [120, 60, 45], 25),
    concrete: stone('#8a5a48', '#634034'),
    metal: stone('#4b4f55', '#33363b'),
  },
};

/** Every block theme that has its own surfaces, for checking the catalogue against. */
export const BLOCK_THEME_IDS: readonly string[] = Object.keys(THEMES);

let theme = 'theme:standard';

/** Selects the block theme used for every fill from now on. Unknown themes draw real materials. */
export const setBlockTheme = (id: string): void => {
  theme = id;
};

const patterns = new Map<string, CanvasPattern | null>();

const patternFor = (c: CanvasRenderingContext2D, material: MaterialId): CanvasPattern | null => {
  const themed = THEMES[theme]?.[material];
  const key = themed ? `${theme}:${material}` : material;
  if (patterns.has(key)) return patterns.get(key) ?? null;
  const paint = themed ?? PAINTS[material];
  let pattern: CanvasPattern | null = null;
  if (paint) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TILE * SUPERSAMPLE;
    const tc = canvas.getContext('2d');
    if (tc) {
      tc.scale(SUPERSAMPLE, SUPERSAMPLE);
      paint(tc, TILE, createRng(material.length * 7919));
      pattern = c.createPattern(canvas, 'repeat');
      pattern?.setTransform(new DOMMatrix().scale(1 / SUPERSAMPLE));
    }
  }
  patterns.set(key, pattern);
  return pattern;
};

/** Fills the current path (in the body's local space) with the material's surface. */
export const fillMaterial = (
  c: CanvasRenderingContext2D,
  material: MaterialId,
  fallback: string,
  /** Rotate the texture 90° (grain along a vertical member). */
  upright: boolean,
): void => {
  const pattern = patternFor(c, material);
  if (!pattern) {
    c.fillStyle = fallback;
    c.fill();
    return;
  }
  if (upright) {
    c.save();
    c.rotate(Math.PI / 2);
    c.fillStyle = pattern;
    c.fill(); // the path was built before the rotation, so it stays put
    c.restore();
  } else {
    c.fillStyle = pattern;
    c.fill();
  }
};

/** Light from the top-left: a highlight along the top edge and a shadow along the bottom. */
export const bevel = (c: CanvasRenderingContext2D, w: number, h: number): void => {
  const edge = Math.min(4, Math.min(w, h) * 0.18);
  c.fillStyle = 'rgba(255, 255, 255, 0.16)';
  c.fillRect(-w / 2, -h / 2, w, edge);
  c.fillStyle = 'rgba(0, 0, 0, 0.22)';
  c.fillRect(-w / 2, h / 2 - edge, w, edge);
  c.fillStyle = 'rgba(0, 0, 0, 0.1)';
  c.fillRect(w / 2 - edge, -h / 2, edge, h);
};

/** Glass: a dark frame, a tinted pane with a reflection streak, mullions on wide panes. */
export const glassPane = (c: CanvasRenderingContext2D, w: number, h: number): void => {
  c.fillStyle = '#2b3542';
  c.fillRect(-w / 2, -h / 2, w, h);
  const f = Math.min(3, Math.min(w, h) * 0.2);
  const g = c.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  g.addColorStop(0, 'rgba(175, 215, 235, 0.85)');
  g.addColorStop(1, 'rgba(110, 160, 190, 0.85)');
  c.fillStyle = g;
  c.fillRect(-w / 2 + f, -h / 2 + f, w - 2 * f, h - 2 * f);
  c.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(-w / 2 + f + 2, h / 2 - f - 2);
  c.lineTo(-w / 2 + f + Math.min(w, h) * 0.5, -h / 2 + f + 2);
  c.stroke();
  c.fillStyle = '#2b3542';
  const long = w >= h;
  const span = long ? w : h;
  for (let at = 40; at < span - 20; at += 40) {
    if (long) c.fillRect(-w / 2 + at - 1, -h / 2, 2, h);
    else c.fillRect(-w / 2, -h / 2 + at - 1, w, 2);
  }
};

/** Steel members read as I-beams: dark flanges along the long edges, rivets along them. */
export const steelBeam = (c: CanvasRenderingContext2D, w: number, h: number): void => {
  const long = w >= h;
  const t = Math.min(4, (long ? h : w) * 0.25);
  c.fillStyle = 'rgba(25, 30, 36, 0.55)';
  if (long) {
    c.fillRect(-w / 2, -h / 2, w, t);
    c.fillRect(-w / 2, h / 2 - t, w, t);
  } else {
    c.fillRect(-w / 2, -h / 2, t, h);
    c.fillRect(w / 2 - t, -h / 2, t, h);
  }
  c.fillStyle = '#a8b2bc';
  const span = long ? w : h;
  for (let at = 7; at < span - 4; at += 14) {
    for (const side of [-1, 1]) {
      c.beginPath();
      if (long) c.arc(-w / 2 + at, side * (h / 2 - t / 2), 1.1, 0, Math.PI * 2);
      else c.arc(side * (w / 2 - t / 2), -h / 2 + at, 1.1, 0, Math.PI * 2);
      c.fill();
    }
  }
};
