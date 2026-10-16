import { EventBus, type GameEvents } from '../core/events';
import type { LevelDefinition } from '../core/level';
import type { Vec2 } from '../core/math';
import { TUNING } from '../core/tuning';
import type { SaveRepository } from '../core/ports';
import {
  isLevelUnlocked,
  levelsOf,
  recordScore,
  recordStars,
  totalStars,
  updateSettings,
  worldStars,
  worldStatus,
  type Campaign,
  type Progress,
  type Settings,
} from '../core/progress';
import { LevelSession } from '../core/session';
import { MatterPhysicsWorld } from '../infrastructure/matter-physics';
import { SoundDirector } from '../presentation/audio';
import { JuiceDirector } from '../presentation/juice';
import { Renderer } from '../presentation/renderer';
import { T } from '../presentation/strings';
import { Ui } from '../presentation/ui';
import { FixedStepLoop } from './loop';

const DRAG_THRESHOLD = 6;
/** Finger-sized pick area for charges on touch screens, in CSS pixels. */
const TOUCH_PICK_CSS_PX = 30;
/** Pause after the level settles before the result panel slides in. */
const RESULT_DELAY_MS = 450;

interface PointerState {
  readonly chargeId: number | undefined;
  readonly touch: boolean;
  readonly start: Vec2;
  moved: boolean;
  position: Vec2;
}

/** Composition root and screen flow. Wires core, infrastructure and presentation together. */
export class Game {
  private readonly events = new EventBus<GameEvents>();
  private readonly renderer: Renderer;
  private readonly juice: JuiceDirector;
  private readonly sound: SoundDirector;
  private readonly ui: Ui;
  private readonly loop: FixedStepLoop;
  private progress: Progress;
  private session: LevelSession | undefined;
  private pointer: PointerState | undefined;
  private hover: Vec2 | undefined;
  private time = 0;
  /** The city the player last browsed, so "back" returns to it. */
  private currentWorld = 1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    uiRoot: HTMLElement,
    private readonly campaign: Campaign,
    private readonly saves: SaveRepository,
    private readonly vibrate: (ms: number) => void,
  ) {
    this.progress = saves.load();
    const settings = (): Settings => this.progress.settings;
    this.renderer = new Renderer(canvas);
    this.juice = new JuiceDirector(this.events, settings);
    this.sound = new SoundDirector(this.events, settings);
    this.ui = new Ui(uiRoot, () => this.sound.unlock());
    this.loop = new FixedStepLoop({
      timeScale: (dt) => this.juice.simDelta(dt),
      step: (dt) => this.session?.step(dt),
      frame: (realDt, simDt) => this.frame(realDt, simDt),
    });
    this.events.on('explosion', (e) => this.buzz(e.source === 'charge' ? 45 : 30));
    this.events.on('carWrecked', () => this.buzz(60));
    this.events.on('protectedDamaged', () => {
      this.sound.denied();
      this.buzz(120);
      this.ui.toast(T.report.reasons['collateral-damage'], 2200);
    });
    this.events.on('levelFinished', (e) => this.onFinished(e.result));
    this.bindInput();
  }

  start(): void {
    this.renderer.resize();
    window.addEventListener('resize', () => this.renderer.resize());
    this.loop.start();
    this.showMenu();
  }

  // ---- screens -------------------------------------------------------------

  private showMenu(): void {
    this.leaveLevel();
    this.ui.menu(totalStars(this.progress), () => this.showCities(), () => this.showSettings());
  }

  private showCities(): void {
    this.leaveLevel();
    const worlds = this.campaign.worlds;
    this.ui.cityMap(
      worlds.map((world, i) => ({
        world,
        status: worldStatus(this.progress, this.campaign, world.world),
        stars: worldStars(this.progress, this.campaign, world.world),
        maxStars: levelsOf(this.campaign, world.world).length * 3,
        previousCity: worlds[i - 1]?.city,
      })),
      Math.max(0, worlds.findIndex((w) => w.world === this.currentWorld)),
      (world) => this.showLevels(world),
      () => this.showMenu(),
    );
  }

  private showLevels(world = this.currentWorld): void {
    this.leaveLevel();
    const def = this.campaign.worlds.find((w) => w.world === world);
    if (!def) return this.showCities();
    this.currentWorld = world;
    this.renderer.setScene(def.key, 0.3);
    const levels = levelsOf(this.campaign, world);
    this.ui.levelSelect(
      def,
      worldStars(this.progress, this.campaign, world),
      levels.length * 3,
      levels.map((level) => ({
        level,
        stars: this.progress.stars[level.id] ?? 0,
        best: this.progress.best[level.id],
        unlocked: isLevelUnlocked(this.progress, this.campaign, level.id),
      })),
      (id) => this.startLevel(id),
      () => this.showCities(),
    );
  }

  private leaveLevel(): void {
    this.session = undefined;
    this.juice.reset();
  }

  private showSettings(): void {
    this.ui.settings(
      this.progress.settings,
      (patch) => {
        this.progress = updateSettings(this.progress, patch);
        this.saves.save(this.progress);
        this.sound.applyVolumes();
      },
      () => this.sound.test(),
      () => this.showMenu(),
    );
  }

  /** Instant restart: a new session and physics world are cheap to build (FR-10). */
  private startLevel(id: string): void {
    const level = this.campaign.levels.find((l) => l.id === id);
    const city = this.campaign.worlds.find((w) => w.world === level?.world);
    if (!level || !city) return;
    const cityLevels = levelsOf(this.campaign, level.world);
    this.currentWorld = level.world;
    this.juice.reset();
    this.pointer = undefined;
    // Each city runs from dawn (first level) to night (last level).
    this.renderer.setScene(city.key, cityLevels.length > 1 ? (level.order - 1) / (cityLevels.length - 1) : 0);
    this.session = new LevelSession(level, new MatterPhysicsWorld(), this.events);
    this.ui.showHud(() => this.fire(), () => this.startLevel(id), () => this.showLevels());
    this.refreshHud();
    if (this.progress.stars[id] === undefined) {
      const fallback = level.blocks.some((b) => b.protected)
        ? T.protectedHint
        : level.cars.length > 0
          ? T.carHint
          : T.placeHint;
      this.ui.toast(level.hint ?? fallback, 3200);
    }
  }

  private fire(): void {
    if (this.session?.fire().ok) {
      this.sound.fuse();
      this.ui.setFireVisible(false);
      this.refreshHud();
    }
  }

  private onFinished(result: NonNullable<LevelSession['result']>): void {
    const session = this.session;
    if (!session) return;
    const level = session.level;
    const previousBest = this.progress.best[level.id] ?? 0;
    this.progress = recordScore(recordStars(this.progress, level.id, result.stars), level.id, result.score);
    this.saves.save(this.progress);
    const next = this.nextLevel(level);
    const cityDone = levelsOf(this.campaign, level.world).every((l) => (this.progress.stars[l.id] ?? 0) > 0);
    const lastInCity = next === undefined;
    const city = this.campaign.worlds.find((w) => w.world === level.world)?.city ?? '';
    window.setTimeout(() => {
      if (this.session !== session) return;
      const info = {
        city,
        order: level.order,
        par: level.charges.par,
        bonusCollapse: level.bonusCollapse,
        best: Math.max(previousBest, result.score),
        newBest: result.score > previousBest,
        cityComplete: lastInCity && cityDone,
      };
      this.ui.report(result, info, {
        onRetry: () => this.startLevel(level.id),
        onNext: !result.success
          ? undefined
          : next && isLevelUnlocked(this.progress, this.campaign, next.id)
            ? () => this.startLevel(next.id)
            : lastInCity
              ? () => this.showCities()
              : undefined,
        nextLabel: lastInCity ? T.cities : T.next,
        onLevels: () => this.showLevels(),
      });
    }, RESULT_DELAY_MS);
  }

  private nextLevel(level: LevelDefinition): LevelDefinition | undefined {
    const same = levelsOf(this.campaign, level.world);
    return same[same.indexOf(level) + 1];
  }

  // ---- frame ---------------------------------------------------------------

  private frame(realDt: number, simDt: number): void {
    this.time += realDt;
    this.juice.update(realDt, simDt);
    if (this.session?.phase === 'running') this.refreshHud();
    const placing = this.session?.phase === 'placing';
    const ghostAt = this.pointer?.moved ? undefined : this.hover;
    this.renderer.draw(this.session, this.juice, {
      time: this.time,
      ghost:
        placing && ghostAt && !this.session?.chargeAt(ghostAt) && this.session && this.session.chargesLeft > 0
          ? { position: ghostAt, valid: this.session.canPlaceAt(ghostAt).ok }
          : undefined,
      drag:
        placing && this.pointer?.moved && this.pointer.chargeId !== undefined
          ? { id: this.pointer.chargeId, position: this.pointer.position }
          : undefined,
    });
  }

  private refreshHud(): void {
    const s = this.session;
    if (!s) return;
    this.ui.updateHud({
      levelOrder: s.level.order,
      levelName: s.level.name,
      chargesUsed: s.charges.length,
      protectedTotal: s.level.blocks.filter((b) => b.protected).length,
      chargesMax: s.level.charges.max,
      par: s.level.charges.par,
      targetsLeft: s.targetsRemaining,
      canFire: s.phase === 'placing' && s.charges.length > 0,
    });
  }

  // ---- input ---------------------------------------------------------------

  private bindInput(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      this.sound.unlock();
      const s = this.session;
      if (!s || s.phase !== 'placing') return;
      const p = this.renderer.toWorld(e.clientX, e.clientY);
      c.setPointerCapture(e.pointerId);
      const touch = e.pointerType !== 'mouse';
      if (touch) this.goFullscreen();
      const radius = touch
        ? Math.max(TUNING.charge.pickRadius, TOUCH_PICK_CSS_PX * this.renderer.worldPerCssPixel)
        : TUNING.charge.pickRadius;
      this.pointer = { chargeId: s.chargeAt(p, radius)?.id, touch, start: p, moved: false, position: p };
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
      const s = this.session;
      const ptr = this.pointer;
      this.pointer = undefined;
      if (!s || !ptr || s.phase !== 'placing') return;
      const p = this.renderer.toWorld(e.clientX, e.clientY);
      if (ptr.chargeId !== undefined) {
        if (!ptr.moved) s.removeCharge(ptr.chargeId);
        else if (!s.moveCharge(ptr.chargeId, p).ok) this.sound.denied();
        else this.sound.click();
      } else if (!ptr.moved) {
        const placed = s.placeCharge(p);
        if (!placed.ok) {
          this.sound.denied();
          this.ui.toast(T.placement[placed.error]);
        }
      }
      this.refreshHud();
    });
    window.addEventListener('keydown', (e) => {
      if (!this.session) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.fire();
      }
      else if (e.key === 'r' || e.key === 'R') this.startLevel(this.session.level.id);
      else if (e.key === 'Escape') this.showLevels();
    });
  }

  /** On phones, play full screen in landscape. Browsers may refuse; that is fine. */
  private goFullscreen(): void {
    const root = document.documentElement;
    if (document.fullscreenElement || !root.requestFullscreen) return;
    root
      .requestFullscreen({ navigationUI: 'hide' })
      .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
      .catch(() => undefined);
  }

  private buzz(ms: number): void {
    if (this.progress.settings.haptics) this.vibrate(ms);
  }
}
