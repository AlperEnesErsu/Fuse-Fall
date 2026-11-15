/**
 * Each city's landmark, drawn as the protected neighbour of a job: the thing the
 * demolition must not touch. The drawing fills the block's own rectangle (centred on
 * the origin, `w` × `h`), because that rectangle is what the contract rule measures;
 * nothing is drawn outside it.
 */

type Ctx = CanvasRenderingContext2D;

interface Stone {
  readonly light: string;
  readonly mid: string;
  readonly dark: string;
  /** Openings: doors, arches, the shade behind columns. */
  readonly hollow: string;
  readonly roof: string;
}

const STONE: Stone = { light: '#e4dac4', mid: '#c4b89c', dark: '#8d826b', hollow: '#3b3440', roof: '#5d6b7a' };
/** A landmark that has been reached or damaged: the same building, drained and reddened. */
const HARMED: Stone = { light: '#b08f88', mid: '#93706b', dark: '#67494a', hollow: '#2a1c20', roof: '#5a4347' };

const box = (c: Ctx, x: number, y: number, w: number, h: number, fill: string): void => {
  c.fillStyle = fill;
  c.fillRect(x, y, w, h);
};

/** An opening with a round head: `x`, `y` is its top-left corner. */
const arch = (c: Ctx, x: number, y: number, w: number, h: number, fill: string): void => {
  const r = Math.min(w / 2, h);
  c.fillStyle = fill;
  c.beginPath();
  c.moveTo(x, y + h);
  c.lineTo(x, y + r);
  c.arc(x + w / 2, y + r, w / 2, Math.PI, 0);
  c.lineTo(x + w, y + h);
  c.closePath();
  c.fill();
};

const triangle = (c: Ctx, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, fill: string): void => {
  c.fillStyle = fill;
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.lineTo(x2, y2);
  c.closePath();
  c.fill();
};

/** A row of `n` columns between `x0` and `x1`, with the shade behind them. */
const colonnade = (c: Ctx, s: Stone, x0: number, x1: number, top: number, bottom: number, n: number): void => {
  box(c, x0, top, x1 - x0, bottom - top, s.hollow);
  const pitch = (x1 - x0) / n;
  const cw = pitch * 0.46;
  for (let i = 0; i < n; i++) {
    const x = x0 + pitch * i + (pitch - cw) / 2;
    box(c, x, top, cw, bottom - top, s.light);
    box(c, x + cw * 0.62, top, cw * 0.38, bottom - top, s.mid);
  }
};

type Draw = (c: Ctx, s: Stone, w: number, h: number) => void;

/** Ankara: the mausoleum. A stepped base, a colonnade all round, a heavy flat roof. */
const mausoleum: Draw = (c, s, w, h) => {
  const L = -w / 2;
  const T = -h / 2;
  box(c, L, T + h * 0.86, w, h * 0.14, s.mid);
  box(c, L + w * 0.04, T + h * 0.78, w * 0.92, h * 0.08, s.light);
  colonnade(c, s, L + w * 0.08, L + w * 0.92, T + h * 0.3, T + h * 0.78, 5);
  box(c, L + w * 0.03, T + h * 0.14, w * 0.94, h * 0.16, s.light);
  box(c, L + w * 0.03, T + h * 0.26, w * 0.94, h * 0.04, s.dark);
  box(c, L, T + h * 0.06, w, h * 0.08, s.mid);
  box(c, L + w * 0.1, T, w * 0.8, h * 0.06, s.dark);
};

/** Paris: the triumphal arch. One block, one great opening, a deep cornice. */
const triumphalArch: Draw = (c, s, w, h) => {
  const L = -w / 2;
  const T = -h / 2;
  box(c, L, T, w, h, s.light);
  box(c, L + w * 0.78, T, w * 0.22, h, s.mid);
  arch(c, L + w * 0.27, T + h * 0.36, w * 0.46, h * 0.64, s.hollow);
  box(c, L, T + h * 0.2, w, h * 0.045, s.dark);
  box(c, L, T, w, h * 0.07, s.mid);
  box(c, L, T + h * 0.07, w, h * 0.025, s.dark);
  // Reliefs on the piers.
  for (const x of [L + w * 0.05, L + w * 0.79]) box(c, x, T + h * 0.46, w * 0.16, h * 0.24, s.mid);
};

/** London: the clock tower beside its hall. */
const clockTower: Draw = (c, s, w, h) => {
  const L = -w / 2;
  const T = -h / 2;
  // The hall: long, low, with a row of tall windows.
  box(c, L, T + h * 0.62, w, h * 0.38, s.mid);
  box(c, L, T + h * 0.58, w, h * 0.05, s.dark);
  for (let i = 0; i < 4; i++) box(c, L + w * (0.06 + i * 0.1), T + h * 0.7, w * 0.045, h * 0.22, s.hollow);
  // The tower.
  const tx = L + w * 0.5;
  const tw = w * 0.42;
  box(c, tx, T + h * 0.16, tw, h * 0.84, s.light);
  box(c, tx + tw * 0.7, T + h * 0.16, tw * 0.3, h * 0.84, s.mid);
  for (let i = 0; i < 3; i++) box(c, tx + tw * (0.2 + i * 0.25), T + h * 0.5, tw * 0.1, h * 0.44, s.dark);
  box(c, tx - w * 0.02, T + h * 0.2, tw + w * 0.04, h * 0.22, s.mid);
  c.fillStyle = '#f3ecd8';
  c.beginPath();
  c.arc(tx + tw / 2, T + h * 0.31, Math.min(tw * 0.36, h * 0.09), 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = s.hollow;
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(tx + tw / 2, T + h * 0.31);
  c.lineTo(tx + tw / 2, T + h * 0.25);
  c.moveTo(tx + tw / 2, T + h * 0.31);
  c.lineTo(tx + tw * 0.68, T + h * 0.33);
  c.stroke();
  triangle(c, tx - w * 0.02, T + h * 0.2, tx + tw + w * 0.02, T + h * 0.2, tx + tw / 2, T, s.roof);
};

/** Rome: the amphitheatre. Three tiers of arches under a plain attic. */
const amphitheatre: Draw = (c, s, w, h) => {
  const L = -w / 2;
  const T = -h / 2;
  box(c, L, T, w, h, s.light);
  box(c, L, T, w, h * 0.16, s.mid);
  const tiers = 3;
  const tierH = (h * 0.84) / tiers;
  const n = Math.max(3, Math.round(w / 16));
  const pitch = w / n;
  for (let t = 0; t < tiers; t++) {
    const top = T + h * 0.16 + tierH * t;
    box(c, L, top, w, tierH * 0.12, s.dark);
    for (let i = 0; i < n; i++) arch(c, L + pitch * i + pitch * 0.22, top + tierH * 0.26, pitch * 0.56, tierH * 0.74, s.hollow);
  }
};

/** Tokyo: the pagoda. Three storeys, each under its own wide roof. */
const pagoda: Draw = (c, s, w, h) => {
  const L = -w / 2;
  const T = -h / 2;
  const roof = '#8a3229';
  box(c, -w * 0.015, T, w * 0.03, h * 0.12, s.dark);
  const storeys = 3;
  const sh = (h * 0.88) / storeys;
  for (let i = 0; i < storeys; i++) {
    const top = T + h * 0.12 + sh * i;
    const bodyW = w * (0.42 + i * 0.16);
    const eaveW = Math.min(w, bodyW + w * 0.3);
    // The roof: a wide low trapezium with turned-up corners.
    c.fillStyle = s === HARMED ? s.roof : roof;
    c.beginPath();
    c.moveTo(-eaveW / 2, top + sh * 0.3);
    c.lineTo(-bodyW * 0.42, top);
    c.lineTo(bodyW * 0.42, top);
    c.lineTo(eaveW / 2, top + sh * 0.3);
    c.lineTo(eaveW / 2 - w * 0.03, top + sh * 0.38);
    c.lineTo(-eaveW / 2 + w * 0.03, top + sh * 0.38);
    c.closePath();
    c.fill();
    box(c, -bodyW / 2, top + sh * 0.38, bodyW, sh * 0.62, s.light);
    box(c, -bodyW / 2, top + sh * 0.38, bodyW, sh * 0.1, s.dark);
    box(c, -bodyW * 0.14, top + sh * 0.56, bodyW * 0.28, sh * 0.44, s.hollow);
  }
  box(c, L, T + h * 0.97, w, h * 0.03, s.mid);
};

/** Istanbul: the stone tower. A round shaft, a gallery, a cone of a roof. */
const stoneTower: Draw = (c, s, w, h) => {
  const T = -h / 2;
  const bw = w * 0.68;
  box(c, -bw / 2, T + h * 0.34, bw, h * 0.66, s.light);
  // Round, so the far side falls into shade.
  box(c, bw * 0.18, T + h * 0.34, bw * 0.32, h * 0.66, s.mid);
  box(c, bw * 0.38, T + h * 0.34, bw * 0.12, h * 0.66, s.dark);
  for (let i = 0; i < 3; i++) box(c, -bw * 0.06, T + h * (0.52 + i * 0.14), bw * 0.12, h * 0.07, s.hollow);
  arch(c, -bw * 0.12, T + h * 0.88, bw * 0.24, h * 0.12, s.hollow);
  // The gallery and the windowed drum above it.
  box(c, -w * 0.46, T + h * 0.32, w * 0.92, h * 0.04, s.dark);
  box(c, -bw * 0.46, T + h * 0.22, bw * 0.92, h * 0.1, s.mid);
  for (let i = 0; i < 4; i++) arch(c, -bw * 0.4 + i * bw * 0.22, T + h * 0.235, bw * 0.13, h * 0.075, s.hollow);
  triangle(c, -bw * 0.5, T + h * 0.22, bw * 0.5, T + h * 0.22, 0, T + h * 0.02, s.roof);
  box(c, -w * 0.012, T, w * 0.024, h * 0.05, s.dark);
};

/** Berlin: the gate. Six columns, a deep entablature, the chariot on top. */
const gate: Draw = (c, s, w, h) => {
  const L = -w / 2;
  const T = -h / 2;
  colonnade(c, s, L + w * 0.04, L + w * 0.96, T + h * 0.4, T + h * 0.96, 6);
  box(c, L, T + h * 0.96, w, h * 0.04, s.mid);
  box(c, L, T + h * 0.26, w, h * 0.14, s.light);
  box(c, L, T + h * 0.36, w, h * 0.04, s.dark);
  box(c, L + w * 0.14, T + h * 0.16, w * 0.72, h * 0.1, s.mid);
  // The chariot: a plinth, four horses as one dark mass, the figure above them.
  box(c, -w * 0.16, T + h * 0.1, w * 0.32, h * 0.06, s.dark);
  box(c, -w * 0.03, T, w * 0.06, h * 0.1, s.dark);
};

/** Madrid: the city gate. Three arches, the middle one tallest, under a pediment. */
const cityGate: Draw = (c, s, w, h) => {
  const L = -w / 2;
  const T = -h / 2;
  box(c, L, T + h * 0.24, w, h * 0.76, s.light);
  box(c, L + w * 0.8, T + h * 0.24, w * 0.2, h * 0.76, s.mid);
  arch(c, L + w * 0.37, T + h * 0.42, w * 0.26, h * 0.58, s.hollow);
  arch(c, L + w * 0.08, T + h * 0.56, w * 0.2, h * 0.44, s.hollow);
  arch(c, L + w * 0.72, T + h * 0.56, w * 0.2, h * 0.44, s.hollow);
  box(c, L, T + h * 0.2, w, h * 0.06, s.dark);
  box(c, L + w * 0.3, T + h * 0.1, w * 0.4, h * 0.1, s.mid);
  triangle(c, L + w * 0.28, T + h * 0.1, L + w * 0.72, T + h * 0.1, 0, T, s.light);
};

/** New York: the stepped tower. Setbacks narrowing to a mast, windows in long vertical bands. */
const steppedTower: Draw = (c, s, w, h) => {
  const T = -h / 2;
  const steps: readonly [number, number, number][] = [
    [1, 0.62, 0.38],
    [0.72, 0.34, 0.28],
    [0.46, 0.14, 0.2],
  ];
  for (const [share, top, height] of steps) {
    const bw = w * share;
    box(c, -bw / 2, T + h * top, bw, h * height, s.light);
    box(c, bw * 0.24, T + h * top, bw * 0.26, h * height, s.mid);
    const bands = Math.max(2, Math.round(bw / 9));
    for (let i = 0; i < bands; i++) box(c, -bw / 2 + (bw / bands) * (i + 0.34), T + h * (top + 0.03), (bw / bands) * 0.32, h * (height - 0.05), s.hollow);
    box(c, -bw / 2, T + h * top, bw, h * 0.018, s.dark);
  }
  box(c, -w * 0.07, T + h * 0.07, w * 0.14, h * 0.07, s.mid);
  box(c, -w * 0.015, T, w * 0.03, h * 0.07, s.dark);
};

const LANDMARKS: Readonly<Record<string, Draw>> = {
  ankara: mausoleum,
  paris: triumphalArch,
  london: clockTower,
  rome: amphitheatre,
  tokyo: pagoda,
  istanbul: stoneTower,
  berlin: gate,
  madrid: cityGate,
  newyork: steppedTower,
};

/** Cities that have a landmark of their own. */
export const LANDMARK_CITIES: readonly string[] = Object.keys(LANDMARKS);

/**
 * Draws `city`'s landmark in a `w` × `h` box centred on the origin. `harmed`: a blast
 * would reach it, or it has been damaged. Returns false for a city without one, so the
 * caller can fall back to an ordinary building.
 */
export const drawLandmark = (c: Ctx, city: string, w: number, h: number, harmed: boolean): boolean => {
  const draw = LANDMARKS[city];
  if (!draw) return false;
  draw(c, harmed ? HARMED : STONE, w, h);
  return true;
};
