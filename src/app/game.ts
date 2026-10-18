import { EventBus, type GameEvents } from '../core/events';
import type { OfferStore, SaveRepository } from '../core/ports';
import type { Campaign, Progress, Settings } from '../core/progress';
import { dayOf } from '../core/daily';
import { SoundDirector } from '../presentation/audio';
import { JuiceDirector } from '../presentation/juice';
import { Renderer } from '../presentation/renderer';
import { T, language, resolveLanguage, setLanguage } from '../presentation/strings';
import { Ui } from '../presentation/ui';
import { Coach } from '../presentation/coach';
import { activeLook } from '../content/workshop';
import { contentText, type ContentText } from '../content/text';
import { FixedStepLoop } from './loop';
import { OfferDesk, type Ledger } from './offer-desk';
import { PlayController } from './play-controller';
import { Progression } from './progression';
import { ScreenFlow } from './screen-flow';

/**
 * Test switch: VITE_UNLOCK_ALL=1 (in the git-ignored .env.local) opens every city
 * and mission without touching the save. Remove the line to play the real progression.
 */
const UNLOCK_ALL = import.meta.env.VITE_UNLOCK_ALL === '1';

/** Composition root. Wires core, infrastructure and presentation together. */
export class Game {
  private readonly renderer: Renderer;
  private readonly juice: JuiceDirector;
  private readonly sound: SoundDirector;
  /** Rewarded ads and scrap packs. */
  private readonly desk: OfferDesk;
  private readonly ui: Ui;
  private readonly loop: FixedStepLoop;
  /** Menu and setup screens. */
  private readonly screens: ScreenFlow;
  /** The job in play. */
  private readonly play: PlayController;
  private progress: Progress;
  /** Display text for missions and cities in the current language. */
  private text: ContentText;

  constructor(
    canvas: HTMLCanvasElement,
    uiRoot: HTMLElement,
    campaign: Campaign,
    private readonly saves: SaveRepository,
    private readonly vibrate: (ms: number) => void,
    offers: OfferStore,
  ) {
    this.progress = saves.load();
    const ledger: Ledger = {
      get: () => this.progress,
      set: (p) => {
        this.progress = p;
        return this.saves.save(p);
      },
    };
    this.desk = new OfferDesk(
      offers,
      ledger,
      (n) => this.ui.toast(n.kind === 'thanks' ? T.offers.thanks(n.scrap) : T.offers[n.kind]),
      () => dayOf(new Date()),
      import.meta.env.DEV,
    );
    void this.desk.settle().then((credited) => credited && this.ui.isShowing('workshop') && this.screens.workshop());
    this.text = this.applyLanguage();
    const settings = (): Settings => this.progress.settings;
    const events = new EventBus<GameEvents>();
    this.renderer = new Renderer(canvas);
    this.juice = new JuiceDirector(events, settings, () =>
      activeLook(this.progress.workshop.owned, this.progress.workshop.blastStyle, 'blast-style'),
    );
    this.sound = new SoundDirector(events, settings);
    this.ui = new Ui(uiRoot, () => this.sound.unlock());
    const access = new Progression(campaign, () => this.progress, UNLOCK_ALL);
    const text = (): ContentText => this.text;
    this.play = new PlayController({
      canvas,
      campaign,
      ledger,
      access,
      text,
      events,
      renderer: this.renderer,
      juice: this.juice,
      sound: this.sound,
      ui: this.ui,
      coach: new Coach(uiRoot),
      desk: this.desk,
      nav: () => this.screens,
      buzz: (ms) => this.buzz(ms),
    });
    this.screens = new ScreenFlow({
      campaign,
      ledger,
      access,
      text,
      ui: this.ui,
      renderer: this.renderer,
      sound: this.sound,
      desk: this.desk,
      offers,
      play: this.play,
      settingsChanged: (patch) => {
        this.sound.applyVolumes();
        this.applyDisplaySettings();
        if (patch.language !== undefined) this.text = this.applyLanguage();
      },
      now: () => new Date(),
    });
    this.loop = new FixedStepLoop({
      timeScale: (dt) => this.juice.simDelta(dt) * this.play.speed,
      step: (dt) => this.play.step(dt),
      frame: (realDt, simDt) => this.play.frame(realDt, simDt),
    });
    // Development builds expose the world-to-screen mapping for automated play-throughs.
    if (import.meta.env.DEV) Object.assign(window, { __fuse: { toClient: (x: number, y: number) => this.renderer.toClient({ x, y }) } });
  }

  start(): void {
    this.applyDisplaySettings();
    this.loop.start();
    this.screens.menu();
  }

  /** Layout and motion preferences live on the document root, where the styles read them. */
  private applyDisplaySettings(): void {
    const { leftHanded, reducedMotion, largeText } = this.progress.settings;
    const root = document.documentElement.classList;
    root.toggle('left-handed', leftHanded);
    root.toggle('reduced-motion', reducedMotion);
    root.toggle('large-text', largeText);
  }

  /** Picks the language from the saved choice (or the device) and returns the matching content text. */
  private applyLanguage(): ContentText {
    setLanguage(resolveLanguage(this.progress.settings.language, navigator.languages ?? [navigator.language]));
    return contentText(language);
  }

  private buzz(ms: number): void {
    if (this.progress.settings.haptics) this.vibrate(ms);
  }
}
