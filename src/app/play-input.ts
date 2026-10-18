import type { ChargeKind } from '../core/level';
import type { Vec2 } from '../core/math';
import type { LevelSession } from '../core/session';
import { TUNING } from '../core/tuning';
import type { SoundDirector } from '../presentation/audio';
import type { Coach } from '../presentation/coach';
import type { Renderer } from '../presentation/renderer';
import { T } from '../presentation/strings';
import type { Ui } from '../presentation/ui';

const DRAG_THRESHOLD = 6;
/** Finger-sized pick area for charges on touch screens, in CSS pixels. */
const TOUCH_PICK_CSS_PX = 30;

/** Elements that handle the keyboard themselves, so the game's shortcuts leave them alone. */
const isControl = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  target.closest('button, a[href], input, select, textarea, [role="button"], [role="radio"], [contenteditable="true"]') !== null;

interface PointerState {
  readonly chargeId: number | undefined;
  readonly touch: boolean;
  readonly start: Vec2;
  moved: boolean;
  position: Vec2;
}

/** What input acts on: the job being played and its controls. */
export interface PlayControls {
  session(): LevelSession | undefined;
  replaying(): boolean;
  chargeKind(): ChargeKind;
  fire(): void;
  detonate(): void;
  refreshHud(): void;
  restart(levelId: string): void;
  back(): void;
}

/** Pointer and keyboard on the play field: place, drag, remove and strike charges, and the shortcuts. */
export class PlayInput {
  private pointer: PointerState | undefined;
  private hover: Vec2 | undefined;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly renderer: Renderer,
    private readonly sound: SoundDirector,
    private readonly ui: Ui,
    private readonly coach: Coach,
    private readonly controls: PlayControls,
  ) {
    this.bind();
  }

  /** Drops a press in progress (a new job starts). */
  reset(): void {
    this.pointer = undefined;
  }

  /** Where a mouse hovers without dragging: the ghost charge goes there. */
  get ghostAt(): Vec2 | undefined {
    return this.pointer?.moved ? undefined : this.hover;
  }

  /** The charge being dragged, if any. */
  get drag(): { readonly id: number; readonly position: Vec2 } | undefined {
    return this.pointer?.moved && this.pointer.chargeId !== undefined ? { id: this.pointer.chargeId, position: this.pointer.position } : undefined;
  }

  private bind(): void {
    const c = this.canvas;
    const ctl = this.controls;
    c.addEventListener('pointerdown', (e) => {
      this.sound.unlock();
      const s = ctl.session();
      if (!s || s.phase !== 'placing') return;
      const p = this.renderer.toWorld(e.clientX, e.clientY);
      c.setPointerCapture(e.pointerId);
      const touch = e.pointerType !== 'mouse';
      if (touch) goFullscreen();
      const radius = touch
        ? Math.max(TUNING.charge.pickRadius, TOUCH_PICK_CSS_PX * this.renderer.worldPerCssPixel)
        : TUNING.charge.pickRadius;
      this.pointer = {
        chargeId: s.chargeAt(p, radius)?.id,
        touch,
        start: p,
        moved: false,
        position: p,
      };
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.renderer.toWorld(e.clientX, e.clientY);
      this.hover = e.pointerType === 'mouse' ? p : undefined;
      if (!this.pointer) return;
      this.pointer.position = p;
      const dx = p.x - this.pointer.start.x;
      const dy = p.y - this.pointer.start.y;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) this.pointer.moved = true;
    });
    c.addEventListener('pointerleave', () => (this.hover = undefined));
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointercancel', () => (this.pointer = undefined));
    c.addEventListener('pointerup', (e) => {
      const s = ctl.session();
      const ptr = this.pointer;
      this.pointer = undefined;
      if (!s || !ptr) return;
      // Smash play: every tap is a blast, before and after the first.
      if (s.level.instantBlasts && !ptr.moved && !ctl.replaying()) {
        const chosen = ctl.chargeKind();
        const kind = chosen === 'bomb' ? 'standard' : chosen;
        if (s.strike(this.renderer.toWorld(e.clientX, e.clientY), kind).ok) ctl.refreshHud();
        return;
      }
      if (s.phase !== 'placing') return;
      const p = this.renderer.toWorld(e.clientX, e.clientY);
      if (ptr.chargeId !== undefined) {
        if (!ptr.moved) s.removeCharge(ptr.chargeId);
        else if (!s.moveCharge(ptr.chargeId, p).ok) this.sound.denied();
        else this.sound.click();
      } else if (!ptr.moved) {
        const placed = s.placeCharge(p, undefined, ctl.chargeKind());
        if (!placed.ok) {
          this.sound.denied();
          this.ui.toast(T.placement[placed.error]);
        } else {
          this.coach.notify('placed', s.charges.length);
        }
      }
      ctl.refreshHud();
    });
    window.addEventListener('keydown', (e) => {
      const s = ctl.session();
      // A focused control keeps its own keys: Enter on a report button presses that button.
      if (!s || isControl(e.target)) return;
      if (e.key === ' ' || e.key === 'Enter') {
        if (s.phase !== 'placing' && s.phase !== 'running') return;
        e.preventDefault();
        if (s.phase === 'running') ctl.detonate();
        else ctl.fire();
      } else if (e.key === 'r' || e.key === 'R') ctl.restart(s.level.id);
      else if (e.key === 'Escape') ctl.back();
    });
  }
}

/** On phones, play full screen, held either way. Browsers may refuse; that is fine. */
const goFullscreen = (): void => {
  const root = document.documentElement;
  if (document.fullscreenElement || !root.requestFullscreen) return;
  root.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
};
