import { WORLD } from '../core/level';
import { hashString, type Vec2 } from '../core/math';
import { chargeRadius, contractRadius, type EntityView, type LevelSession } from '../core/session';
import { halfExtent } from '../core/shapes';
import { FULL_VIEW, type View } from './camera';
import { TUNING } from '../core/tuning';
import type { ChargeKind } from '../core/level';
import type { JuiceDirector } from './juice';
import { MATERIAL_COLORS, PALETTE } from './palette';
import { paintScene, SCENE_MARGIN, skyAt } from './scenery';
import { flame, puff } from './sprites';
import { bevel, fillMaterial, glassPane, steelBeam } from './materials-art';

export interface Overlay {
  /** Placement preview under the pointer. */
  readonly ghost: { readonly position: Vec2; readonly valid: boolean } | undefined;
  /** The charge type the next placement will use. */
  readonly kind: ChargeKind;
  /** A charge being dragged: hidden at its old spot, drawn at `position`. */
  readonly drag: { readonly id: number; readonly position: Vec2 } | undefined;
  readonly time: number;
  /** A tutorial spot to point at. */
  readonly coach: { readonly world: Vec2; readonly radius: number } | undefined;
}

/** Bodies higher than this above the ground cast no visible shadow. */
const SHADOW_REACH = 240;

/**
 * Draws the logical 960×540 world into the canvas. Landscape screens show the
 * whole world; portrait screens frame the job's own slice of it (see camera.ts)
 * and extend the sky above and the ground below to fill the screen.
 */
export class Renderer {
  /** What the targets' eyes follow: the charge being placed, the last charge, or the last blast. */
  private lookAt: Vec2 | undefined;
  private readonly ctx: CanvasRenderingContext2D;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private scene = { city: 'ankara', progress: 0 };
  /** The slice of the world a portrait screen frames. */
  private focus: View = FULL_VIEW;
  /** The backdrop is static per level, so it is painted once and blitted each frame. */
  private backdrop: { key: string; canvas: HTMLCanvasElement; sky: string; ground: string } | undefined;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    // The canvas owns its size: follow it through window resizes, rotation, and hidden-then-shown panes.
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  resize(): void {
    // Phones have tiny, dense screens: 1.5× is visually the same and needs ~45% fewer pixels than 2×.
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
    const { clientWidth: w, clientHeight: h } = this.canvas;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.layout();
  }

  /** Frames a job's slice of the world on portrait screens; FULL_VIEW for menus. */
  setFocus(view: View): void {
    this.focus = view;
    this.layout();
  }

  private get portrait(): boolean {
    return this.canvas.height > this.canvas.width;
  }

  /** Fits the view: the whole world in landscape, the job's slice across the width in portrait. */
  private layout(): void {
    const { width: cw, height: ch } = this.canvas;
    const view = this.portrait ? this.focus : FULL_VIEW;
    const vw = view.x1 - view.x0;
    this.scale = Math.min(cw / vw, ch / WORLD.height);
    this.offsetX = (cw - vw * this.scale) / 2 - view.x0 * this.scale;
    this.offsetY = (ch - WORLD.height * this.scale) / 2;
  }

  /** The canvas rectangle (device pixels) showing the framed world, for clip recording. */
  visibleWorld(): { readonly sx: number; readonly sy: number; readonly sw: number; readonly sh: number } {
    const view = this.portrait ? this.focus : FULL_VIEW;
    const sx = Math.max(0, this.offsetX + view.x0 * this.scale);
    const sy = Math.max(0, this.offsetY);
    return {
      sx,
      sy,
      sw: Math.min(this.canvas.width, this.offsetX + view.x1 * this.scale) - sx,
      sh: Math.min(this.canvas.height, this.offsetY + WORLD.height * this.scale) - sy,
    };
  }

  /** Chooses the city backdrop; `progress` (0..1) is the level's place in the city, dawn to night. */
  setScene(city: string, progress: number): void {
    this.scene = { city, progress };
  }

  /** World pixels per CSS pixel, so input can size touch targets. */
  get worldPerCssPixel(): number {
    const rect = this.canvas.getBoundingClientRect();
    return rect.width > 0 ? this.canvas.width / rect.width / this.scale : 1;
  }

  /** The inverse of toWorld: where a world point is on screen, in CSS pixels. */
  toClient(p: Vec2): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: rect.left + ((this.offsetX + p.x * this.scale) / this.canvas.width) * rect.width,
      y: rect.top + ((this.offsetY + p.y * this.scale) / this.canvas.height) * rect.height,
    };
  }

  toWorld(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * this.canvas.width;
    const py = ((clientY - rect.top) / rect.height) * this.canvas.height;
    return { x: (px - this.offsetX) / this.scale, y: (py - this.offsetY) / this.scale };
  }

  draw(session: LevelSession | undefined, juice: JuiceDirector, overlay: Overlay): void {
    // A hidden or minimised window has no size; there is nothing to draw until it comes back.
    if (this.canvas.width === 0 || this.canvas.height === 0) return;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    const backdrop = this.paintedBackdrop();
    // Beyond the painted scene (tall portrait screens): more sky above, more ground below.
    c.fillStyle = backdrop.sky;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.fillStyle = backdrop.ground;
    const groundTop = this.offsetY + WORLD.groundY * this.scale;
    c.fillRect(0, groundTop, this.canvas.width, this.canvas.height - groundTop);

    const shake = juice.shake();
    const zoom = 1 + juice.zoom;
    c.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
    // Zoom about the focus of the action (a critical break), or the centre.
    const pivot = juice.focus ?? { x: WORLD.width / 2, y: WORLD.height / 2 };
    c.translate(pivot.x + shake.x, pivot.y + shake.y);
    c.rotate(shake.angle);
    c.scale(zoom, zoom);
    c.translate(-pivot.x, -pivot.y);

    const m = SCENE_MARGIN;
    c.drawImage(backdrop.canvas, -m, -m, WORLD.width + 2 * m, WORLD.height + 2 * m);
    this.scorches(juice);
    if (session?.level.footprint) this.footprint(session.level.footprint.from, session.level.footprint.to);
    if (session) this.tracks(session);
    if (session) {
      if (session.phase === 'placing') {
        this.zones(session, overlay.time);
        this.routes(session, overlay.time);
      }
      const threatened = session.phase === 'placing' ? this.blastRadii(session, overlay) : new Set<string>();
      this.groundShadows(session);
      const charges = session.charges;
      const light = juice.lights[juice.lights.length - 1];
      this.lookAt = overlay.ghost?.position ?? charges[charges.length - 1]?.position ?? (light && { x: light.x, y: light.y }) ?? this.lookAt;
      for (const e of session.view()) this.entity(e, overlay.time, threatened.has(e.id));
      this.birds(session, juice, overlay.time);
      this.charges(session, overlay);
    }
    this.effects(juice);
    if (overlay.coach) this.coachMarker(overlay.coach.world, overlay.coach.radius, overlay.time);

    const flash = juice.flashAlpha();
    if (flash > 0) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = `rgba(255, 226, 190, ${flash})`;
      c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /** Tutorial pointer: an amber ring that breathes, with a chevron above it. */
  private coachMarker(p: Vec2, radius: number, time: number): void {
    const c = this.ctx;
    const pulse = (Math.sin(time * 5) + 1) / 2;
    c.save();
    c.strokeStyle = `rgba(242, 177, 52, ${0.6 + 0.4 * pulse})`;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(p.x, p.y, radius + pulse * 6, 0, Math.PI * 2);
    c.stroke();
    const y = p.y - radius - 14 - pulse * 6;
    c.fillStyle = PALETTE.accent;
    c.beginPath();
    c.moveTo(p.x - 9, y - 10);
    c.lineTo(p.x + 9, y - 10);
    c.lineTo(p.x, y);
    c.closePath();
    c.fill();
    c.restore();
  }

  /** The site the debris must stay in: hazard tape on the ground and dashed boundary posts. */
  private footprint(from: number, to: number): void {
    const c = this.ctx;
    const g = WORLD.groundY;
    c.save();
    for (let x = from; x < to; x += 16) {
      c.fillStyle = Math.floor((x - from) / 16) % 2 === 0 ? PALETTE.accent : '#16181c';
      c.fillRect(x, g + 2, Math.min(16, to - x), 6);
    }
    c.strokeStyle = 'rgba(242, 177, 52, 0.7)';
    c.lineWidth = 2;
    c.setLineDash([6, 6]);
    c.beginPath();
    for (const x of [from, to]) {
      c.moveTo(x, g);
      c.lineTo(x, g - 140);
    }
    c.stroke();
    c.restore();
  }

  private paintedBackdrop(): { canvas: HTMLCanvasElement; sky: string; ground: string } {
    const key = `${this.scene.city}:${this.scene.progress}:${this.scale}`;
    if (this.backdrop?.key === key) return this.backdrop;
    const m = SCENE_MARGIN;
    const canvas = this.backdrop?.canvas ?? document.createElement('canvas');
    canvas.width = Math.ceil((WORLD.width + 2 * m) * this.scale);
    canvas.height = Math.ceil((WORLD.height + 2 * m) * this.scale);
    const c = canvas.getContext('2d');
    if (c) {
      c.setTransform(this.scale, 0, 0, this.scale, m * this.scale, m * this.scale);
      paintScene(c, this.scene.city, skyAt(this.scene.progress));
    }
    // The colours at the scene's top and bottom edges carry it past them on tall screens.
    const edge = (y: number): string => {
      const px = c?.getImageData(Math.floor(canvas.width / 2), y, 1, 1).data;
      return px ? `rgb(${px[0]}, ${px[1]}, ${px[2]})` : '#0d1020';
    };
    this.backdrop = { key, canvas, sky: edge(0), ground: edge(Math.max(0, canvas.height - 1)) };
    return this.backdrop;
  }

  /** Dashed road markings showing where each car will drive. */
  private routes(session: LevelSession, time: number): void {
    const c = this.ctx;
    c.save();
    c.setLineDash([10, 8]);
    c.lineDashOffset = -time * 30;
    c.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    c.lineWidth = 2;
    for (const e of session.view()) {
      if (!e.car || !e.car.driving || e.car.style === 'train' || e.shape.kind !== 'rect') continue;
      const y = e.car.route.y - e.shape.h / 2 - 10;
      const from = e.car.route.from - e.shape.w / 2;
      const to = e.car.route.to + e.shape.w / 2;
      c.beginPath();
      c.moveTo(from, y);
      c.lineTo(to, y);
      c.stroke();
      const ends = e.car.route.oneWay ? ([[to, 1]] as const) : ([[from, -1], [to, 1]] as const);
      for (const [x, dir] of ends) {
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x - dir * 8, y - 5);
        c.moveTo(x, y);
        c.lineTo(x - dir * 8, y + 5);
        c.stroke();
      }
    }
    c.restore();
  }

  /** Placement zones: hazard-taped outlines over a faint amber wash. */
  private zones(session: LevelSession, time: number): void {
    const c = this.ctx;
    c.save();
    for (const z of session.level.zones) {
      c.fillStyle = PALETTE.zone;
      c.fillRect(z.x, z.y, z.w, z.h);
      c.lineWidth = 3;
      c.strokeStyle = PALETTE.zoneEdge;
      c.setLineDash([10, 8]);
      c.lineDashOffset = -time * 16;
      c.strokeRect(z.x, z.y, z.w, z.h);
      c.strokeStyle = '#16181c';
      c.lineDashOffset = -time * 16 + 10;
      c.setLineDash([8, 10]);
      c.strokeRect(z.x, z.y, z.w, z.h);
    }
    c.restore();
  }

  private entity(e: EntityView, time: number, threatened = false): void {
    const c = this.ctx;
    const { position, angle } = e.state;
    c.save();
    c.translate(position.x, position.y);
    c.rotate(angle);
    if (e.kind === 'bomb' && e.shape.kind === 'circle') {
      this.bomb(e.shape.r, time, true);
    } else if (e.shape.kind === 'circle') {
      this.barrel(e.shape.r, time);
    } else if (e.shape.kind === 'poly') {
      this.fragment(e.material, e.shape.vertices);
    } else if (e.car) {
      if (e.car.style === 'train') this.train(e, e.shape.w, e.shape.h, threatened);
      else this.car(e, e.shape.w, e.shape.h);
    } else {
      this.block(e, e.shape.w, e.shape.h, threatened);
    }
    c.restore();
  }

  /** Rails under every train route, across the whole view. */
  private tracks(session: LevelSession): void {
    const c = this.ctx;
    for (const car of session.level.cars) {
      if (car.style !== 'train') continue;
      const y = car.y + car.h / 2;
      c.fillStyle = '#3a3330';
      for (let x = -SCENE_MARGIN; x < WORLD.width + SCENE_MARGIN; x += 18) c.fillRect(x, y + 1, 10, 4);
      c.fillStyle = '#9aa1aa';
      c.fillRect(-SCENE_MARGIN, y - 1, WORLD.width + 2 * SCENE_MARGIN, 2);
    }
  }

  /** A Shinkansen-style train: white body, blue stripe, window row, long nose. Protected: teal corners, red when hit. */
  private train(e: EntityView, w: number, h: number, threatened: boolean): void {
    const c = this.ctx;
    const dir = e.car?.direction ?? 1;
    c.save();
    c.scale(dir, 1);
    c.fillStyle = '#eef1f4';
    c.beginPath();
    c.moveTo(-w / 2, -h / 2 + 4);
    c.lineTo(w / 2 - 46, -h / 2);
    c.quadraticCurveTo(w / 2 - 4, -h / 2 + 2, w / 2, h / 2 - 4);
    c.lineTo(w / 2, h / 2);
    c.lineTo(-w / 2, h / 2);
    c.closePath();
    c.fill();
    c.fillStyle = '#1f5fae';
    c.fillRect(-w / 2, h / 2 - 11, w - 6, 4);
    c.fillStyle = '#2b3542';
    for (let x = -w / 2 + 10; x < w / 2 - 60; x += 16) c.fillRect(x, -h / 2 + 8, 10, 7);
    c.beginPath();
    c.moveTo(w / 2 - 50, -h / 2 + 7);
    c.lineTo(w / 2 - 26, -h / 2 + 8);
    c.lineTo(w / 2 - 34, -h / 2 + 15);
    c.lineTo(w / 2 - 50, -h / 2 + 15);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.3)';
    c.lineWidth = 1;
    for (let x = -w / 2 + 70; x < w / 2 - 40; x += 70) {
      c.beginPath();
      c.moveTo(x, -h / 2 + 3);
      c.lineTo(x, h / 2);
      c.stroke();
    }
    c.restore();
    // Protected marking, not mirrored.
    const mark = e.compromised || threatened ? PALETTE.invalid : PALETTE.protect;
    c.strokeStyle = mark;
    c.lineWidth = 2.5;
    c.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const x = (sx * w) / 2 + sx * 3;
      const y = (sy * h) / 2 + sy * 3;
      c.moveTo(x - sx * 10, y);
      c.lineTo(x, y);
      c.lineTo(x, y - sy * 8);
    }
    c.stroke();
  }

  /** Flat side-view car: body, cabin, windows, wheels and a headlight in the driving direction. */
  private car(e: EntityView, w: number, h: number): void {
    const c = this.ctx;
    const car = e.car;
    if (!car) return;
    const wrecked = car.wrecked;
    const body = wrecked ? '#3b3b46' : e.target ? PALETTE.target : MATERIAL_COLORS.vehicle.fill;
    const dir = car.direction;
    c.save();
    c.scale(dir, 1); // draw facing right, mirror when driving left
    const bodyTop = -h / 2 + h * 0.4;
    c.fillStyle = body;
    c.beginPath();
    c.roundRect(-w / 2, bodyTop, w, h * 0.45, 4);
    c.fill();
    c.beginPath();
    c.moveTo(-w * 0.32, bodyTop);
    c.lineTo(-w * 0.2, -h / 2);
    c.lineTo(w * 0.18, -h / 2);
    c.lineTo(w * 0.32, bodyTop);
    c.closePath();
    c.fill();
    c.fillStyle = wrecked ? '#222229' : 'rgba(210, 240, 255, 0.85)';
    c.beginPath();
    c.moveTo(-w * 0.26, bodyTop - 1);
    c.lineTo(-w * 0.17, -h / 2 + 3);
    c.lineTo(-w * 0.02, -h / 2 + 3);
    c.lineTo(-w * 0.02, bodyTop - 1);
    c.moveTo(w * 0.02, bodyTop - 1);
    c.lineTo(w * 0.02, -h / 2 + 3);
    c.lineTo(w * 0.15, -h / 2 + 3);
    c.lineTo(w * 0.26, bodyTop - 1);
    c.fill();
    if (!wrecked) {
      c.fillStyle = PALETTE.accent;
      c.fillRect(w / 2 - 4, bodyTop + 3, 4, 4);
    }
    c.fillStyle = '#16161e';
    for (const x of [-w * 0.3, w * 0.3]) {
      c.beginPath();
      c.arc(x, h / 2 - h * 0.18, h * 0.2, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    if (e.target) {
      c.strokeStyle = e.down ? PALETTE.targetDown : '#ffffff';
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(0, -2, h * 0.32, 0, Math.PI * 2);
      c.stroke();
    }
  }

  private block(e: EntityView, w: number, h: number, threatened: boolean): void {
    const c = this.ctx;
    if (e.anchored) {
      this.girder(w, h);
    } else if (e.material === 'glass') {
      glassPane(c, w, h);
    } else {
      c.beginPath();
      c.rect(-w / 2, -h / 2, w, h);
      fillMaterial(c, e.material, MATERIAL_COLORS[e.material].fill, h > w);
      if (e.material === 'metal') steelBeam(c, w, h);
      bevel(c, w, h);
    }
    if (e.protected) this.facade(w, h, e.compromised || threatened);
    if (e.damage > 0.25) this.cracks(e.id, w, h, e.damage, e.material);
    c.strokeStyle = 'rgba(0,0,0,0.45)';
    c.lineWidth = 1.2;
    c.strokeRect(-w / 2, -h / 2, w, h);
    if (e.target) this.targetFace(e, Math.min(w, h));
  }

  /** A broken-off fragment: same surface as its parent, with darker fracture edges. */
  private fragment(material: EntityView['material'], vertices: readonly Vec2[]): void {
    const c = this.ctx;
    c.beginPath();
    vertices.forEach((v, i) => (i === 0 ? c.moveTo(v.x, v.y) : c.lineTo(v.x, v.y)));
    c.closePath();
    if (material === 'glass') {
      c.fillStyle = 'rgba(170, 210, 230, 0.8)';
      c.fill();
    } else {
      fillMaterial(c, material, MATERIAL_COLORS[material].fill, false);
    }
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.lineWidth = 1;
    c.stroke();
  }

  /** Fixed infrastructure: dark steel with cross bracing, visibly not part of the job. */
  private girder(w: number, h: number): void {
    const c = this.ctx;
    c.fillStyle = '#2f353d';
    c.fillRect(-w / 2, -h / 2, w, h);
    c.strokeStyle = '#4a525c';
    c.lineWidth = 1.5;
    c.beginPath();
    const long = w >= h;
    const span = long ? h : w;
    for (let t = -(long ? w : h) / 2; t < (long ? w : h) / 2; t += span) {
      if (long) {
        c.moveTo(t, -h / 2);
        c.lineTo(t + span, h / 2);
        c.moveTo(t + span, -h / 2);
        c.lineTo(t, h / 2);
      } else {
        c.moveTo(-w / 2, t);
        c.lineTo(w / 2, t + span);
        c.moveTo(w / 2, t);
        c.lineTo(-w / 2, t + span);
      }
    }
    c.stroke();
  }

  /**
   * A target has a face: crosshair ticks say what it is, the eyes say how it
   * feels. Calm eyes watch the charge being placed or the last blast; they go
   * wide when the block shakes or cracks, and turn to crosses once it is down.
   * Drawn in the body's own (rotated) frame.
   */
  private targetFace(e: EntityView, size: number): void {
    const c = this.ctx;
    const speed = Math.hypot(e.state.velocity.x, e.state.velocity.y);
    const mood = e.down ? 'down' : speed > 70 || e.damage > 0.3 ? 'scared' : 'calm';
    const r = size * 0.42;
    c.strokeStyle = e.down ? PALETTE.targetDown : PALETTE.target;
    c.lineWidth = 2;
    c.beginPath();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      c.moveTo(dx * r * 0.95, dy * r * 0.95);
      c.lineTo(dx * r * 1.25, dy * r * 1.25);
    }
    c.stroke();
    // Where to look, turned into the body's frame.
    let lx = 0;
    let ly = 0.4;
    if (this.lookAt) {
      const dx = this.lookAt.x - e.state.position.x;
      const dy = this.lookAt.y - e.state.position.y;
      const a = -e.state.angle;
      const rx = dx * Math.cos(a) - dy * Math.sin(a);
      const ry = dx * Math.sin(a) + dy * Math.cos(a);
      const d = Math.hypot(rx, ry) || 1;
      lx = rx / d;
      ly = ry / d;
    }
    const eye = size * (mood === 'scared' ? 0.15 : 0.12);
    for (const side of [-1, 1]) {
      const x = side * size * 0.17;
      const y = -size * 0.06;
      if (mood === 'down') {
        c.strokeStyle = '#2a2320';
        c.lineWidth = 1.8;
        c.beginPath();
        c.moveTo(x - eye * 0.7, y - eye * 0.7);
        c.lineTo(x + eye * 0.7, y + eye * 0.7);
        c.moveTo(x + eye * 0.7, y - eye * 0.7);
        c.lineTo(x - eye * 0.7, y + eye * 0.7);
        c.stroke();
        continue;
      }
      c.fillStyle = '#f7f3ea';
      c.beginPath();
      c.ellipse(x, y, eye, eye * 1.15, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(30, 24, 20, 0.6)';
      c.lineWidth = 1;
      c.stroke();
      const pupil = eye * (mood === 'scared' ? 0.38 : 0.55);
      c.fillStyle = '#1d1a18';
      c.beginPath();
      c.arc(x + lx * (eye - pupil) * 0.8, y + ly * (eye - pupil) * 0.8, pupil, 0, Math.PI * 2);
      c.fill();
    }
    if (mood === 'scared') {
      c.fillStyle = '#2a2320';
      c.beginPath();
      c.ellipse(0, size * 0.2, size * 0.06, size * 0.08, 0, 0, Math.PI * 2);
      c.fill();
    }
  }

  /** Pigeons: perched on their roof until the first blast, then flapping away. */
  private birds(session: LevelSession, juice: JuiceDirector, time: number): void {
    if (juice.birds.length === 0) return;
    const c = this.ctx;
    const bodies = new Map<string, EntityView>();
    for (const e of session.view()) bodies.set(e.id, e);
    c.fillStyle = '#2b2a30';
    c.strokeStyle = '#2b2a30';
    c.lineWidth = 1.6;
    for (const b of juice.birds) {
      if (!b.flying && b.perch) {
        const e = bodies.get(b.perch.id);
        if (e) {
          const a = e.state.angle;
          const top = e.shape.kind === 'rect' ? e.shape.h / 2 : 0;
          b.x = e.state.position.x + b.perch.dx * Math.cos(a) + top * Math.sin(a);
          b.y = e.state.position.y + b.perch.dx * Math.sin(a) - top * Math.cos(a);
        }
        // Body, head and now and then a little bob.
        const bob = Math.sin(time * 3 + b.flap) > 0.92 ? 1 : 0;
        c.beginPath();
        c.ellipse(b.x, b.y - 3.5, 4.5, 3.2, 0, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.arc(b.x + 3.6, b.y - 7 + bob, 2.1, 0, Math.PI * 2);
        c.fill();
        continue;
      }
      const wing = Math.sin(b.flap) * 4;
      c.beginPath();
      c.moveTo(b.x - 6, b.y - wing);
      c.quadraticCurveTo(b.x - 2, b.y - 1, b.x, b.y);
      c.quadraticCurveTo(b.x + 2, b.y - 1, b.x + 6, b.y - wing);
      c.stroke();
    }
  }

  /** A protected building: lit windows, a teal roof line and corner marks; red once damaged. */
  private facade(w: number, h: number, compromised: boolean): void {
    const c = this.ctx;
    const mark = compromised ? PALETTE.invalid : PALETTE.protect;
    c.fillStyle = compromised ? 'rgba(40, 20, 20, 0.6)' : 'rgba(255, 226, 160, 0.75)';
    for (let y = -h / 2 + 10; y < h / 2 - 12; y += 16) {
      for (let x = -w / 2 + 8; x < w / 2 - 8; x += 14) c.fillRect(x, y, 7, 9);
    }
    c.fillStyle = 'rgba(20, 22, 26, 0.85)';
    c.fillRect(-6, h / 2 - 14, 12, 14);
    c.fillStyle = mark;
    c.fillRect(-w / 2, -h / 2, w, 4);
    c.strokeStyle = mark;
    c.lineWidth = 2.5;
    const k = 8;
    c.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const x = (sx * w) / 2 + sx * 3;
      const y = (sy * h) / 2 + sy * 3;
      c.moveTo(x - sx * k, y);
      c.lineTo(x, y);
      c.lineTo(x, y - sy * k);
    }
    c.stroke();
  }


  /** Deterministic cracks per block that grow with damage. */
  /** Deterministic cracks per block that grow with damage; badly cracked concrete shows its rebar. */
  private cracks(id: string, w: number, h: number, damage: number, material: EntityView['material']): void {
    const c = this.ctx;
    let seed = hashString(id);
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const lines = Math.ceil(damage * 5);
    const paths: [number, number][][] = [];
    for (let i = 0; i < lines; i++) {
      let x = (rnd() - 0.5) * w * 0.6;
      let y = (rnd() - 0.5) * h * 0.6;
      const path: [number, number][] = [[x, y]];
      for (let k = 0; k < 4; k++) {
        x = Math.max(-w / 2, Math.min(w / 2, x + (rnd() - 0.5) * w * 0.35));
        y = Math.max(-h / 2, Math.min(h / 2, y + (rnd() - 0.5) * h * 0.35));
        path.push([x, y]);
      }
      paths.push(path);
    }
    const stroke = (style: string, width: number) => {
      c.strokeStyle = style;
      c.lineWidth = width;
      c.beginPath();
      for (const path of paths) path.forEach(([x, y], i) => (i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
      c.stroke();
    };
    stroke('rgba(10,10,20,0.75)', 1.4);
    stroke('rgba(255,255,255,0.12)', 0.6);
    if (material === 'concrete' && damage > 0.6) {
      c.strokeStyle = 'rgba(176, 92, 40, 0.9)';
      c.lineWidth = 1.2;
      c.beginPath();
      const long = w >= h;
      for (const f of [-0.25, 0.25]) {
        if (long) {
          c.moveTo(-w * 0.2, h * f);
          c.lineTo(w * 0.15, h * f);
        } else {
          c.moveTo(w * f, -h * 0.2);
          c.lineTo(w * f, h * 0.15);
        }
      }
      c.stroke();
    }
  }

  /** A bomb on its rack before release, with a dashed drop line straight down. */
  private rackedBomb(p: Vec2, time: number): void {
    const c = this.ctx;
    c.save();
    c.setLineDash([4, 6]);
    c.strokeStyle = 'rgba(242, 177, 52, 0.45)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(p.x, p.y + 14);
    c.lineTo(p.x, WORLD.groundY);
    c.stroke();
    c.setLineDash([]);
    c.strokeStyle = '#9aa1aa';
    c.beginPath();
    c.moveTo(p.x - 10, p.y - 18);
    c.lineTo(p.x + 10, p.y - 18);
    c.moveTo(p.x, p.y - 18);
    c.lineTo(p.x, p.y - 10);
    c.stroke();
    c.translate(p.x, p.y);
    this.bomb(TUNING.bomb.radius, time, false);
    c.restore();
  }

  /** A free-fall bomb: olive body, tail fins, a red light that blinks fast once armed. */
  private bomb(r: number, time: number, armed: boolean): void {
    const c = this.ctx;
    c.fillStyle = '#4d5733';
    c.beginPath();
    c.ellipse(0, 0, r * 0.9, r * 1.35, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#3b4328';
    c.beginPath();
    c.moveTo(-r * 0.8, -r * 1.1);
    c.lineTo(r * 0.8, -r * 1.1);
    c.lineTo(r * 0.5, -r * 1.7);
    c.lineTo(-r * 0.5, -r * 1.7);
    c.closePath();
    c.fill();
    c.fillStyle = PALETTE.accent;
    c.fillRect(-r * 0.9, r * 0.2, r * 1.8, 2);
    const on = armed ? Math.floor(time * 10) % 2 === 0 : Math.floor(time * 1.5) % 2 === 0;
    c.fillStyle = on ? (armed ? '#ff3b30' : '#59d36b') : '#2a2d33';
    c.beginPath();
    c.arc(0, -r * 0.3, 2, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(0, 0, r * 0.9, r * 1.35, 0, 0, Math.PI * 2);
    c.stroke();
  }

  private barrel(r: number, time: number): void {
    const c = this.ctx;
    c.fillStyle = PALETTE.barrel;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.4)';
    c.lineWidth = 2;
    c.stroke();
    // Hazard triangle that pulses gently.
    c.fillStyle = `rgba(255, 209, 102, ${0.75 + Math.sin(time * 4) * 0.25})`;
    c.beginPath();
    c.moveTo(0, -r * 0.55);
    c.lineTo(r * 0.5, r * 0.35);
    c.lineTo(-r * 0.5, r * 0.35);
    c.closePath();
    c.fill();
  }

  /**
   * While placing, every charge (and the one under the finger) shows its blast
   * circle. A circle that reaches protected property turns red, and so does the building.
   */
  private blastRadii(session: LevelSession, overlay: Overlay): Set<string> {
    const c = this.ctx;
    const centres = session.charges
      .filter((ch) => overlay.drag?.id !== ch.id)
      .map((ch) => ({ position: ch.position, kind: ch.kind }));
    const dragged = session.charges.find((ch) => ch.id === overlay.drag?.id);
    if (overlay.drag && dragged) centres.push({ position: overlay.drag.position, kind: dragged.kind });
    else if (overlay.ghost?.valid) centres.push({ position: overlay.ghost.position, kind: overlay.kind });
    const threatened = new Set<string>();
    c.save();
    c.setLineDash([6, 6]);
    c.lineWidth = 1.5;
    for (const { position: centre, kind } of centres) {
      if (kind === 'bomb') continue; // a falling bomb goes off wherever it is; its drop line says where it starts
      const hits = session.protectedReachedFrom(centre, kind);
      hits.forEach((id) => threatened.add(id));
      const danger = hits.length > 0;
      c.fillStyle = danger ? 'rgba(229, 72, 77, 0.10)' : 'rgba(242, 177, 52, 0.06)';
      c.strokeStyle = danger ? 'rgba(229, 72, 77, 0.85)' : 'rgba(242, 177, 52, 0.55)';
      // Filled core: what must stay clear of protected property. Dashed rim: the full blast.
      c.beginPath();
      c.arc(centre.x, centre.y, contractRadius(kind), 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(centre.x, centre.y, chargeRadius(kind), 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
    return threatened;
  }

  private charges(session: LevelSession, overlay: Overlay): void {
    const placing = session.phase === 'placing';
    if (placing) {
      session.charges.forEach((ch, i) => {
        if (overlay.drag?.id === ch.id) return;
        if (ch.kind === 'bomb') this.rackedBomb(ch.position, overlay.time);
        else this.charge(ch.position, i + 1, false, overlay.time, ch.kind);
        this.delayTag(ch.position, ch.delay);
      });
      const dragged = session.charges.find((ch) => ch.id === overlay.drag?.id);
      if (overlay.drag && dragged) this.charge(overlay.drag.position, 0, false, overlay.time, dragged.kind, 0.7);
      if (overlay.ghost && !overlay.drag) this.ghost(overlay.ghost.position, overlay.ghost.valid);
    } else {
      for (const a of session.armedCharges) {
        if (a.kind === 'bomb') this.rackedBomb(a.position, overlay.time);
        else this.charge(a.position, 0, true, overlay.time, a.kind);
      }
    }
  }

  /**
   * Soft contact shadows on the ground: dark and tight under bodies resting on it,
   * fainter and wider as they rise, so falling pieces read as having height.
   */
  private groundShadows(session: LevelSession): void {
    const c = this.ctx;
    const shade = puff('#000000');
    for (const e of session.view()) {
      const { position: p, angle } = e.state;
      const shape = e.shape;
      const [halfW, halfH] =
        shape.kind === 'rect'
          ? [
              (Math.abs(shape.w * Math.cos(angle)) + Math.abs(shape.h * Math.sin(angle))) / 2,
              (Math.abs(shape.w * Math.sin(angle)) + Math.abs(shape.h * Math.cos(angle))) / 2,
            ]
          : [halfExtent(shape), halfExtent(shape)];
      const height = WORLD.groundY - (p.y + halfH);
      if (height > SHADOW_REACH || halfW < 3) continue;
      const fade = 1 - Math.max(0, height) / SHADOW_REACH;
      const w = halfW * (1.15 + Math.max(0, height) / 160);
      c.globalAlpha = 0.38 * fade * fade;
      c.drawImage(shade, p.x - w, WORLD.groundY - 5, w * 2, 10);
    }
    c.globalAlpha = 1;
  }

  /**
   * A plastic explosive brick with a detonator and status LED; the LED blinks
   * fast once armed. Precision charges are smaller, with a white band.
   */
  private charge(p: Vec2, index: number, armed: boolean, time: number, kind: ChargeKind, alpha = 1): void {
    const c = this.ctx;
    c.save();
    c.globalAlpha = alpha;
    c.translate(p.x, p.y);
    if (kind === 'precision') {
      c.scale(0.72, 0.72);
      c.fillStyle = '#e9e3cf';
      c.fillRect(-13, -10, 26, 3);
    }
    // Implosion charges: a steel-blue casing with a cyan band and inward chevrons.
    const implosion = kind === 'implosion';
    c.fillStyle = implosion ? '#3d4b5c' : '#5f6a3e';
    c.fillRect(-13, -8, 26, 16);
    c.fillStyle = implosion ? '#5fc8d6' : '#4d5733';
    c.fillRect(-13, -2, 26, 4);
    if (implosion) {
      c.strokeStyle = '#5fc8d6';
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(-11, -6); c.lineTo(-7, -3); c.lineTo(-11, 0);
      c.moveTo(11, -6); c.lineTo(7, -3); c.lineTo(11, 0);
      c.stroke();
    }
    c.strokeStyle = '#1c1f14';
    c.lineWidth = 1.5;
    c.strokeRect(-13, -8, 26, 16);
    // Detonator box and wires.
    c.fillStyle = '#23262b';
    c.fillRect(-6, -14, 12, 7);
    c.strokeStyle = PALETTE.target;
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(6, -11);
    c.quadraticCurveTo(14, -16, 12, -4);
    c.stroke();
    const on = armed ? Math.floor(time * 12) % 2 === 0 : Math.floor(time * 1.5) % 2 === 0;
    c.fillStyle = on ? (armed ? '#ff3b30' : '#59d36b') : '#2a2d33';
    c.beginPath();
    c.arc(0, -10.5, 2, 0, Math.PI * 2);
    c.fill();
    if (index > 0) {
      c.fillStyle = '#e9e3cf';
      c.font = '700 9px Bahnschrift, system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(index), 0, 3);
    }
    c.restore();
  }

  /** Firing delay under a placed charge, as a blaster would chalk it on. */
  private delayTag(p: Vec2, delay: number): void {
    const c = this.ctx;
    const text = `+${Math.round(delay * 1000)}`;
    c.save();
    c.font = '700 10px Bahnschrift, system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'top';
    const w = c.measureText(text).width + 8;
    c.fillStyle = 'rgba(15, 17, 20, 0.85)';
    c.fillRect(p.x - w / 2, p.y + 11, w, 13);
    c.fillStyle = PALETTE.accent;
    c.fillText(text, p.x, p.y + 12.5);
    c.restore();
  }

  private ghost(p: Vec2, valid: boolean): void {
    const c = this.ctx;
    c.save();
    c.globalAlpha = 0.6;
    c.strokeStyle = valid ? PALETTE.valid : PALETTE.invalid;
    c.lineWidth = 2;
    c.setLineDash([4, 4]);
    c.strokeRect(p.x - 13, p.y - 8, 26, 16);
    c.restore();
  }

  /** Burn marks sit on the ground and walls, under everything that moves. */
  private scorches(juice: JuiceDirector): void {
    const c = this.ctx;
    for (const s of juice.scorches) {
      const g = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.w);
      g.addColorStop(0, 'rgba(12, 10, 10, 0.55)');
      g.addColorStop(0.6, 'rgba(20, 16, 14, 0.25)');
      g.addColorStop(1, 'rgba(20, 16, 14, 0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(s.x, s.y, s.w, s.h, 0, 0, Math.PI * 2);
      c.fill();
    }
  }

  private effects(juice: JuiceDirector): void {
    const c = this.ctx;
    // 1. Solid matter and smoke, normal blending.
    for (const p of juice.particles.alive()) {
      if (p.style === 'spark') continue;
      const t = p.age / p.life;
      switch (p.style) {
        case 'plume': {
          // Lit orange from below at first, then cooling to soot; fades in fast, out slowly.
          // Soft-edged puff: solid core, feathered rim, so the column reads as one cloud.
          const alpha = Math.min(1, t / 0.08) * Math.pow(1 - t, 1.3) * 0.75;
          const warmth = t < 0.18 ? 1 - t / 0.18 : 0;
          const radius = p.size * (0.6 + t * 1.7);
          c.globalAlpha = alpha * (1 - warmth);
          c.drawImage(puff(p.color), p.x - radius, p.y - radius, radius * 2, radius * 2);
          if (warmth > 0) {
            c.globalAlpha = alpha * warmth;
            c.drawImage(puff('#a4602c'), p.x - radius, p.y - radius, radius * 2, radius * 2);
          }
          break;
        }
        case 'dust': {
          // Swells to several times its size; eases in, then thins out slowly like settling dust.
          const radius = p.size * (0.7 + 2.2 * Math.sqrt(t));
          c.globalAlpha = Math.min(1, t / 0.12) * Math.pow(1 - t, 1.6) * 0.42;
          c.drawImage(puff(p.color), p.x - radius, p.y - radius, radius * 2, radius * 2);
          break;
        }
        case 'smoke':
          c.globalAlpha = 0.35 * (1 - t);
          c.fillStyle = p.color;
          c.beginPath();
          c.arc(p.x, p.y, p.size * (0.6 + t * 0.9), 0, Math.PI * 2);
          c.fill();
          break;
        case 'chip':
        case 'glint':
          c.globalAlpha = t > 0.8 ? (1 - t) / 0.2 : 1;
          c.fillStyle = p.color;
          c.save();
          c.translate(p.x, p.y);
          c.rotate(p.angle);
          c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * (p.style === 'glint' ? 0.5 : 0.8));
          c.restore();
          break;
      }
    }
    c.globalAlpha = 1;

    // 2. Light and fire, additive blending so overlaps glow.
    c.save();
    c.globalCompositeOperation = 'lighter';
    const lightScale = juice.lightScale();
    for (const l of juice.lights) {
      const t = l.age / l.life;
      const a = (1 - t) * (1 - t) * 0.55 * lightScale;
      const g = c.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.radius);
      const [lr, lg, lb] = l.color;
      g.addColorStop(0, `rgba(${lr}, ${lg}, ${lb}, ${a})`);
      g.addColorStop(0.4, `rgba(${lr}, ${Math.round(lg * 0.7)}, ${Math.round(lb * 0.6)}, ${a * 0.35})`);
      g.addColorStop(1, `rgba(${lr}, ${Math.round(lg * 0.6)}, ${Math.round(lb * 0.5)}, 0)`);
      c.fillStyle = g;
      c.fillRect(l.x - l.radius, l.y - l.radius, l.radius * 2, l.radius * 2);
    }
    for (const f of juice.flames) {
      const t = f.age / f.life;
      const r = f.radius * (0.7 + t * 0.9);
      const heat = 1 - t;
      c.globalAlpha = heat;
      c.drawImage(flame(heat, f.style), f.x - r, f.y - r, r * 2, r * 2);
    }
    c.globalAlpha = 1;
    for (const p of juice.particles.alive()) {
      if (p.style !== 'spark') continue;
      const t = p.age / p.life;
      c.globalAlpha = 1 - t * t;
      c.strokeStyle = p.color;
      c.lineWidth = p.size;
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018);
      c.stroke();
    }
    c.restore();

    // 3. A faint, fast pressure ring.
    for (const s of juice.shockwaves) {
      const t = s.age / s.life;
      const eased = 1 - Math.pow(1 - t, 3);
      c.strokeStyle = `rgba(255, 245, 230, ${0.28 * (1 - t)})`;
      c.lineWidth = 2 + 4 * (1 - t);
      c.beginPath();
      c.arc(s.x, s.y, s.radius * (s.inward ? 1 - eased : eased), 0, Math.PI * 2);
      c.stroke();
    }
  }
}
