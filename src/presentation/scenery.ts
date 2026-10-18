import { WORLD } from '../core/level';
import { createRng, hashString } from '../core/math';

/**
 * City backdrops: a sky that moves from dawn to night across a city's levels,
 * the city's landmarks as flat silhouettes, and a generic skyline in front.
 * Everything is drawn from shapes, so there are no image files to download.
 */

type Rgb = readonly [number, number, number];

interface SkyKey {
  readonly top: Rgb;
  readonly bottom: Rgb;
  readonly sun: Rgb;
  /** Sun height: 0 = horizon, 1 = high. Negative hides it and shows the moon. */
  readonly sunHeight: number;
  /** 0 = day, 1 = full night (stars, lit windows, darker silhouettes). */
  readonly night: number;
}

/** Time of day keyframes; a city's first level is dawn, its last is night. */
const SKY: readonly SkyKey[] = [
  { top: [74, 86, 150], bottom: [246, 170, 140], sun: [255, 200, 150], sunHeight: 0.12, night: 0.15 }, // dawn
  { top: [70, 140, 220], bottom: [180, 220, 245], sun: [255, 245, 210], sunHeight: 0.75, night: 0 }, // day
  { top: [60, 110, 190], bottom: [250, 200, 130], sun: [255, 210, 120], sunHeight: 0.35, night: 0.05 }, // golden hour
  { top: [48, 42, 100], bottom: [240, 120, 90], sun: [255, 140, 90], sunHeight: 0.05, night: 0.45 }, // dusk
  { top: [14, 18, 44], bottom: [40, 46, 96], sun: [235, 235, 255], sunHeight: -1, night: 1 }, // night
];

export interface SkyState {
  readonly top: string;
  readonly bottom: string;
  readonly sun: string;
  readonly sunHeight: number;
  readonly night: number;
  /** Silhouette colours derived from the sky so landmarks always sit in the scene. */
  readonly far: string;
  readonly near: string;
  readonly ground: string;
  readonly groundEdge: string;
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const css = (c: Rgb, alpha = 1): string =>
  `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${alpha})`;

/** `progress` in [0, 1]: the level's position within its city. */
export const skyAt = (progress: number): SkyState => {
  const scaled = Math.min(0.9999, Math.max(0, progress)) * (SKY.length - 1);
  const i = Math.floor(scaled);
  const t = scaled - i;
  const a = SKY[i];
  const b = SKY[i + 1] ?? a;
  if (!a || !b) throw new Error('sky keyframes missing');
  const top = mix(a.top, b.top, t);
  const bottom = mix(a.bottom, b.bottom, t);
  const night = a.night + (b.night - a.night) * t;
  const shade: Rgb = [14, 16, 34];
  // Into the night the sun sinks below the horizon, then the moon takes over.
  const sunHeight = b.sunHeight < 0 ? (t > 0.5 ? -1 : a.sunHeight * (1 - 2 * t)) : a.sunHeight + (b.sunHeight - a.sunHeight) * t;
  return {
    top: css(top),
    bottom: css(bottom),
    sun: css(mix(a.sun, b.sun, t)),
    sunHeight,
    night,
    far: css(mix(bottom, shade, 0.45 + night * 0.25)),
    near: css(mix(bottom, shade, 0.7 + night * 0.15)),
    ground: css(mix([52, 58, 92], shade, 0.25 + night * 0.4)),
    groundEdge: css(mix([84, 94, 150], shade, 0.2 + night * 0.4)),
  };
};

/** Overscan around the world so screen shake never shows an edge. */
export const SCENE_MARGIN = 120;

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Landmarks = (c: Ctx, color: string, accent: string) => void;

const G = WORLD.groundY;

// ---- landmark silhouettes (world coordinates, standing on the ground line) --

const ankara: Landmarks = (c, color) => {
  c.fillStyle = color;
  // Anıtkabir: hill, terrace and colonnaded hall.
  c.beginPath();
  c.ellipse(190, G, 190, 46, 0, Math.PI, 0);
  c.fill();
  c.fillRect(110, G - 70, 160, 26);
  c.beginPath();
  c.rect(122, G - 132, 136, 62);
  for (let x = 130; x < 252; x += 12) c.rect(x, G - 122, 6, 48); // gaps between columns
  c.fill('evenodd');
  c.fillRect(116, G - 142, 148, 12);
  // Kocatepe: dome on a hall with four minarets.
  c.fillRect(420, G - 70, 110, 70);
  c.beginPath();
  c.arc(475, G - 70, 44, Math.PI, 0);
  c.fill();
  for (const x of [404, 432, 518, 546]) {
    c.fillRect(x - 3, G - 190, 6, 190);
    c.beginPath();
    c.moveTo(x - 4, G - 190);
    c.lineTo(x, G - 214);
    c.lineTo(x + 4, G - 190);
    c.fill();
  }
  // Atakule: shaft, disc and spire.
  c.fillRect(773, G - 240, 14, 240);
  c.beginPath();
  c.ellipse(780, G - 248, 34, 14, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(780, G - 260, 16, Math.PI, 0);
  c.fill();
  c.fillRect(778, G - 300, 4, 40);
};

const paris: Landmarks = (c, color) => {
  c.fillStyle = color;
  // Arc de Triomphe with its arch cut out.
  c.beginPath();
  c.rect(150, G - 110, 120, 110);
  c.moveTo(232, G);
  c.lineTo(232, G - 52);
  c.arc(210, G - 52, 22, 0, Math.PI, true);
  c.lineTo(188, G);
  c.closePath();
  c.fill('evenodd');
  c.fillRect(144, G - 122, 132, 12);
  // Sacré-Cœur on Montmartre.
  c.beginPath();
  c.ellipse(470, G, 150, 50, 0, Math.PI, 0);
  c.fill();
  c.fillRect(430, G - 100, 80, 52);
  c.beginPath();
  c.arc(470, G - 100, 30, Math.PI, 0);
  c.fill();
  for (const x of [438, 502]) {
    c.beginPath();
    c.arc(x, G - 100, 12, Math.PI, 0);
    c.fill();
  }
  c.fillRect(468, G - 150, 4, 22);
  // Eiffel Tower: curved legs, first-floor arch, tapering spire.
  const x = 760;
  c.beginPath();
  c.moveTo(x - 80, G);
  c.quadraticCurveTo(x - 40, G - 90, x - 16, G - 210);
  c.lineTo(x - 5, G - 300);
  c.lineTo(x, G - 330);
  c.lineTo(x + 5, G - 300);
  c.lineTo(x + 16, G - 210);
  c.quadraticCurveTo(x + 40, G - 90, x + 80, G);
  c.lineTo(x + 50, G);
  c.quadraticCurveTo(x, G - 110, x - 50, G);
  c.closePath();
  c.fill();
  c.fillRect(x - 46, G - 96, 92, 8);
  c.fillRect(x - 22, G - 200, 44, 6);
};

const london: Landmarks = (c, color, accent) => {
  c.fillStyle = color;
  c.strokeStyle = color;
  // London Eye.
  c.lineWidth = 5;
  c.beginPath();
  c.arc(210, G - 120, 100, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = 1.5;
  c.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    c.moveTo(210, G - 120);
    c.lineTo(210 + Math.cos(a) * 100, G - 120 + Math.sin(a) * 100);
  }
  c.stroke();
  c.beginPath();
  c.moveTo(170, G);
  c.lineTo(210, G - 120);
  c.lineTo(250, G);
  c.lineTo(240, G);
  c.lineTo(210, G - 100);
  c.lineTo(180, G);
  c.fill();
  // The Shard.
  c.beginPath();
  c.moveTo(440, G);
  c.lineTo(476, G - 280);
  c.lineTo(486, G - 260);
  c.lineTo(520, G);
  c.fill();
  // Elizabeth Tower (Big Ben) with a lit clock face.
  c.fillRect(742, G - 220, 40, 220);
  c.fillRect(736, G - 236, 52, 16);
  c.beginPath();
  c.moveTo(738, G - 236);
  c.lineTo(762, G - 300);
  c.lineTo(786, G - 236);
  c.fill();
  c.fillStyle = accent;
  c.beginPath();
  c.arc(762, G - 196, 13, 0, Math.PI * 2);
  c.fill();
};

const rome: Landmarks = (c, color) => {
  c.fillStyle = color;
  // Umbrella pines.
  for (const [x, h] of [[90, 120], [140, 100]] as const) {
    c.fillRect(x - 3, G - h, 6, h);
    c.beginPath();
    c.ellipse(x, G - h, 44, 16, 0, 0, Math.PI * 2);
    c.fill();
  }
  // Colosseum: three tiers of arches, with the broken top edge.
  c.beginPath();
  c.moveTo(330, G);
  c.lineTo(330, G - 120);
  c.lineTo(560, G - 150);
  c.lineTo(640, G - 128);
  c.lineTo(640, G);
  c.closePath();
  for (let tier = 0; tier < 3; tier++) {
    const y = G - 14 - tier * 38;
    for (let x = 344; x < 630; x += 26) {
      c.moveTo(x + 16, y);
      c.lineTo(x + 16, y - 14);
      c.arc(x + 8, y - 14, 8, 0, Math.PI, true);
      c.lineTo(x, y);
      c.closePath();
    }
  }
  c.fill('evenodd');
  // St Peter's dome.
  c.fillRect(760, G - 90, 120, 90);
  c.fillRect(788, G - 130, 64, 40);
  c.beginPath();
  c.arc(820, G - 130, 40, Math.PI, 0);
  c.fill();
  c.fillRect(816, G - 192, 8, 26);
};

const tokyo: Landmarks = (c, color, accent) => {
  // Mount Fuji far behind, with its snow cap.
  c.fillStyle = color;
  c.globalAlpha = 0.55;
  c.beginPath();
  c.moveTo(20, G);
  c.lineTo(250, G - 230);
  c.lineTo(310, G - 230);
  c.lineTo(560, G);
  c.fill();
  c.fillStyle = accent;
  c.beginPath();
  c.moveTo(250, G - 230);
  c.lineTo(310, G - 230);
  c.lineTo(340, G - 190);
  c.lineTo(310, G - 200);
  c.lineTo(280, G - 186);
  c.lineTo(250, G - 200);
  c.lineTo(220, G - 190);
  c.fill();
  c.globalAlpha = 1;
  c.fillStyle = color;
  // Tokyo Skytree.
  c.beginPath();
  c.moveTo(500, G);
  c.lineTo(512, G - 300);
  c.lineTo(518, G - 300);
  c.lineTo(530, G);
  c.fill();
  c.fillRect(504, G - 240, 22, 10);
  c.fillRect(508, G - 280, 14, 8);
  c.fillRect(514, G - 340, 2, 40);
  // Tokyo Tower.
  const x = 760;
  c.beginPath();
  c.moveTo(x - 60, G);
  c.lineTo(x - 8, G - 220);
  c.lineTo(x, G - 290);
  c.lineTo(x + 8, G - 220);
  c.lineTo(x + 60, G);
  c.lineTo(x + 36, G);
  c.lineTo(x, G - 80);
  c.lineTo(x - 36, G);
  c.closePath();
  c.fill();
  c.fillRect(x - 30, G - 110, 60, 10);
  c.fillRect(x - 14, G - 200, 28, 8);
};

const istanbul: Landmarks = (c, color, accent) => {
  c.fillStyle = color;
  c.strokeStyle = color;
  // Bosphorus Bridge: two towers, the main cable sagging between them, hangers to the deck.
  const deckY = G - 70;
  c.fillRect(40, G - 220, 10, 220);
  c.fillRect(300, G - 220, 10, 220);
  c.fillRect(0, deckY, 360, 6);
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(-60, deckY - 10);
  c.lineTo(45, G - 220);
  c.quadraticCurveTo(175, deckY + 40, 305, G - 220);
  c.lineTo(420, deckY - 10);
  c.stroke();
  c.lineWidth = 1;
  c.beginPath();
  for (let x = 60; x < 300; x += 14) {
    const t = (x - 45) / 260;
    const cable = (1 - t) * (1 - t) * (G - 220) + 2 * (1 - t) * t * (deckY + 40) + t * t * (G - 220);
    c.moveTo(x, cable);
    c.lineTo(x, deckY);
  }
  c.stroke();
  // A great mosque: central dome on a drum, half domes, four minarets.
  const mx = 560;
  c.fillRect(mx - 110, G - 70, 220, 70);
  c.beginPath();
  c.arc(mx, G - 110, 62, Math.PI, 0);
  c.fill();
  c.fillRect(mx - 62, G - 110, 124, 40);
  for (const dx of [-80, 80]) {
    c.beginPath();
    c.arc(mx + dx, G - 70, 34, Math.PI, 0);
    c.fill();
  }
  c.fillRect(mx - 3, G - 190, 6, 22);
  for (const dx of [-140, -120, 120, 140]) {
    c.fillRect(mx + dx - 3, G - 210, 6, 210);
    c.beginPath();
    c.moveTo(mx + dx - 4, G - 210);
    c.lineTo(mx + dx, G - 240);
    c.lineTo(mx + dx + 4, G - 210);
    c.fill();
    c.fillRect(mx + dx - 5, G - 160, 10, 3);
  }
  // Galata Tower: stone cylinder, a balcony ring, a tall conical cap.
  const gx = 840;
  c.fillRect(gx - 26, G - 200, 52, 200);
  c.fillRect(gx - 32, G - 206, 64, 8);
  c.beginPath();
  c.moveTo(gx - 30, G - 206);
  c.lineTo(gx, G - 280);
  c.lineTo(gx + 30, G - 206);
  c.fill();
  c.fillStyle = accent;
  for (const wy of [G - 170, G - 120, G - 70]) c.fillRect(gx - 4, wy, 8, 14);
};

const berlin: Landmarks = (c, color, accent) => {
  c.fillStyle = color;
  // Brandenburg Gate: six columns on a plinth, an attic, the quadriga on top.
  const bx = 150;
  c.fillRect(bx - 110, G - 20, 220, 20);
  for (let i = 0; i < 6; i++) c.fillRect(bx - 100 + i * 38, G - 120, 14, 100);
  c.fillRect(bx - 115, G - 140, 230, 22);
  c.fillRect(bx - 60, G - 160, 120, 20);
  c.fillRect(bx - 22, G - 184, 44, 24);
  // Reichstag: a long block with corner towers and the glass dome.
  const rx = 470;
  c.fillRect(rx - 150, G - 90, 300, 90);
  for (const dx of [-150, 120]) c.fillRect(rx + dx, G - 118, 30, 118);
  c.beginPath();
  c.arc(rx, G - 90, 52, Math.PI, 0);
  c.fill();
  c.fillStyle = accent;
  for (let x = rx - 130; x < rx + 120; x += 24) c.fillRect(x, G - 70, 10, 16);
  c.fillStyle = color;
  // Fernsehturm: a slim shaft, the sphere, and the antenna.
  const tx = 800;
  c.fillRect(tx - 9, G - 300, 18, 300);
  c.fillRect(tx - 22, G - 40, 44, 40);
  c.beginPath();
  c.arc(tx, G - 300, 30, 0, Math.PI * 2);
  c.fill();
  c.fillRect(tx - 4, G - 400, 8, 72);
  c.fillRect(tx - 1.5, G - 440, 3, 40);
  c.fillStyle = accent;
  c.fillRect(tx - 30, G - 302, 60, 4);
};

const madrid: Landmarks = (c, color, accent) => {
  c.fillStyle = color;
  // Puerta de Alcalá: a wide gate of five openings, the middle three arched, a pediment and statues on top.
  const px = 160;
  c.fillRect(px - 120, G - 110, 240, 110);
  c.fillRect(px - 126, G - 124, 252, 16);
  c.beginPath();
  c.moveTo(px - 50, G - 124);
  c.lineTo(px, G - 150);
  c.lineTo(px + 50, G - 124);
  c.fill();
  for (const dx of [-90, 90]) c.fillRect(px + dx - 6, G - 140, 12, 16);
  c.fillStyle = accent;
  for (const dx of [-112, 92]) c.fillRect(px + dx, G - 60, 20, 60);
  for (const dx of [-60, 0, 60]) {
    c.beginPath();
    c.moveTo(px + dx - 16, G);
    c.lineTo(px + dx - 16, G - 56);
    c.arc(px + dx, G - 56, 16, Math.PI, 0);
    c.lineTo(px + dx + 16, G);
    c.fill();
  }
  c.fillStyle = color;
  // Metrópolis: a wedge of a building with a round corner tower, its dome and the winged statue.
  const mx = 450;
  c.fillRect(mx - 80, G - 120, 160, 120);
  c.fillRect(mx - 30, G - 170, 60, 50);
  c.beginPath();
  c.arc(mx, G - 170, 30, Math.PI, 0);
  c.fill();
  c.fillRect(mx - 3, G - 216, 6, 18);
  c.beginPath();
  c.moveTo(mx - 16, G - 214);
  c.lineTo(mx, G - 206);
  c.lineTo(mx + 16, G - 214);
  c.lineTo(mx, G - 204);
  c.fill();
  c.fillStyle = accent;
  for (let wx = mx - 70; wx < mx + 70; wx += 20) c.fillRect(wx, G - 100, 8, 14);
  c.fillStyle = color;
  // Cuatro Torres: four towers, one with the arch on top, one with a rounded crown.
  const towers = [
    { x: 690, w: 46, h: 300 },
    { x: 760, w: 44, h: 330 },
    { x: 830, w: 48, h: 310 },
    { x: 900, w: 42, h: 280 },
  ];
  for (const t of towers) c.fillRect(t.x - t.w / 2, G - t.h, t.w, t.h);
  c.fillStyle = accent; // Torre Cepsa's open arch
  c.fillRect(690 - 15, G - 300 + 4, 30, 26);
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(830, G - 310, 24, 16, 0, Math.PI, 0);
  c.fill();
  c.fillStyle = accent;
  for (const t of towers) for (let wy = G - t.h + 40; wy < G - 20; wy += 40) c.fillRect(t.x - t.w / 2 + 6, wy, t.w - 12, 2);
};

const newyork: Landmarks = (c, color, accent) => {
  c.fillStyle = color;
  // Statue of Liberty on her pedestal: torch raised, crown, robe.
  const sx = 120;
  c.fillRect(sx - 34, G - 70, 68, 70);
  c.fillRect(sx - 24, G - 96, 48, 26);
  c.beginPath();
  c.moveTo(sx - 16, G - 96);
  c.lineTo(sx - 10, G - 190);
  c.lineTo(sx + 12, G - 190);
  c.lineTo(sx + 18, G - 96);
  c.fill();
  c.beginPath();
  c.arc(sx + 1, G - 198, 10, 0, Math.PI * 2);
  c.fill();
  c.fillRect(sx + 9, G - 252, 6, 60);
  c.fillStyle = accent;
  c.beginPath();
  c.arc(sx + 12, G - 258, 6, 0, Math.PI * 2);
  c.fill();
  for (let k = -2; k <= 2; k++) c.fillRect(sx + 1 + k * 5 - 1, G - 214, 2, 8);
  c.fillStyle = color;
  // Empire State: stepped setbacks up to the mast.
  const ex = 470;
  c.fillRect(ex - 60, G - 200, 120, 200);
  c.fillRect(ex - 44, G - 270, 88, 70);
  c.fillRect(ex - 28, G - 330, 56, 60);
  c.fillRect(ex - 14, G - 370, 28, 40);
  c.fillRect(ex - 3, G - 420, 6, 50);
  // Chrysler: a crown of stacked arches, a needle on top.
  const cx = 640;
  c.fillRect(cx - 34, G - 260, 68, 260);
  for (let k = 0; k < 4; k++) {
    const r = 30 - k * 7;
    c.beginPath();
    c.arc(cx, G - 260 - k * 20, r, Math.PI, 0);
    c.fill();
  }
  c.fillRect(cx - 2, G - 380, 4, 50);
  // One World Trade: a tapering prism.
  const wx = 860;
  c.beginPath();
  c.moveTo(wx - 40, G);
  c.lineTo(wx - 40, G - 120);
  c.lineTo(wx - 18, G - 400);
  c.lineTo(wx + 18, G - 400);
  c.lineTo(wx + 40, G - 120);
  c.lineTo(wx + 40, G);
  c.fill();
  c.fillRect(wx - 2, G - 450, 4, 50);
  c.fillStyle = accent;
  for (const [x0, w, top] of [[ex - 52, 104, G - 190], [cx - 26, 52, G - 250]] as const) {
    for (let wy = top; wy < G - 20; wy += 26) c.fillRect(x0, wy, w, 3);
  }
  for (let wy = G - 380; wy < G - 20; wy += 34) c.fillRect(wx - 12, wy, 24, 2);
};

const LANDMARKS: Readonly<Record<string, Landmarks>> = { ankara, paris, london, rome, tokyo, istanbul, berlin, madrid, newyork };

/** Paints the whole backdrop for a city and time of day, in world coordinates. */
export const paintScene = (c: Ctx, cityKey: string, sky: SkyState): void => {
  const m = SCENE_MARGIN;
  const gradient = c.createLinearGradient(0, -m, 0, G);
  gradient.addColorStop(0, sky.top);
  gradient.addColorStop(1, sky.bottom);
  c.fillStyle = gradient;
  c.fillRect(-m, -m, WORLD.width + 2 * m, G + m);

  const rng = createRng(hashString(cityKey));
  if (sky.night > 0.3) {
    c.fillStyle = `rgba(255,255,255,${(sky.night - 0.3) * 1.2})`;
    for (let i = 0; i < 90; i++) {
      const size = rng() < 0.15 ? 2 : 1;
      c.fillRect(rng() * (WORLD.width + 2 * m) - m, rng() * (G - 160) - m, size, size);
    }
  }

  // Sun (or moon) with a soft glow.
  const night = sky.sunHeight < 0;
  const sunX = night ? 120 : 640;
  const sunY = night ? 90 : G - 40 - sky.sunHeight * 330;
  const glow = c.createRadialGradient(sunX, sunY, 0, sunX, sunY, night ? 90 : 160);
  glow.addColorStop(0, sky.sun.replace(/, 1\)$/, ', 0.55)'));
  glow.addColorStop(1, sky.sun.replace(/, 1\)$/, ', 0)'));
  c.fillStyle = glow;
  c.fillRect(sunX - 170, sunY - 170, 340, 340);
  c.fillStyle = sky.sun;
  c.beginPath();
  c.arc(sunX, sunY, night ? 20 : 30, 0, Math.PI * 2);
  c.fill();
  if (night) {
    c.fillStyle = sky.top;
    c.beginPath();
    c.arc(sunX + 9, sunY - 5, 18, 0, Math.PI * 2);
    c.fill();
  }

  // Soft flat clouds by day.
  c.fillStyle = `rgba(255,255,255,${0.35 * (1 - sky.night)})`;
  for (let i = 0; i < 4; i++) {
    const cx = rng() * WORLD.width;
    const cy = 40 + rng() * 140;
    const w = 60 + rng() * 80;
    c.beginPath();
    c.ellipse(cx, cy, w, 12, 0, 0, Math.PI * 2);
    c.ellipse(cx - w * 0.3, cy - 8, w * 0.45, 12, 0, 0, Math.PI * 2);
    c.fill();
  }

  // Landmarks.
  const accent = sky.night > 0.5 ? '#ffe9a8' : 'rgba(255,255,255,0.75)';
  LANDMARKS[cityKey]?.(c, sky.far, accent);

  // Generic city blocks in front, windows lit at night.
  const windowsOn = Math.max(0, sky.night - 0.25);
  for (let x = -m; x < WORLD.width + m; ) {
    const w = 34 + rng() * 46;
    const h = 30 + rng() * 80;
    c.fillStyle = sky.near;
    c.fillRect(x, G - h, w - 4, h);
    if (windowsOn > 0) {
      for (let wy = G - h + 8; wy < G - 8; wy += 12) {
        for (let wx = x + 6; wx < x + w - 12; wx += 10) {
          if (rng() < 0.45) {
            c.fillStyle = `rgba(255, 214, 140, ${windowsOn * (0.5 + rng() * 0.5)})`;
            c.fillRect(wx, wy, 4, 5);
          }
        }
      }
    }
    x += w;
  }

  // Ground.
  c.fillStyle = sky.ground;
  c.fillRect(-m, G, WORLD.width + 2 * m, WORLD.height - G + m);
  c.fillStyle = sky.groundEdge;
  c.fillRect(-m, G, WORLD.width + 2 * m, 3);
};
