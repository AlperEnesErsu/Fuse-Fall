import { EventBus, type GameEvents } from '../core/events';
import type { ChargeKind, LevelDefinition } from '../core/level';
import type { Vec2 } from '../core/math';
import { TUNING } from '../core/tuning';
import type { SaveRepository } from '../core/ports';
import { payout, rankOf } from '../core/economy';
import {
  buyItem,
  chooseBlastStyle,
  earnScrap,
  isLevelUnlocked,
  levelsOf,
  currentStreak,
  recordDailyWin,
  recordScore,
  recordStars,
  unlockAchievements,
  totalStars,
  updateSettings,
  worldStars,
  worldStatus,
  type Campaign,
  type Progress,
  type Settings,
  type WorldStatus,
} from '../core/progress';
import { LevelSession } from '../core/session';
import { MatterPhysicsWorld } from '../infrastructure/matter-physics';
import { shareClip } from '../infrastructure/share-clip';
import { ClipRecorder } from '../presentation/clip-recorder';
import { SoundDirector } from '../presentation/audio';
import { JuiceDirector } from '../presentation/juice';
import { Renderer } from '../presentation/renderer';
import { T, language, resolveLanguage, setLanguage } from '../presentation/strings';
import { Ui } from '../presentation/ui';
import { Coach } from '../presentation/coach';
import { tutorialFor } from '../content/tutorials';
import { SANDBOX_TEMPLATES, sandboxLevel } from '../content/sandbox';
import { WORKSHOP, activeBlastStyle, isOwned, structureItemId, workshopItem } from '../content/workshop';
import { contentText, type ContentText } from '../content/text';
import { ACHIEVEMENTS } from '../core/achievements';
import { FIXED_STEP, FixedStepLoop } from './loop';
import { newAchievements, type AttemptStats } from '../core/achievements';
import { dailyChallenge, dayOf } from '../core/daily';
import type { LevelResult } from '../core/scoring';

const DRAG_THRESHOLD = 6;
/** The delay timeline is taught in London (part 3); earlier parts are designed around the default sequence. */
const TIMELINE_FROM_WORLD = 3;
/** Finger-sized pick area for charges on touch screens, in CSS pixels. */
const TOUCH_PICK_CSS_PX = 30;
/** Pause after the level settles before the result panel slides in. */
const RESULT_DELAY_MS = 450;
/** Replays run at this fraction of real time. */
const REPLAY_SPEED = 0.45;
/**
 * Test switch: VITE_UNLOCK_ALL=1 (in the git-ignored .env.local) opens every city
 * and mission without touching the save. Remove the line to play the real progression.
 */
const UNLOCK_ALL = import.meta.env.VITE_UNLOCK_ALL === '1';

type Mode =
  | { readonly kind: 'campaign' }
  | { readonly kind: 'daily'; readonly day: string; readonly baseId: string }
  | { readonly kind: 'sandbox'; readonly template: string };

/** One go at a mission: what it is, what the player did, and how to show it again. */
interface Attempt {
  readonly level: LevelDefinition;
  readonly mode: Mode;
  readonly replaying: boolean;
  /** Captured at Fire, so the same physics can be re-simulated for the replay. */
  plan:
    | {
        readonly charges: readonly { position: Vec2; delay: number; kind: ChargeKind }[];
        readonly fireSteps: number;
        /** Detonator presses, in fixed steps after Fire. */
        readonly presses: number[];
      }
    | undefined;
  stats: { barrelsBlown: number; carsWrecked: number };
  /** The attempt's result, once it has settled. */
  result: LevelResult | undefined;
  /** The report shown after the attempt, re-shown when a replay ends. */
  report: (() => void) | undefined;
}

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
  /** The clip being recorded from a replay, if any. */
  private clip: ClipRecorder | undefined;
  private readonly sound: SoundDirector;
  private readonly ui: Ui;
  private readonly coach: Coach;
  private readonly loop: FixedStepLoop;
  private progress: Progress;
  private session: LevelSession | undefined;
  private attempt: Attempt | undefined;
  private pointer: PointerState | undefined;
  private hover: Vec2 | undefined;
  private time = 0;
  /** The city the player last browsed, so "back" returns to it. */
  private currentWorld = 1;
  /** The charge type the next placement uses. */
  private chargeKind: ChargeKind = 'standard';
  /** Display text for missions and cities in the current language. */
  private text: ContentText;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    uiRoot: HTMLElement,
    private readonly campaign: Campaign,
    private readonly saves: SaveRepository,
    private readonly vibrate: (ms: number) => void,
  ) {
    this.progress = saves.load();
    this.text = this.applyLanguage();
    const settings = (): Settings => this.progress.settings;
    this.renderer = new Renderer(canvas);
    this.juice = new JuiceDirector(this.events, settings, () =>
      activeBlastStyle(this.progress.workshop.owned, this.progress.workshop.blastStyle),
    );
    this.sound = new SoundDirector(this.events, settings);
    this.ui = new Ui(uiRoot, () => this.sound.unlock());
    this.coach = new Coach(uiRoot);
    this.loop = new FixedStepLoop({
      timeScale: (dt) => this.juice.simDelta(dt) * (this.attempt?.replaying ? REPLAY_SPEED : 1),
      step: (dt) => this.stepSession(dt),
      frame: (realDt, simDt) => this.frame(realDt, simDt),
    });
    this.events.on('explosion', (e) => {
      this.buzz(e.source === 'charge' ? 45 : 30);
      if (e.source === 'barrel' && this.attempt && !this.attempt.replaying)
        this.attempt.stats.barrelsBlown++;
    });
    this.events.on('carWrecked', () => {
      this.buzz(60);
      if (this.attempt && !this.attempt.replaying) this.attempt.stats.carsWrecked++;
    });
    this.events.on('protectedDamaged', () => {
      if (this.attempt?.replaying) return;
      this.sound.denied();
      this.buzz(120);
      this.ui.toast(T.report.reasons['collateral-damage'], 2200);
    });
    this.events.on('levelFinished', (e) => this.onFinished(e.result));
    this.bindInput();
  }

  start(): void {
    this.loop.start();
    this.showMenu();
  }

  // ---- screens -------------------------------------------------------------

  private showMenu(): void {
    this.leaveLevel();
    const today = dayOf(new Date());
    const daily = dailyChallenge(this.campaign, this.progress, today);
    const next = this.nextMission();
    const nextWorld = next && this.campaign.worlds.find((w) => w.world === next.world);
    this.ui.menu({
      totalStars: totalStars(this.progress),
      next: next && nextWorld && { label: `${this.text.city(nextWorld)} ${String(next.order).padStart(2, '0')} · ${this.text.levelName(next)}` },
      onContinue: () => next && this.startLevel(next.id),
      daily: daily && {
        name: this.text.levelName(daily.base),
        streak: currentStreak(this.progress, today),
        wonToday: this.progress.daily.lastWon === today,
      },
      achievements: { unlocked: this.progress.achievements.length, total: ACHIEVEMENTS.length },
      onPlay: () => this.showCities(),
      onDaily: () => this.startDaily(),
      onFreeSite: () => this.showFreeSite(),
      onWorkshop: () => this.showWorkshop(),
      scrap: this.progress.wallet.balance,
      rank: rankOf(this.progress.wallet.earned),
      onAchievements: () => this.showAchievements(),
      onSettings: () => this.showSettings(),
    });
  }

  private showAchievements(): void {
    this.leaveLevel();
    this.ui.achievements(
      ACHIEVEMENTS.map((a) => ({
        ...T.achievements[a.id],
        unlocked: this.progress.achievements.includes(a.id),
      })),
      () => this.showMenu(),
    );
  }

  /** The workshop: spend scrap on blast styles and Free Site structures, and pick the blast style. */
  private showWorkshop(): void {
    this.leaveLevel();
    const { owned } = this.progress.workshop;
    const active = activeBlastStyle(owned, this.progress.workshop.blastStyle);
    this.ui.workshop(
      {
        scrap: this.progress.wallet.balance,
        rank: rankOf(this.progress.wallet.earned),
        items: WORKSHOP.map((item) => ({
          id: item.id,
          kind: item.kind,
          name: item.name[language],
          description: item.description[language],
          cost: item.cost,
          owned: isOwned(owned, item),
          active: item.id === active,
        })),
      },
      {
        onBuy: (id) => {
          const item = workshopItem(id);
          if (!item) return;
          const bought = buyItem(this.progress, item);
          if (!bought.ok) {
            this.sound.denied();
            this.ui.toast(T.workshop.errors[bought.error]);
            return;
          }
          this.progress = item.kind === 'blast-style' ? chooseBlastStyle(bought.value, item.id) : bought.value;
          this.saves.save(this.progress);
          this.showWorkshop();
        },
        onEquip: (id) => {
          this.progress = chooseBlastStyle(this.progress, id);
          this.saves.save(this.progress);
          this.showWorkshop();
        },
        onBack: () => this.showMenu(),
      },
    );
  }

  /** Progression rules, unless the test switch opens everything that has missions. */
  private worldStatus(world: number): WorldStatus {
    const status = worldStatus(this.progress, this.campaign, world);
    return UNLOCK_ALL && status.kind === 'locked' ? { kind: 'open' } : status;
  }

  private levelUnlocked(levelId: string): boolean {
    return UNLOCK_ALL || isLevelUnlocked(this.progress, this.campaign, levelId);
  }

  /** Free Site setup: pick an opened city and a structure. */
  private showFreeSite(world = this.currentWorld, template = SANDBOX_TEMPLATES[0]?.id ?? ''): void {
    this.leaveLevel();
    const cities = this.campaign.worlds
      .filter((w) => this.worldStatus(w.world).kind === 'open')
      .map((w) => ({ world: w.world, name: this.text.city(w) }));
    const chosen = cities.some((c) => c.world === world) ? world : (cities[0]?.world ?? 1);
    const templates = SANDBOX_TEMPLATES.filter((t) => {
      const item = workshopItem(structureItemId(t.id));
      return item === undefined || isOwned(this.progress.workshop.owned, item);
    });
    this.ui.freeSite(
      cities,
      templates.map((t) => ({ id: t.id, name: t.name[language] })),
      templates.length < SANDBOX_TEMPLATES.length,
      { world: chosen, template },
      (pick) => this.showFreeSite(pick.world, pick.template),
      () => {
        const t = SANDBOX_TEMPLATES.find((x) => x.id === template);
        if (t) this.play(sandboxLevel(t, chosen), { kind: 'sandbox', template });
      },
      () => this.showMenu(),
    );
  }

  private startDaily(): void {
    const today = dayOf(new Date());
    const daily = dailyChallenge(this.campaign, this.progress, today);
    if (daily) this.play(daily.level, { kind: 'daily', day: today, baseId: daily.base.id });
  }

  private showCities(): void {
    this.leaveLevel();
    const worlds = this.campaign.worlds;
    this.ui.cityMap(
      worlds.map((world, i) => {
        const previous = worlds[i - 1];
        return {
          world,
          city: this.text.city(world),
          country: this.text.country(world),
          status: this.worldStatus(world.world),
          stars: worldStars(this.progress, this.campaign, world.world),
          maxStars: levelsOf(this.campaign, world.world).length * 3,
          previousCity: previous && this.text.city(previous),
        };
      }),
      Math.max(
        0,
        worlds.findIndex((w) => w.world === this.currentWorld),
      ),
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
      this.text.city(def),
      worldStars(this.progress, this.campaign, world),
      levels.length * 3,
      levels.map((level) => ({
        level,
        name: this.text.levelName(level),
        stars: this.progress.stars[level.id] ?? 0,
        best: this.progress.best[level.id],
        unlocked: this.levelUnlocked(level.id),
      })),
      (id) => this.startLevel(id),
      () => this.showCities(),
    );
  }

  private leaveLevel(): void {
    this.session = undefined;
    this.attempt = undefined;
    this.juice.reset();
    this.coach.stop();
    this.ui.hideReplay();
  }

  private showSettings(): void {
    this.ui.settings(
      this.progress.settings,
      (patch) => {
        this.progress = updateSettings(this.progress, patch);
        this.saves.save(this.progress);
        this.sound.applyVolumes();
        if (patch.language !== undefined) {
          this.text = this.applyLanguage();
          this.showSettings();
        }
      },
      () => this.sound.test(),
      () => this.showMenu(),
    );
  }

  /** The first open mission not yet won, in campaign order. */
  private nextMission(): LevelDefinition | undefined {
    for (const world of this.campaign.worlds) {
      for (const level of levelsOf(this.campaign, world.world)) {
        if ((this.progress.stars[level.id] ?? 0) === 0 && this.levelUnlocked(level.id)) return level;
      }
    }
    return undefined;
  }

  /** Takes back the most recently placed charge. */
  private undoCharge(): void {
    const s = this.session;
    const last = s?.charges[s.charges.length - 1];
    if (!s || !last || s.phase !== 'placing') return;
    s.removeCharge(last.id);
    this.refreshHud();
  }

  private startLevel(id: string): void {
    const level = this.campaign.levels.find((l) => l.id === id);
    if (level) this.play(level, { kind: 'campaign' });
  }

  /** Instant restart: a new session and physics world are cheap to build (FR-10). */
  private play(level: LevelDefinition, mode: Mode): void {
    const base =
      mode.kind === 'daily' ? this.campaign.levels.find((l) => l.id === mode.baseId) : level;
    const city = this.campaign.worlds.find((w) => w.world === level.world);
    if (!city || !base) return;
    const cityLevels = levelsOf(this.campaign, level.world);
    this.currentWorld = level.world;
    this.juice.reset();
    this.ui.hideReplay();
    this.pointer = undefined;
    // Each city runs from dawn (first level) to night (last level).
    this.renderer.setScene(
      city.key,
      cityLevels.length > 1 ? (level.order - 1) / (cityLevels.length - 1) : 0,
    );
    this.session = new LevelSession(level, new MatterPhysicsWorld(), this.events);
    this.attempt = {
      level,
      mode,
      replaying: false,
      plan: undefined,
      stats: { barrelsBlown: 0, carsWrecked: 0 },
      result: undefined,
      report: undefined,
    };
    this.ui.showHud({
      kinds: level.chargeKinds,
      skyInUse: level.dropZones.length > 0,
      onFire: () => this.fire(),
      onDetonate: () => this.detonate(),
      onRetry: () => this.play(level, mode),
      onUndo: () => this.undoCharge(),
      onMenu: () => (mode.kind === 'campaign' ? this.showLevels() : mode.kind === 'sandbox' ? this.showFreeSite(level.world, mode.template) : this.showMenu()),
      onDelay: (chargeId, seconds) => {
        if (this.session?.setChargeDelay(chargeId, seconds).ok) {
          this.coach.notify('delay');
          this.refreshHud();
        }
      },
      onKind: (kind) => {
        this.chargeKind = kind;
        this.ui.setChargeKind(kind);
        this.coach.notify('kind');
        if (kind === 'implosion') this.ui.toast(T.implosionHint, 3200);
      },
    });
    this.chargeKind = level.chargeKinds[0] ?? 'standard';
    this.ui.setChargeKind(this.chargeKind);
    this.refreshHud();
    // New ideas are coached step by step until the mission is cleared once; otherwise a one-line hint.
    const cleared = (this.progress.stars[base.id] ?? 0) > 0;
    const tutorial = cleared || mode.kind === 'daily' ? undefined : tutorialFor(level.id, language);
    this.coach.start(tutorial ?? []);
    if (mode.kind === 'sandbox') {
      this.ui.toast(T.freeSiteHint, 3600);
    } else if (mode.kind === 'daily') {
      this.ui.toast(T.dailyRule(level.charges.par), 3200);
    } else if (!tutorial && !cleared) {
      const fallback = level.chargeKinds.includes('bomb')
        ? T.bombHint
        : level.cars.some((c) => c.protected)
        ? T.trainHint
        : level.footprint
          ? T.footprintHint
          : level.blocks.some((b) => b.protected)
            ? T.protectedHint
            : level.cars.length > 0
              ? T.carHint
              : T.placeHint;
      this.ui.toast(this.text.levelHint(level) ?? fallback, 3200);
    }
  }

  /** Re-simulates the attempt from its recorded plan and shows the collapse again in slow motion. */
  private replay(): void {
    const a = this.attempt;
    if (!a?.plan) return;
    this.juice.reset();
    const session = new LevelSession(a.level, new MatterPhysicsWorld(), this.events);
    for (const c of a.plan.charges) session.placeCharge(c.position, c.delay, c.kind);
    // Cars cruise while placing, so fast-forward to the exact step the player fired on.
    for (let i = 0; i < a.plan.fireSteps; i++) session.step(FIXED_STEP);
    session.fire();
    this.session = session;
    this.attempt = { ...a, replaying: true };
    this.ui.hideScreen();
    this.ui.showReplay(() => this.endReplay(false));
  }

  /** `complete`: the replay ran to the end (rather than being skipped). */
  private endReplay(complete: boolean): void {
    const a = this.attempt;
    if (!a?.replaying) return;
    this.attempt = { ...a, replaying: false };
    this.ui.hideReplay();
    const clip = this.clip;
    this.clip = undefined;
    if (clip) void this.deliverClip(clip, complete);
    a.report?.();
  }

  /** Records the replay as a vertical clip, then offers it to the share sheet. */
  private recordClip(): void {
    const a = this.attempt;
    if (!a?.plan || !a.result || this.clip) return;
    if (!ClipRecorder.supported()) {
      this.ui.toast(T.clip.unsupported);
      return;
    }
    const pct = Math.round(a.result.collapseRatio * 100);
    const world = this.campaign.worlds.find((w) => w.world === a.level.world);
    const place = world ? this.text.city(world) : '';
    const mode = a.mode;
    const sandbox = mode.kind === 'sandbox';
    const template = mode.kind === 'sandbox' ? SANDBOX_TEMPLATES.find((t) => t.id === mode.template) : undefined;
    this.clip = new ClipRecorder(this.canvas, {
      title: sandbox
        ? `${T.freeSite} · ${template?.name[language] ?? ''} · ${place}`
        : `${place} ${String(a.level.order).padStart(2, '0')} · ${this.displayName(a.level)}`,
      stamp: sandbox ? T.clip.sandbox(pct) : a.result.success ? T.clip.win(pct) : T.clip.fail,
      success: sandbox || a.result.success,
    });
    this.replay();
    this.clip.start(this.sound.captureStream());
    this.ui.toast(T.clip.recording, 1600);
  }

  private async deliverClip(clip: ClipRecorder, complete: boolean): Promise<void> {
    const blob = await clip.stop();
    if (!complete) return;
    if (!blob) {
      this.ui.toast(T.clip.failed);
      return;
    }
    const outcome = await shareClip(blob, `fuse-and-fall-${Date.now()}.${clip.extension}`, T.clip.shareTitle);
    if (outcome === 'failed') this.ui.toast(T.clip.failed);
    else if (outcome === 'saved') this.ui.toast(T.clip.saved);
  }

  private fire(): void {
    const s = this.session;
    if (s && this.attempt && s.phase === 'placing') {
      this.attempt.plan = {
        charges: s.charges.map((c) => ({ position: c.position, delay: c.delay, kind: c.kind })),
        fireSteps: Math.round(s.clock / FIXED_STEP),
        presses: [],
      };
    }
    if (this.session?.fire().ok) {
      this.coach.notify('fired');
      this.sound.fuse();
      this.ui.setFireVisible(false);
      this.refreshHud();
    }
  }

  /** The detonator: sets off every falling bomb now, and remembers when for the replay. */
  private detonate(): void {
    const s = this.session;
    if (!s || s.phase !== 'running' || this.attempt?.replaying) return;
    if (s.detonateBombs() === 0) return;
    this.attempt?.plan?.presses.push(Math.round(s.elapsedSinceFire / FIXED_STEP));
    this.coach.notify('detonated');
  }

  /** One fixed step; during a replay, the recorded detonator presses happen at the same step. */
  private stepSession(dt: number): void {
    const s = this.session;
    if (!s) return;
    s.step(dt);
    const a = this.attempt;
    if (a?.replaying && a.plan && s.phase === 'running') {
      const k = Math.round(s.elapsedSinceFire / FIXED_STEP);
      if (a.plan.presses.includes(k)) s.detonateBombs();
    }
  }

  private onFinished(result: LevelResult): void {
    const session = this.session;
    const attempt = this.attempt;
    if (!session || !attempt) return;
    if (attempt.replaying) {
      window.setTimeout(() => this.endReplay(true), RESULT_DELAY_MS * 2);
      return;
    }
    attempt.result = result;
    if (attempt.mode.kind === 'sandbox') {
      const mode = attempt.mode;
      attempt.report = () =>
        this.ui.freeSiteDone(result, {
          onReset: () => this.play(attempt.level, mode),
          onReplay: () => this.replay(),
          onShare: () => this.recordClip(),
          onSetup: () => this.showFreeSite(attempt.level.world, mode.template),
        });
      window.setTimeout(() => {
        if (this.session === session) attempt.report?.();
      }, RESULT_DELAY_MS);
      return;
    }
    const level = attempt.level;
    const today = dayOf(new Date());
    const previousBest = this.progress.best[level.id] ?? 0;
    // The company is paid for what came down; the first win of a job (or of the day's daily) pays in full.
    const firstClear =
      attempt.mode.kind === 'daily'
        ? this.progress.daily.lastWon !== attempt.mode.day
        : (this.progress.stars[level.id] ?? 0) === 0;
    const pay = payout(result, { firstClear, daily: attempt.mode.kind === 'daily' });
    const rankBefore = rankOf(this.progress.wallet.earned).index;
    this.progress = earnScrap(this.progress, pay.total);
    const rankAfter = rankOf(this.progress.wallet.earned).index;
    if (attempt.mode.kind === 'daily') {
      this.progress = recordScore(this.progress, level.id, result.score);
      if (result.success) this.progress = recordDailyWin(this.progress, attempt.mode.day);
    } else {
      this.progress = recordScore(
        recordStars(this.progress, level.id, result.stars),
        level.id,
        result.score,
      );
    }
    const stats: AttemptStats = {
      ...attempt.stats,
      implosions: attempt.plan?.charges.filter((c) => c.kind === 'implosion').length ?? 0,
      detonations: attempt.plan?.presses.length ?? 0,
    };
    const earned = newAchievements({
      progress: this.progress,
      campaign: this.campaign,
      result,
      stats,
      streak: currentStreak(this.progress, today),
    });
    this.progress = unlockAchievements(
      this.progress,
      earned.map((a) => a.id),
    );
    this.saves.save(this.progress);

    const daily = attempt.mode.kind === 'daily';
    const next = daily ? undefined : this.nextLevel(level);
    const cityDone = levelsOf(this.campaign, level.world).every(
      (l) => (this.progress.stars[l.id] ?? 0) > 0,
    );
    const lastInCity = !daily && next === undefined;
    const world = this.campaign.worlds.find((w) => w.world === level.world);
    const city = world ? this.text.city(world) : '';
    attempt.report = () =>
      this.ui.report(
        result,
        {
          city: daily ? T.dailyTitle : city,
          order: level.order,
          par: level.charges.par,
          bonusCollapse: level.bonusCollapse,
          best: Math.max(previousBest, result.score),
          newBest: result.score > previousBest,
          cityComplete: lastInCity && cityDone,
          payout: pay,
          promotedTo: rankAfter > rankBefore ? rankAfter : undefined,
        },
        {
          onRetry: () => this.play(level, attempt.mode),
          onReplay: () => this.replay(),
          onShare: () => this.recordClip(),
          onNext: daily
            ? () => this.showMenu()
            : !result.success
              ? undefined
              : next && this.levelUnlocked(next.id)
                ? () => this.startLevel(next.id)
                : lastInCity
                  ? () => this.showCities()
                  : undefined,
          nextLabel: daily ? T.menu : lastInCity ? T.cities : T.next,
          onLevels: () => (daily ? this.showMenu() : this.showLevels()),
        },
      );
    window.setTimeout(() => {
      if (this.session !== session) return;
      attempt.report?.();
      if (earned.length > 0) {
        this.ui.toast(
          T.achievementUnlocked(earned.map((a) => T.achievements[a.id].title).join(' · ')),
          3200,
        );
      }
    }, RESULT_DELAY_MS);
  }

  /** A daily mission shows its base mission's name. */
  private displayName(level: LevelDefinition): string {
    const mode = this.attempt?.mode;
    const base =
      mode?.kind === 'daily' ? this.campaign.levels.find((l) => l.id === mode.baseId) : undefined;
    return this.text.levelName(base ?? level);
  }

  /** Picks the language from the saved choice (or the device) and returns the matching content text. */
  private applyLanguage(): ContentText {
    setLanguage(
      resolveLanguage(this.progress.settings.language, navigator.languages ?? [navigator.language]),
    );
    return contentText(language);
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
    this.coach.refresh();
    this.renderer.draw(this.session, this.juice, {
      time: this.time,
      coach: this.coach.worldMarker,
      kind: this.chargeKind,
      ghost:
        placing &&
        ghostAt &&
        !this.session?.chargeAt(ghostAt) &&
        this.session &&
        this.session.chargesLeft > 0
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
      levelName: this.displayName(s.level),
      chargesUsed: s.charges.length,
      protectedTotal: s.protectedTotal,
      chargesMax: s.level.charges.max,
      par: s.level.charges.par,
      targetsLeft: s.targetsRemaining,
      showTargets: s.level.blocks.some((b) => b.target) || s.level.cars.some((c) => c.target),
      canFire: s.phase === 'placing' && s.charges.length > 0,
      canUndo: s.phase === 'placing' && s.charges.length > 0 && !this.attempt?.replaying,
    });
    this.ui.setDetonateVisible(s.phase === 'running' && s.liveBombs > 0 && !this.attempt?.replaying);
    this.ui.updateTimeline(
      s.charges.map((c, i) => ({ id: c.id, label: i + 1, delay: c.delay })),
      s.phase === 'placing' && (s.level.world >= TIMELINE_FROM_WORLD || this.attempt?.mode.kind === 'sandbox'),
    );
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
        const placed = s.placeCharge(p, undefined, this.chargeKind);
        if (!placed.ok) {
          this.sound.denied();
          this.ui.toast(T.placement[placed.error]);
        } else {
          this.coach.notify('placed', s.charges.length);
        }
      }
      this.refreshHud();
    });
    window.addEventListener('keydown', (e) => {
      if (!this.session) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (this.session.phase === 'running') this.detonate();
        else this.fire();
      } else if (e.key === 'r' || e.key === 'R') this.startLevel(this.session.level.id);
      else if (e.key === 'Escape') this.showLevels();
    });
  }

  /** On phones, play full screen in landscape. Browsers may refuse; that is fine. */
  private goFullscreen(): void {
    const root = document.documentElement;
    if (document.fullscreenElement || !root.requestFullscreen) return;
    root
      .requestFullscreen({ navigationUI: 'hide' })
      .then(() =>
        (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.(
          'landscape',
        ),
      )
      .catch(() => undefined);
  }

  private buzz(ms: number): void {
    if (this.progress.settings.haptics) this.vibrate(ms);
  }
}
