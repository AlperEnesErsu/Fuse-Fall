import type { ChargeKind } from '../core/level';
import { distance, type Vec2 } from '../core/math';
import type { LevelSession } from '../core/session';
import { TUNING } from '../core/tuning';
import type { SoundDirector } from '../presentation/audio';
import type { Coach } from '../presentation/coach';
import { BADGE_RADIUS, removeBadgeOf, type Renderer } from '../presentation/renderer';
import { T } from '../presentation/strings';
import type { Ui } from '../presentation/ui';

const DRAG_THRESHOLD = 6;
/** Finger-sized pick area for charges on touch screens, in CSS pixels. */
const TOUCH_PICK_CSS_PX = 30;
/** While a finger drags, the charge rides this far above it (CSS px), so the finger does not hide it. */
const TOUCH_LIFT_CSS_PX = 46;

/** Elements that handle the keyboard themselves, so the game's shortcuts leave them alone. */
const isControl = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  target.closest('button, a[href], input, select, textarea, [role="button"], [role="radio"], [contenteditable="true"]') !== null;

interface PointerState {
  /** The charge pressed on, if any. */
  readonly chargeId: number | undefined;
  /** Pressed on the selected charge's remove badge. */
  readonly onBadge: boolean;
  readonly touch: boolean;
  readonly start: Vec2;
  moved: boolean;
  /** Where the finger or mouse is now (world px). */
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

/**
 * Pointer and keyboard on the play field.
 *
 * Touch: press and slide to aim (the charge rides above the finger, a loupe
 * shows the spot), lift to place. A quick tap places at once. A tap a little
 * off lands on the nearest allowed spot. Tapping a charge selects it rather
 * than deleting it: tap it again to turn a rolling charge round, tap the red
 * badge to remove it, drag it to move it.
 */
export class PlayInput {
  private pointer: PointerState | undefined;
  private hover: Vec2 | undefined;
  private selectedId: number | undefined;

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

  /** Drops a press in progress and any selection (a new job starts). */
  reset(): void {
    this.pointer = undefined;
    this.selectedId = undefined;
  }

  /** The charge the player has selected, while it still exists. */
  get selected(): number | undefined {
    const id = this.selectedId;
    return id !== undefined && this.controls.session()?.charges.some((c) => c.id === id) ? id : undefined;
  }

  /** Where a new charge would go now: under a hovering mouse, or above a finger aiming on empty ground. */
  get preview(): { readonly position: Vec2; readonly valid: boolean } | undefined {
    const s = this.controls.session();
    if (!s || s.phase !== 'placing' || s.stockLeft(this.controls.chargeKind()) <= 0) return undefined;
    const p = this.pointer;
    const aim = p ? (p.chargeId === undefined && !p.onBadge && p.moved ? this.aimOf(p) : undefined) : this.hover;
    if (!aim || (!p && s.chargeAt(aim))) return undefined;
    return this.spotFor(s, aim);
  }

  /** The charge being dragged, at the spot it would land. */
  get drag(): { readonly id: number; readonly position: Vec2 } | undefined {
    const p = this.pointer;
    const s = this.controls.session();
    if (!p?.moved || p.chargeId === undefined || !s) return undefined;
    const charge = s.charges.find((c) => c.id === p.chargeId);
    const aim = this.aimOf(p);
    return { id: p.chargeId, position: (charge && s.snapPlacement(aim, charge.kind, charge.id)) ?? aim };
  }

  /** A finger aiming or dragging: the loupe shows this spot. */
  get loupe(): Vec2 | undefined {
    const p = this.pointer;
    if (!p?.touch || !p.moved || p.onBadge) return undefined;
    return this.drag?.position ?? this.preview?.position;
  }

  /** Where the pointer aims: with a finger that is dragging, a little above the fingertip. */
  private aimOf(p: PointerState): Vec2 {
    if (!p.touch || !p.moved) return p.position;
    return { x: p.position.x, y: p.position.y - TOUCH_LIFT_CSS_PX * this.renderer.worldPerCssPixel };
  }

  private pickRadius(touch: boolean): number {
    return touch ? Math.max(TUNING.charge.pickRadius, TOUCH_PICK_CSS_PX * this.renderer.worldPerCssPixel) : TUNING.charge.pickRadius;
  }

  private bind(): void {
    const c = this.canvas;
    const ctl = this.controls;
    c.addEventListener('pointerdown', (e) => {
      this.sound.unlock();
      const s = ctl.session();
      if (!s || s.phase !== 'placing') return;
      const p = this.renderer.toWorld(e.clientX, e.clientY);
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        // A pointer the browser no longer tracks: the press still works, just without capture.
      }
      const touch = e.pointerType !== 'mouse';
      if (touch) goFullscreen();
      const radius = this.pickRadius(touch);
      const selected = s.charges.find((ch) => ch.id === this.selected);
      // The badge sits just above its charge: a press counts for it only when it is nearer the badge than the charge.
      const toBadge = selected ? distance(removeBadgeOf(selected.position), p) : Infinity;
      const onBadge = selected !== undefined && toBadge <= Math.max(BADGE_RADIUS, radius * 0.8) && toBadge < distance(selected.position, p);
      this.pointer = {
        chargeId: onBadge ? undefined : s.chargeAt(p, radius)?.id,
        onBadge,
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
      if (distance(p, this.pointer.start) > DRAG_THRESHOLD) this.pointer.moved = true;
    });
    c.addEventListener('pointerleave', () => (this.hover = undefined));
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointercancel', () => (this.pointer = undefined));
    c.addEventListener('pointerup', (e) => {
      const s = ctl.session();
      const ptr = this.pointer;
      const drag = this.drag;
      const preview = this.preview;
      this.pointer = undefined;
      if (!s || !ptr) return;
      // Smash play: every tap is a blast, before and after the first.
      if (s.level.instantBlasts && !ptr.moved && !ctl.replaying()) {
        const chosen = ctl.chargeKind();
        const kind = chosen === 'bomb' || chosen === 'roller' ? 'standard' : chosen;
        if (s.strike(this.renderer.toWorld(e.clientX, e.clientY), kind).ok) ctl.refreshHud();
        return;
      }
      if (s.phase !== 'placing') return;
      if (ptr.onBadge) {
        if (!ptr.moved && this.selectedId !== undefined) {
          s.removeCharge(this.selectedId);
          this.selectedId = undefined;
        }
      } else if (ptr.chargeId !== undefined) {
        if (drag) this.moveTo(s, ptr.chargeId, drag.position);
        else this.tapCharge(s, ptr.chargeId);
      } else {
        this.selectedId = undefined;
        this.place(s, ptr.moved ? preview : this.spotFor(s, ptr.position));
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
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected !== undefined && s.phase === 'placing') {
        s.removeCharge(this.selected);
        this.selectedId = undefined;
        ctl.refreshHud();
      } else if (e.key === 'r' || e.key === 'R') ctl.restart(s.level.id);
      else if (e.key === 'Escape') ctl.back();
    });
  }

  private spotFor(s: LevelSession, aim: Vec2): { readonly position: Vec2; readonly valid: boolean } {
    const spot = s.snapPlacement(aim, this.controls.chargeKind());
    return { position: spot ?? aim, valid: spot !== undefined };
  }

  private place(s: LevelSession, spot: { readonly position: Vec2; readonly valid: boolean } | undefined): void {
    if (!spot) {
      // Nothing of this kind left: say so rather than stay silent.
      if (s.stockLeft(this.controls.chargeKind()) <= 0) {
        this.sound.denied();
        this.ui.toast(T.placement['no-charges-left']);
      }
      return;
    }
    const placed = s.placeCharge(spot.position, undefined, this.controls.chargeKind());
    if (!placed.ok) {
      this.sound.denied();
      this.ui.toast(T.placement[placed.error]);
      return;
    }
    this.sound.click();
    this.coach.notify('placed', s.charges.length);
  }

  private moveTo(s: LevelSession, id: number, position: Vec2): void {
    if (s.moveCharge(id, position).ok) this.sound.click();
    else this.sound.denied();
  }

  /** A tap on a charge selects it; a second tap turns a rolling or directional charge round (other kinds just stay selected). */
  private tapCharge(s: LevelSession, id: number): void {
    const charge = s.charges.find((c) => c.id === id);
    if (!charge) return;
    if (this.selectedId === id && (charge.kind === 'roller' || charge.kind === 'directional')) {
      s.flipCharge(id);
      this.sound.click();
      return;
    }
    this.selectedId = this.selectedId === id ? undefined : id;
  }
}

/** On phones, play full screen, held either way. Browsers may refuse; that is fine. */
const goFullscreen = (): void => {
  const root = document.documentElement;
  if (document.fullscreenElement || !root.requestFullscreen) return;
  root.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
};
