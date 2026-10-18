import type { EventBus, GameEvents } from '../core/events';
import type { ChargeKind, LevelDefinition } from '../core/level';
import { levelsOf, type Campaign } from '../core/progress';
import type { ContractDef } from '../core/contracts';
import type { LevelResult } from '../core/scoring';
import { LevelSession } from '../core/session';
import { MatterPhysicsWorld } from '../infrastructure/matter-physics';
import { shareClip } from '../infrastructure/share-clip';
import { SANDBOX_TEMPLATES } from '../content/sandbox';
import type { ContentText } from '../content/text';
import { tutorialFor } from '../content/tutorials';
import { featureCard, featuresOf, newFeatures, type FeatureId } from '../content/features';
import { markFeaturesSeen } from '../core/progress';
import { activeLook } from '../content/workshop';
import type { SoundDirector } from '../presentation/audio';
import { FULL_VIEW, focusOf } from '../presentation/camera';
import { ClipRecorder } from '../presentation/clip-recorder';
import type { Coach } from '../presentation/coach';
import type { JuiceDirector } from '../presentation/juice';
import { setBlockTheme } from '../presentation/materials-art';
import type { Renderer } from '../presentation/renderer';
import { T, language } from '../presentation/strings';
import type { Ui } from '../presentation/ui';
import { newAttempt, settleJob, settleOneShot, type Attempt, type Mode } from './attempt';
import { FIXED_STEP } from './loop';
import type { Ledger, OfferDesk } from './offer-desk';
import { PlayInput } from './play-input';
import type { Progression } from './progression';
import type { Launcher, Navigator } from './screen-flow';

/** The delay timeline is taught in London (part 3); earlier parts are designed around the default sequence. */
const TIMELINE_FROM_WORLD = 3;
/** Pause after the level settles before the result panel slides in. */
const RESULT_DELAY_MS = 450;
/** Missed attempts at a job (this session) before the hint button appears. */
const HINT_AFTER_FAILURES = 2;
/** After this many misses the hint also lays out the whole solution as outlines to copy. */
const SOLUTION_AFTER_FAILURES = 4;
/** Replays run at this fraction of real time. */
const REPLAY_SPEED = 0.45;
/** Shared clips are kept short for Shorts and Reels: closer to real time than the slow-motion replay. */
const CLIP_REPLAY_SPEED = 0.8;

export interface PlayDeps {
  readonly canvas: HTMLCanvasElement;
  readonly campaign: Campaign;
  readonly ledger: Ledger;
  readonly access: Progression;
  readonly text: () => ContentText;
  readonly events: EventBus<GameEvents>;
  readonly renderer: Renderer;
  readonly juice: JuiceDirector;
  readonly sound: SoundDirector;
  readonly ui: Ui;
  readonly coach: Coach;
  readonly desk: Pick<OfferDesk, 'canDouble' | 'watchAd'>;
  /** The screens, created after play. */
  readonly nav: () => Navigator;
  readonly buzz: (ms: number) => void;
}

/** A job in play: placing, firing, the detonator, the result and payout, the replay and its shared clip. */
export class PlayController implements Launcher {
  /** Jobs missed in a row this session (not cleared), for offering hints; and which hint is next. */
  private readonly failures = new Map<string, number>();
  private hintIndex = 0;
  /** The hint shows the whole solution as outlines (after enough misses, or once every step was shown). */
  private showSolution = false;
  /** The clip being recorded from a replay, if any. */
  private clip: ClipRecorder | undefined;
  private session: LevelSession | undefined;
  private attempt: Attempt | undefined;
  private time = 0;
  /** The charge type the next placement uses. */
  private chargeKind: ChargeKind = 'standard';
  private readonly input: PlayInput;

  constructor(private readonly d: PlayDeps) {
    const { events, sound, ui } = d;
    events.on('explosion', (e) => {
      d.buzz(e.source === 'charge' ? 45 : 30);
      if (this.attempt && !this.attempt.replaying) {
        this.attempt.stats.blasts++;
        if (e.source === 'barrel') this.attempt.stats.barrelsBlown++;
      }
    });
    events.on('carWrecked', () => {
      d.buzz(60);
      if (this.attempt && !this.attempt.replaying) this.attempt.stats.carsWrecked++;
    });
    events.on('protectedDamaged', () => {
      if (this.attempt?.replaying) return;
      sound.denied();
      d.buzz(120);
      ui.toast(T.report.reasons['collateral-damage'], 2200);
    });
    events.on('levelFinished', (e) => this.onFinished(e.result));
    this.input = new PlayInput(d.canvas, d.renderer, sound, ui, d.coach, {
      session: () => this.session,
      replaying: () => this.attempt?.replaying ?? false,
      chargeKind: () => this.chargeKind,
      fire: () => this.fire(),
      detonate: () => this.detonate(),
      refreshHud: () => this.refreshHud(),
      restart: (id) => this.startLevel(id),
      back: () => d.nav().levels(),
    });
  }

  /** How fast simulated time runs against real time: slower during a replay. */
  get speed(): number {
    return this.attempt?.replaying ? (this.clip ? CLIP_REPLAY_SPEED : REPLAY_SPEED) : 1;
  }

  /** Ends the job (if any) for a menu screen. */
  leave(): void {
    this.d.renderer.setFocus(FULL_VIEW);
    this.d.sound.setMood('menu');
    this.session = undefined;
    this.attempt = undefined;
    this.d.juice.reset();
    this.d.coach.stop();
    this.d.ui.hideReplay();
  }

  startLevel(id: string): void {
    const level = this.d.campaign.levels.find((l) => l.id === id);
    if (level) this.play(level, { kind: 'campaign' });
  }

  /** Instant restart: a new session and physics world are cheap to build (FR-10). */
  play(level: LevelDefinition, mode: Mode): void {
    const { campaign, renderer, ui, coach } = this.d;
    const base = mode.kind === 'daily' ? campaign.levels.find((l) => l.id === mode.baseId) : level;
    const city = campaign.worlds.find((w) => w.world === level.world);
    if (!city || !base) return;
    const progress = this.d.ledger.get();
    const cityLevels = levelsOf(campaign, level.world);
    this.d.nav().enterWorld(level.world);
    this.d.juice.reset();
    ui.hideReplay();
    this.input.reset();
    // Each city runs from dawn (first level) to night (last level).
    renderer.setScene(city.key, cityLevels.length > 1 ? (level.order - 1) / (cityLevels.length - 1) : 0);
    setBlockTheme(activeLook(progress.workshop.owned, progress.workshop.blockTheme, 'block-theme'));
    renderer.setFocus(focusOf(level));
    this.d.sound.setMood('plan', city.key);
    this.hintIndex = 0;
    this.showSolution = false;
    this.session = new LevelSession(level, new MatterPhysicsWorld(), this.d.events);
    this.perchBirds(this.session);
    this.attempt = newAttempt(level, mode);
    ui.showHud({
      kinds: level.chargeKinds,
      skyInUse: level.dropZones.length > 0 || level.balls.length > 0,
      onFire: () => this.fire(),
      onDetonate: () => this.detonate(),
      onRetry: () => this.play(level, mode),
      onUndo: () => this.undoCharge(),
      onHint: () => this.showHint(),
      onMenu: () => {
        const nav = this.d.nav();
        if (mode.kind === 'campaign') nav.levels();
        else if (mode.kind === 'sandbox') nav.freeSite(level.world, mode.template, mode.variant, mode.traffic);
        else nav.menu();
      },
      onDelay: (chargeId, seconds) => {
        if (this.session?.setChargeDelay(chargeId, seconds).ok) {
          coach.notify('delay');
          this.refreshHud();
        }
      },
      onKind: (kind) => {
        this.chargeKind = kind;
        ui.setChargeKind(kind);
        coach.notify('kind');
        if (kind === 'implosion') ui.toast(T.implosionHint, 3200);
      },
      onHelp: featuresOf(level).length > 0 ? () => this.showFeatureCards(featuresOf(level), false) : undefined,
    });
    this.chargeKind = level.chargeKinds[0] ?? 'standard';
    ui.setChargeKind(this.chargeKind);
    this.refreshHud();
    // Anything new in this job gets its card first; the coaching starts once the cards are read.
    const fresh = mode.kind === 'campaign' ? newFeatures(level, progress.seenFeatures) : [];
    if (fresh.length > 0) {
      this.d.ledger.set(markFeaturesSeen(progress, fresh));
      this.showFeatureCards(fresh, true, () => this.begin(level, mode, base.id));
    } else {
      this.begin(level, mode, base.id);
    }
  }

  /** The feature cards for a job: new ones before it starts, all of them from the HUD's "?". */
  private showFeatureCards(ids: readonly FeatureId[], fresh: boolean, then?: () => void): void {
    const cards = ids.map((id) => {
      const c = featureCard(id);
      return { title: c.title[language], text: c.text[language], tip: c.tip[language] };
    });
    this.d.ui.featureCards(cards, fresh, () => then?.());
  }

  /** Coaching or the one-line hint that opens a job. */
  private begin(level: LevelDefinition, mode: Mode, baseId: string): void {
    const { ui, coach } = this.d;
    const progress = this.d.ledger.get();
    const base = { id: baseId };
    // New ideas are coached step by step until the mission is cleared once; otherwise a one-line hint.
    const cleared = (progress.stars[base.id] ?? 0) > 0;
    const tutorial = cleared || mode.kind === 'daily' ? undefined : tutorialFor(level.id, language);
    // A crane fills the top-left sky; its jobs coach from the bottom-left instead.
    coach.start(tutorial ?? [], level.balls.length > 0);
    if (mode.kind === 'sandbox') {
      ui.toast(T.freeSiteModes[mode.variant].hint, 3600);
      if (mode.variant === 'smash') ui.setFireVisible(false);
    } else if (mode.kind === 'daily') {
      ui.toast(T.dailyRule(level.charges.par), 3200);
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
      ui.toast(this.d.text().levelHint(level) ?? fallback, 3200);
    }
  }

  /** One fixed step; during a replay, the recorded detonator presses happen at the same step. */
  step(dt: number): void {
    const s = this.session;
    if (!s) return;
    s.step(dt);
    const a = this.attempt;
    if (a?.replaying && a.plan && s.phase === 'running') {
      const k = Math.round(s.elapsedSinceFire / FIXED_STEP);
      if (a.plan.presses.includes(k)) s.detonateBombs();
    }
  }

  frame(realDt: number, simDt: number): void {
    this.time += realDt;
    this.d.juice.update(realDt, simDt);
    if (this.session?.phase === 'running') this.refreshHud();
    const placing = this.session?.phase === 'placing';
    this.d.coach.refresh();
    this.d.renderer.draw(this.session, this.d.juice, {
      time: this.time,
      coach: this.d.coach.worldMarker,
      kind: this.chargeKind,
      ghost: placing ? this.input.preview : undefined,
      drag: placing ? this.input.drag : undefined,
      selected: placing ? this.input.selected : undefined,
      loupe: placing ? this.input.loupe : undefined,
      solution:
        placing && this.showSolution && this.session
          ? this.session.level.solution.charges.map((c) => ({ position: { x: c.x, y: c.y }, kind: c.kind, delay: c.delay, direction: c.direction }))
          : undefined,
    });
  }

  /** Pigeons on the highest roofs of the job's structure (not on protected buildings). */
  private perchBirds(session: LevelSession): void {
    const roofs: { id: string; x: number; top: number; width: number }[] = [];
    for (const e of session.view()) {
      if (e.kind !== 'block' || e.anchored || e.protected || e.shape.kind !== 'rect' || Math.abs(e.state.angle) > 0.05) continue;
      roofs.push({ id: e.id, x: e.state.position.x, top: e.state.position.y - e.shape.h / 2, width: e.shape.w });
    }
    this.d.juice.perchBirds(roofs);
  }

  /**
   * Hints for a job the player keeps missing: each press points at the next charge
   * of the recorded solution (where, which kind, which delay) and says how to fire.
   */
  private showHint(): void {
    const s = this.session;
    if (!s || s.phase !== 'placing') return;
    const sol = s.level.solution;
    const timing = (sol.fireAt > 0 ? T.hint.fireAt(sol.fireAt.toFixed(1)) : '') +
      (sol.detonateAt[0] !== undefined ? T.hint.detonateAt(sol.detonateAt[0].toFixed(1)) : '');
    if (sol.charges.length === 0) {
      this.d.coach.start([{ text: T.hint.fireOnly + timing, highlight: { selector: '.fire-btn' }, until: 'fired' }], s.level.balls.length > 0);
      return;
    }
    const n = this.hintIndex % sol.charges.length;
    this.hintIndex++;
    // Still stuck: lay the whole solution out as outlines to copy.
    if (this.hintIndex > sol.charges.length || (this.failures.get(s.level.id) ?? 0) >= SOLUTION_AFTER_FAILURES) {
      if (!this.showSolution) this.d.ui.toast(T.hint.solution, 2600);
      this.showSolution = true;
    }
    const c = sol.charges[n];
    if (!c) return;
    const delay = c.delay !== undefined && c.delay > 0 ? T.hint.delay(Math.round(c.delay * 1000)) : '';
    this.d.coach.start(
      [{ text: T.hint.place(n + 1, sol.charges.length, T.chargeKinds[c.kind].toLowerCase(), delay) + (n === sol.charges.length - 1 ? timing : ''), highlight: { world: { x: c.x, y: c.y }, radius: 26 }, until: 'tap' }],
      s.level.balls.length > 0,
    );
  }

  /** Takes back the most recently placed charge. */
  private undoCharge(): void {
    const s = this.session;
    const last = s?.charges[s.charges.length - 1];
    if (!s || !last || s.phase !== 'placing') return;
    s.removeCharge(last.id);
    this.refreshHud();
  }

  private fire(): void {
    const s = this.session;
    if (s && this.attempt && s.phase === 'placing') {
      this.attempt.plan = {
        charges: s.charges.map((c) => ({ position: c.position, delay: c.delay, kind: c.kind, direction: c.direction })),
        fireSteps: Math.round(s.clock / FIXED_STEP),
        presses: [],
      };
    }
    if (this.session?.fire().ok) {
      this.d.coach.notify('fired');
      this.d.sound.fuse();
      this.d.sound.setMood('tension');
      this.d.ui.setFireVisible(false);
      this.refreshHud();
    }
  }

  /** The detonator: sets off every falling bomb now, and remembers when for the replay. */
  private detonate(): void {
    const s = this.session;
    if (!s || s.phase !== 'running' || this.attempt?.replaying) return;
    if (s.detonateBombs() === 0) return;
    this.attempt?.plan?.presses.push(Math.round(s.elapsedSinceFire / FIXED_STEP));
    this.d.coach.notify('detonated');
  }

  /** Re-simulates the attempt from its recorded plan and shows the collapse again in slow motion. */
  private replay(): void {
    const a = this.attempt;
    if (!a?.plan) return;
    this.d.juice.reset();
    const session = new LevelSession(a.level, new MatterPhysicsWorld(), this.d.events);
    for (const c of a.plan.charges) session.placeCharge(c.position, c.delay, c.kind, c.direction);
    // Cars cruise while placing, so fast-forward to the exact step the player fired on.
    for (let i = 0; i < a.plan.fireSteps; i++) session.step(FIXED_STEP);
    this.perchBirds(session);
    session.fire();
    this.session = session;
    this.attempt = { ...a, replaying: true };
    this.d.ui.hideScreen();
    this.d.ui.showReplay(() => this.endReplay(false));
  }

  /** `complete`: the replay ran to the end (rather than being skipped). */
  private endReplay(complete: boolean): void {
    const a = this.attempt;
    if (!a?.replaying) return;
    this.attempt = { ...a, replaying: false };
    this.d.ui.hideReplay();
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
      this.d.ui.toast(T.clip.unsupported);
      return;
    }
    const pct = Math.round(a.result.collapseRatio * 100);
    const world = this.d.campaign.worlds.find((w) => w.world === a.level.world);
    const place = world ? this.d.text().city(world) : '';
    const mode = a.mode;
    const sandbox = mode.kind === 'sandbox';
    const template = mode.kind === 'sandbox' ? SANDBOX_TEMPLATES.find((t) => t.id === mode.template) : undefined;
    this.clip = new ClipRecorder(this.d.canvas, {
      title: sandbox
        ? `${T.freeSite} · ${template?.name[language] ?? ''} · ${place}`
        : `${place} ${String(a.level.order).padStart(2, '0')} · ${this.displayName(a.level)}`,
      stamp: sandbox
        ? T.clip.sandbox(pct)
        : a.result.cleared
          ? T.clip.win(pct)
          : a.result.partial
            ? T.clip.partial(pct)
            : T.clip.fail,
      tone: sandbox || a.result.cleared ? 'win' : a.result.partial ? 'partial' : 'fail',
    }, () => this.d.renderer.visibleWorld());
    this.replay();
    this.clip.start(this.d.sound.captureStream());
    this.d.ui.toast(T.clip.recording, 1600);
  }

  private async deliverClip(clip: ClipRecorder, complete: boolean): Promise<void> {
    const blob = await clip.stop();
    if (!complete) return;
    if (!blob) {
      this.d.ui.toast(T.clip.failed);
      return;
    }
    const outcome = await shareClip(blob, `fuse-and-fall-${Date.now()}.${clip.extension}`, T.clip.shareTitle);
    if (outcome === 'failed') this.d.ui.toast(T.clip.failed);
    else if (outcome === 'saved') this.d.ui.toast(T.clip.saved);
  }

  private onFinished(result: LevelResult): void {
    const session = this.session;
    const attempt = this.attempt;
    if (!session || !attempt) return;
    const { ui, ledger } = this.d;
    this.d.sound.setMood('result');
    if (attempt.replaying) {
      window.setTimeout(() => this.endReplay(true), RESULT_DELAY_MS * 2);
      return;
    }
    attempt.result = result;
    if (attempt.mode.kind === 'campaign') {
      this.failures.set(attempt.level.id, result.cleared ? 0 : (this.failures.get(attempt.level.id) ?? 0) + 1);
    }
    if (attempt.mode.kind === 'sandbox') {
      const mode = attempt.mode;
      let record: { best: number; isNew: boolean } | undefined;
      if (mode.variant === 'one-shot') {
        const settled = settleOneShot(ledger.get(), mode.template, result);
        ledger.set(settled.progress);
        record = { best: settled.best, isNew: settled.isNew };
      }
      attempt.report = () =>
        ui.freeSiteDone(
          result,
          {
            onReset: () => this.play(attempt.level, mode),
            onReplay: () => this.replay(),
            onShare: () => this.recordClip(),
            onSetup: () => this.d.nav().freeSite(attempt.level.world, mode.template, mode.variant, mode.traffic),
          },
          record,
        );
      window.setTimeout(() => {
        if (this.session === session) attempt.report?.();
      }, RESULT_DELAY_MS);
      return;
    }
    const level = attempt.level;
    const job = settleJob(ledger.get(), this.d.campaign, attempt, result, new Date());
    ledger.set(job.progress);

    const daily = attempt.mode.kind === 'daily';
    const next = daily ? undefined : this.d.access.nextLevel(level);
    const cityDone = levelsOf(this.d.campaign, level.world).every((l) => (job.progress.stars[l.id] ?? 0) > 0);
    const lastInCity = !daily && next === undefined;
    const world = this.d.campaign.worlds.find((w) => w.world === level.world);
    const city = world ? this.d.text().city(world) : '';
    const nav = this.d.nav();
    attempt.report = () =>
      ui.report(
        result,
        {
          city: daily ? T.dailyTitle : city,
          order: level.order,
          par: level.charges.par,
          bonusCollapse: level.bonusCollapse,
          best: Math.max(job.previousBest, result.score),
          newBest: result.score > job.previousBest,
          cityComplete: lastInCity && cityDone,
          payout: job.payout,
          promotedTo: job.promotedTo,
          // A rewarded ad can double what the job paid, while today's ads last.
          onDouble: this.d.desk.canDouble(job.payout.total)
            ? () => void this.d.desk.watchAd(job.payout.total).then((ok) => ok && attempt.report?.())
            : undefined,
        },
        {
          onRetry: () => this.play(level, attempt.mode),
          onReplay: () => this.replay(),
          onShare: () => this.recordClip(),
          onNext: daily
            ? () => nav.menu()
            : !result.success
              ? undefined
              : next && this.d.access.levelUnlocked(next.id)
                ? () => this.startLevel(next.id)
                : lastInCity
                  ? () => nav.cities()
                  : undefined,
          nextLabel: daily ? T.menu : lastInCity ? T.cities : T.next,
          onLevels: () => (daily ? nav.menu() : nav.levels()),
        },
      );
    window.setTimeout(() => {
      if (this.session !== session) return;
      attempt.report?.();
      if (job.earned.length > 0) {
        ui.toast(T.achievementUnlocked(job.earned.map((a) => T.achievements[a.id].title).join(' · ')), 3200);
      }
      if (job.finishedContracts.length > 0) {
        window.setTimeout(() => this.contractsToast(job.finishedContracts), job.earned.length > 0 ? 3400 : 0);
      }
    }, RESULT_DELAY_MS);
  }

  private contractsToast(finished: readonly ContractDef[]): void {
    const names = finished.map((c) => T.contracts.kinds[c.kind](c.goal)).join(' · ');
    this.d.ui.toast(T.contracts.finished(names, finished.reduce((sum, c) => sum + c.reward, 0)), 3200);
  }

  /** A daily mission shows its base mission's name. */
  private displayName(level: LevelDefinition): string {
    const mode = this.attempt?.mode;
    const base = mode?.kind === 'daily' ? this.d.campaign.levels.find((l) => l.id === mode.baseId) : undefined;
    return this.d.text().levelName(base ?? level);
  }

  private refreshHud(): void {
    const s = this.session;
    if (!s) return;
    const { ui } = this.d;
    ui.updateHud({
      levelOrder: s.level.order,
      levelName: this.displayName(s.level),
      chargesUsed: s.charges.length,
      protectedTotal: s.protectedTotal,
      // Smash play has no charge budget to show.
      chargesMax: s.level.instantBlasts ? 0 : s.level.charges.max,
      par: s.level.instantBlasts ? 0 : s.level.charges.par,
      targetsLeft: s.targetsRemaining,
      showTargets: s.level.blocks.some((b) => b.target) || s.level.cars.some((c) => c.target),
      // With a wrecking ball on site, Fire also releases the crane, so it needs no charge.
      canFire: s.phase === 'placing' && (s.charges.length > 0 || s.level.balls.length > 0),
      canUndo: s.phase === 'placing' && s.charges.length > 0 && !this.attempt?.replaying,
      hintAvailable: s.phase === 'placing' && this.attempt?.mode.kind === 'campaign' && (this.failures.get(s.level.id) ?? 0) >= HINT_AFTER_FAILURES,
    });
    ui.setDetonateVisible(s.phase === 'running' && s.liveBombs > 0 && !this.attempt?.replaying);
    const stock = s.level.charges.stock;
    ui.setKindCounts(stock && s.phase === 'placing' ? Object.fromEntries(s.level.chargeKinds.map((k) => [k, s.stockLeft(k)])) : undefined);
    ui.updateTimeline(
      s.charges.map((c, i) => ({ id: c.id, label: i + 1, delay: c.delay })),
      s.phase === 'placing' && (s.level.world >= TIMELINE_FROM_WORLD || this.attempt?.mode.kind === 'sandbox'),
    );
  }
}
