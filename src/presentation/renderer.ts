import { WORLD } from '../core/level';
import { hashString, type Vec2 } from '../core/math';
import type { EntityView, LevelSession } from '../core/session';
import { TUNING } from '../core/tuning';
import type { JuiceDirector } from './juice';
import { MATERIAL_COLORS, PALETTE } from './palette';
import { paintScene, SCENE_MARGIN, skyAt } from './scenery';

export interface Overlay {
  /** Placement preview under the pointer. */
  readonly ghost: { readonly position: Vec2; readonly valid: boolean } | undefined;
  /** A charge being dragged: hidden at its old spot, drawn at `position`. */
  readonly drag: { readonly id: number; readonly position: Vec2 } | undefined;
  readonly time: number;
}

/** Draws the logical 960×540 world letterboxed into the canvas. */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private scene = { city: 'ankara', progress: 0 };
  /** The backdrop is static per level, so it is painted once and blitted each frame. */
  private backdrop: { key: string; canvas: HTMLCanvasElement } | undefined;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { clientWidth: w, clientHeight: h } = this.canvas;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.scale = Math.min(this.canvas.width / WORLD.width, this.canvas.height / WORLD.height);
    this.offsetX = (this.canvas.width - WORLD.width * this.scale) / 2;
    this.offsetY = (this.canvas.height - WORLD.height * this.scale) / 2;
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

  toWorld(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * this.canvas.width;
    const py = ((clientY - rect.top) / rect.height) * this.canvas.height;
    return { x: (px - this.offsetX) / this.scale, y: (py - this.offsetY) / this.scale };
  }

  draw(session: LevelSession | undefined, juice: JuiceDirector, overlay: Overlay): void {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#0d1020';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const shake = juice.shake();
    const zoom = 1 + juice.zoom;
    c.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
    c.translate(WORLD.width / 2 + shake.x, WORLD.height / 2 + shake.y);
    c.rotate(shake.angle);
    c.scale(zoom, zoom);
    c.translate(-WORLD.width / 2, -WORLD.height / 2);

    const m = SCENE_MARGIN;
    c.drawImage(this.paintedBackdrop(), -m, -m, WORLD.width + 2 * m, WORLD.height + 2 * m);
    this.scorches(juice);
    if (session) {
      if (session.phase === 'placing') {
        this.zones(session, overlay.time);
        this.routes(session, overlay.time);
      }
      const threatened = session.phase === 'placing' ? this.blastRadii(session, overlay) : new Set<string>();
      for (const e of session.view()) this.entity(e, overlay.time, threatened.has(e.id));
      this.charges(session, overlay);
    }
    this.effects(juice);

    const flash = juice.flashAlpha();
    if (flash > 0) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = `rgba(255, 226, 190, ${flash})`;
      c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private paintedBackdrop(): HTMLCanvasElement {
    const key = `${this.scene.city}:${this.scene.progress}:${this.scale}`;
    if (this.backdrop?.key === key) return this.backdrop.canvas;
    const m = SCENE_MARGIN;
    const canvas = this.backdrop?.canvas ?? document.createElement('canvas');
    canvas.width = Math.ceil((WORLD.width + 2 * m) * this.scale);
    canvas.height = Math.ceil((WORLD.height + 2 * m) * this.scale);
    const c = canvas.getContext('2d');
    if (c) {
      c.setTransform(this.scale, 0, 0, this.scale, m * this.scale, m * this.scale);
      paintScene(c, this.scene.city, skyAt(this.scene.progress));
    }
    this.backdrop = { key, canvas };
    return canvas;
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
      if (!e.car || !e.car.driving || e.shape.kind !== 'rect') continue;
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
    if (e.shape.kind === 'circle') {
      this.barrel(e.shape.r, time);
    } else if (e.car) {
      this.car(e, e.shape.w, e.shape.h);
    } else {
      this.block(e, e.shape.w, e.shape.h, threatened);
    }
    c.restore();
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
    const colors = MATERIAL_COLORS[e.material];
    const debris = e.kind === 'debris';
    c.fillStyle = colors.fill;
    c.fillRect(-w / 2, -h / 2, w, h);
    if (e.protected) {
      this.facade(w, h, e.compromised || threatened);
    } else if (e.anchored) {
      this.girder(w, h);
    } else if (!debris) {
      this.pattern(e.material, w, h, colors.detail);
    }
    if (e.damage > 0.25 && !debris) this.cracks(e.id, w, h, e.damage);
    c.strokeStyle = 'rgba(0,0,0,0.4)';
    c.lineWidth = 1.5;
    c.strokeRect(-w / 2, -h / 2, w, h);
    if (e.target) this.targetMark(Math.min(w, h), e.down);
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

  /** Surveyor-style target mark: a ring with crosshair ticks, greyed out once down. */
  private targetMark(size: number, down: boolean): void {
    const c = this.ctx;
    const r = size * 0.3;
    c.strokeStyle = down ? PALETTE.targetDown : PALETTE.target;
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      c.moveTo(dx * r * 0.45, dy * r * 0.45);
      c.lineTo(dx * r * 1.45, dy * r * 1.45);
    }
    c.stroke();
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

  /** Each material has its own pattern as well as colour (NFR-10, colour blindness). */
  private pattern(material: EntityView['material'], w: number, h: number, color: string): void {
    const c = this.ctx;
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = 1.5;
    switch (material) {
      case 'wood': {
        c.beginPath();
        const along = w >= h;
        for (let i = 1; i < 3; i++) {
          if (along) {
            c.moveTo(-w / 2 + 3, -h / 2 + (h * i) / 3);
            c.lineTo(w / 2 - 3, -h / 2 + (h * i) / 3);
          } else {
            c.moveTo(-w / 2 + (w * i) / 3, -h / 2 + 3);
            c.lineTo(-w / 2 + (w * i) / 3, h / 2 - 3);
          }
        }
        c.stroke();
        break;
      }
      case 'glass':
        c.beginPath();
        c.moveTo(-w / 2 + 4, h / 2 - 4);
        c.lineTo(-w / 2 + Math.min(w, h) * 0.6, -h / 2 + 4);
        c.stroke();
        break;
      case 'concrete':
        for (let x = -w / 2 + 6; x < w / 2 - 3; x += 9) {
          for (let y = -h / 2 + 6; y < h / 2 - 3; y += 9) c.fillRect(x, y, 2, 2);
        }
        break;
      case 'metal':
        for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          c.beginPath();
          c.arc(x * (w / 2 - 5), y * (h / 2 - 5), 2, 0, Math.PI * 2);
          c.fill();
        }
        break;
    }
  }

  /** Deterministic cracks per block that grow with damage. */
  private cracks(id: string, w: number, h: number, damage: number): void {
    const c = this.ctx;
    let seed = hashString(id);
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    c.strokeStyle = 'rgba(10,10,20,0.7)';
    c.lineWidth = 1.2;
    c.beginPath();
    const lines = Math.ceil(damage * 4);
    for (let i = 0; i < lines; i++) {
      let x = (rnd() - 0.5) * w * 0.6;
      let y = (rnd() - 0.5) * h * 0.6;
      c.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        x += (rnd() - 0.5) * w * 0.4;
        y += (rnd() - 0.5) * h * 0.4;
        c.lineTo(Math.max(-w / 2, Math.min(w / 2, x)), Math.max(-h / 2, Math.min(h / 2, y)));
      }
    }
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
      .map((ch) => ch.position);
    if (overlay.drag) centres.push(overlay.drag.position);
    else if (overlay.ghost?.valid) centres.push(overlay.ghost.position);
    const threatened = new Set<string>();
    c.save();
    c.setLineDash([6, 6]);
    c.lineWidth = 1.5;
    for (const centre of centres) {
      const hits = session.protectedReachedFrom(centre);
      hits.forEach((id) => threatened.add(id));
      const danger = hits.length > 0;
      c.fillStyle = danger ? 'rgba(229, 72, 77, 0.10)' : 'rgba(242, 177, 52, 0.06)';
      c.strokeStyle = danger ? 'rgba(229, 72, 77, 0.85)' : 'rgba(242, 177, 52, 0.55)';
      c.beginPath();
      c.arc(centre.x, centre.y, TUNING.charge.radius, 0, Math.PI * 2);
      c.fill();
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
        this.charge(ch.position, i + 1, false, overlay.time);
        this.delayTag(ch.position, ch.delay);
      });
      if (overlay.drag) this.charge(overlay.drag.position, 0, false, overlay.time, 0.7);
      if (overlay.ghost && !overlay.drag) this.ghost(overlay.ghost.position, overlay.ghost.valid);
    } else {
      for (const p of session.armedCharges) this.charge(p, 0, true, overlay.time);
    }
  }

  /** A plastic explosive brick with a detonator and status LED; the LED blinks fast once armed. */
  private charge(p: Vec2, index: number, armed: boolean, time: number, alpha = 1): void {
    const c = this.ctx;
    c.save();
    c.globalAlpha = alpha;
    c.translate(p.x, p.y);
    c.fillStyle = '#5f6a3e';
    c.fillRect(-13, -8, 26, 16);
    c.fillStyle = '#4d5733';
    c.fillRect(-13, -2, 26, 4);
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
          const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
          g.addColorStop(0, mixRgba(p.color, '#a4602c', warmth, alpha));
          g.addColorStop(0.55, mixRgba(p.color, '#a4602c', warmth, alpha * 0.7));
          g.addColorStop(1, mixRgba(p.color, '#a4602c', warmth, 0));
          c.fillStyle = g;
          c.beginPath();
          c.arc(p.x, p.y, radius, 0, Math.PI * 2);
          c.fill();
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
      g.addColorStop(0, `rgba(255, 190, 110, ${a})`);
      g.addColorStop(0.4, `rgba(255, 120, 50, ${a * 0.35})`);
      g.addColorStop(1, 'rgba(255, 100, 40, 0)');
      c.fillStyle = g;
      c.fillRect(l.x - l.radius, l.y - l.radius, l.radius * 2, l.radius * 2);
    }
    for (const f of juice.flames) {
      const t = f.age / f.life;
      const r = f.radius * (0.7 + t * 0.9);
      const heat = 1 - t;
      const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, `rgba(255, ${Math.round(200 + 50 * heat)}, ${Math.round(120 * heat * heat)}, ${0.9 * heat})`);
      g.addColorStop(0.45, `rgba(255, ${Math.round(110 + 60 * heat)}, 30, ${0.6 * heat})`);
      g.addColorStop(1, 'rgba(160, 40, 10, 0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(f.x, f.y, r, 0, Math.PI * 2);
      c.fill();
    }
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
      c.arc(s.x, s.y, s.radius * eased, 0, Math.PI * 2);
      c.stroke();
    }
  }
}

/** Blends two #rrggbb colours (`t` = share of `b`) into an rgba() string. */
const mixRgba = (a: string, b: string, t: number, alpha: number): string => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `rgba(${ch(16)}, ${ch(8)}, ${ch(0)}, ${alpha})`;
};
