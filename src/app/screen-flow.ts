import { decodeLevel, type ShareError } from '../core/share-code';
import { ACHIEVEMENTS } from '../core/achievements';
import { dailyChallenge, dayOf } from '../core/daily';
import { rankOf } from '../core/economy';
import type { LevelDefinition } from '../core/level';
import type { OfferStore } from '../core/ports';
import {
  buyItem,
  currentStreak,
  equip,
  levelsOf,
  totalStars,
  updateSettings,
  worldStars,
  type Campaign,
  type Settings,
} from '../core/progress';
import { SANDBOX_TEMPLATES, sandboxLevel, type SandboxVariant } from '../content/sandbox';
import type { ContentText } from '../content/text';
import { WORKSHOP, activeLook, isOwned, structureItemId, workshopItem } from '../content/workshop';
import type { SoundDirector } from '../presentation/audio';
import type { Renderer } from '../presentation/renderer';
import { T, language } from '../presentation/strings';
import type { Ui, WorkshopOffers } from '../presentation/ui';
import type { Mode } from './attempt';
import type { Ledger, OfferDesk } from './offer-desk';
import { contractViews, type Progression } from './progression';

/** What the screens ask of play: leave the current job, or start one. */
export interface Launcher {
  leave(): void;
  play(level: LevelDefinition, mode: Mode): void;
  startLevel(id: string): void;
}

/** The screens play returns to. */
export interface Navigator {
  menu(): void;
  levels(world?: number): void;
  cities(): void;
  freeSite(world?: number, template?: string, variant?: SandboxVariant, traffic?: boolean): void;
  /** Play remembers the job's city, so "back" returns to it. */
  enterWorld(world: number): void;
}

export interface ScreenDeps {
  readonly campaign: Campaign;
  readonly ledger: Ledger;
  readonly access: Progression;
  readonly text: () => ContentText;
  readonly ui: Pick<
    Ui,
    'menu' | 'achievements' | 'workshop' | 'isShowing' | 'freeSite' | 'cityMap' | 'levelSelect' | 'settings' | 'toast' | 'codeEntry'
  >;
  readonly renderer: Pick<Renderer, 'setScene'>;
  readonly sound: Pick<SoundDirector, 'denied' | 'test'>;
  readonly desk: Pick<OfferDesk, 'load' | 'watchAd' | 'buy'>;
  readonly offers: Pick<OfferStore, 'privacyChoicesRequired' | 'showPrivacyChoices'>;
  readonly play: Launcher;
  /** Applies saved settings to sound, display and language. */
  readonly settingsChanged: (patch: Partial<Settings>) => void;
  readonly now: () => Date;
}

/** Menu, city map, mission list, workshop, settings, achievements and Free Site setup. */
export class ScreenFlow implements Navigator {
  /** The city the player last browsed, so "back" returns to it. */
  private currentWorld = 1;

  constructor(private readonly d: ScreenDeps) {}

  enterWorld(world: number): void {
    this.currentWorld = world;
  }

  menu(): void {
    const { ui, ledger, access, campaign, play } = this.d;
    play.leave();
    const progress = ledger.get();
    const text = this.d.text();
    const today = dayOf(this.d.now());
    const daily = dailyChallenge(campaign, progress, today);
    const next = access.nextMission();
    const nextWorld = next && campaign.worlds.find((w) => w.world === next.world);
    const contracts = contractViews(progress, this.d.now());
    ui.menu({
      totalStars: totalStars(progress),
      next: next && nextWorld && { label: `${text.city(nextWorld)} ${String(next.order).padStart(2, '0')} · ${text.levelName(next)}` },
      onContinue: () => next && play.startLevel(next.id),
      daily: daily && {
        name: text.levelName(daily.base),
        streak: currentStreak(progress, today),
        wonToday: progress.daily.lastWon === today,
      },
      achievements: { unlocked: progress.achievements.length, total: ACHIEVEMENTS.length },
      onPlay: () => this.cities(),
      onDaily: () => this.startDaily(),
      onFreeSite: () => this.freeSite(),
      onWorkshop: () => this.workshop(),
      scrap: progress.wallet.balance,
      rank: rankOf(progress.wallet.earned),
      contracts: { done: contracts.filter((c) => c.count >= c.goal).length, total: contracts.length },
      onAchievements: () => this.achievements(),
      onSettings: () => this.settings(),
      onShareCode: () => this.shareCode(),
    });
  }

  /** Pasting a mission code: plays a shared mission, or asks again with the reason it did not load. */
  shareCode(error?: ShareError): void {
    this.d.play.leave();
    this.d.ui.codeEntry({ onPlay: (code) => void this.playCode(code), onBack: () => this.menu() }, error);
  }

  private async playCode(code: string): Promise<void> {
    const decoded = await decodeLevel(code);
    if (!decoded.ok) return this.shareCode(decoded.error);
    const level = decoded.value;
    if (!this.d.campaign.worlds.some((w) => w.world === level.world)) return this.shareCode('invalid-level');
    this.d.play.play(level, { kind: 'shared' });
  }

  achievements(): void {
    this.d.play.leave();
    const progress = this.d.ledger.get();
    this.d.ui.achievements(
      ACHIEVEMENTS.map((a) => ({ ...T.achievements[a.id], unlocked: progress.achievements.includes(a.id) })),
      () => this.menu(),
      { ...progress.career, scrap: progress.wallet.earned },
    );
  }

  /** The workshop: spend scrap on blast styles and Free Site structures, and pick the blast style. */
  workshop(offers?: WorkshopOffers): void {
    const { ui, ledger, desk } = this.d;
    this.d.play.leave();
    if (!offers) void desk.load().then((loaded) => ui.isShowing('workshop') && this.workshop(loaded));
    const progress = ledger.get();
    const { owned } = progress.workshop;
    const active = [
      activeLook(owned, progress.workshop.blastStyle, 'blast-style'),
      activeLook(owned, progress.workshop.blockTheme, 'block-theme'),
    ];
    ui.workshop(
      {
        scrap: progress.wallet.balance,
        rank: rankOf(progress.wallet.earned),
        contracts: contractViews(progress, this.d.now()),
        items: WORKSHOP.map((item) => ({
          id: item.id,
          kind: item.kind,
          name: item.name[language],
          description: item.description[language],
          cost: item.cost,
          owned: isOwned(owned, item),
          active: active.includes(item.id),
        })),
      },
      {
        onBuy: (id) => {
          const item = workshopItem(id);
          if (!item) return;
          const bought = buyItem(ledger.get(), item);
          if (!bought.ok) {
            this.d.sound.denied();
            ui.toast(T.workshop.errors[bought.error]);
            return;
          }
          // A new look goes straight into use.
          ledger.set(
            item.kind === 'structure' ? bought.value : equip(bought.value, item.kind === 'blast-style' ? 'blastStyle' : 'blockTheme', item.id),
          );
          this.workshop();
        },
        onEquip: (id) => {
          const item = workshopItem(id);
          if (!item || item.kind === 'structure') return;
          ledger.set(equip(ledger.get(), item.kind === 'blast-style' ? 'blastStyle' : 'blockTheme', id));
          this.workshop();
        },
        onBack: () => this.menu(),
        onWatchAd: () => void desk.watchAd().then((ok) => ok && this.workshop()),
        onBuyPack: (id) => void desk.buy(id).then(() => ui.isShowing('workshop') && this.workshop()),
      },
      offers,
    );
  }

  /** Free Site setup: pick an opened city, a structure and a way to play. */
  freeSite(world = this.currentWorld, template = SANDBOX_TEMPLATES[0]?.id ?? '', variant: SandboxVariant = 'free', traffic = false): void {
    const { campaign, access, ledger } = this.d;
    this.d.play.leave();
    const text = this.d.text();
    const cities = campaign.worlds
      .filter((w) => access.worldStatus(w.world).kind === 'open')
      .map((w) => ({ world: w.world, name: text.city(w) }));
    const chosen = cities.some((c) => c.world === world) ? world : (cities[0]?.world ?? 1);
    const progress = ledger.get();
    const templates = SANDBOX_TEMPLATES.filter((t) => {
      const item = workshopItem(structureItemId(t.id));
      return item === undefined || isOwned(progress.workshop.owned, item);
    });
    this.d.ui.freeSite(
      cities,
      templates.map((t) => ({ id: t.id, name: t.name[language] })),
      templates.length < SANDBOX_TEMPLATES.length,
      { world: chosen, template, variant, traffic },
      progress.oneShot[template],
      (pick) => this.freeSite(pick.world, pick.template, pick.variant, pick.traffic),
      () => {
        const t = SANDBOX_TEMPLATES.find((x) => x.id === template);
        if (t) this.d.play.play(sandboxLevel(t, chosen, variant, traffic), { kind: 'sandbox', template, variant, traffic });
      },
      () => this.menu(),
    );
  }

  cities(): void {
    const { campaign, access, ledger } = this.d;
    this.d.play.leave();
    const text = this.d.text();
    const progress = ledger.get();
    const worlds = campaign.worlds;
    this.d.ui.cityMap(
      worlds.map((world, i) => {
        const previous = worlds[i - 1];
        return {
          world,
          city: text.city(world),
          country: text.country(world),
          status: access.worldStatus(world.world),
          stars: worldStars(progress, campaign, world.world),
          maxStars: levelsOf(campaign, world.world).length * 3,
          previousCity: previous && text.city(previous),
        };
      }),
      Math.max(
        0,
        worlds.findIndex((w) => w.world === this.currentWorld),
      ),
      (world) => this.levels(world),
      () => this.menu(),
    );
  }

  levels(world = this.currentWorld): void {
    const { campaign, access, ledger } = this.d;
    this.d.play.leave();
    const def = campaign.worlds.find((w) => w.world === world);
    if (!def) return this.cities();
    this.currentWorld = world;
    this.d.renderer.setScene(def.key, 0.3);
    const text = this.d.text();
    const progress = ledger.get();
    const levels = levelsOf(campaign, world);
    this.d.ui.levelSelect(
      def,
      text.city(def),
      worldStars(progress, campaign, world),
      levels.length * 3,
      levels.map((level) => ({
        level,
        name: text.levelName(level),
        stars: progress.stars[level.id] ?? 0,
        best: progress.best[level.id],
        unlocked: access.levelUnlocked(level.id),
      })),
      (id) => this.d.play.startLevel(id),
      () => this.cities(),
    );
  }

  settings(): void {
    const { ledger, offers } = this.d;
    this.d.ui.settings(
      ledger.get().settings,
      (patch) => {
        ledger.set(updateSettings(ledger.get(), patch));
        this.d.settingsChanged(patch);
        if (patch.language !== undefined) this.settings();
      },
      () => this.d.sound.test(),
      () => this.menu(),
      offers.privacyChoicesRequired() ? () => void offers.showPrivacyChoices() : undefined,
    );
  }

  private startDaily(): void {
    const today = dayOf(this.d.now());
    const daily = dailyChallenge(this.d.campaign, this.d.ledger.get(), today);
    if (daily) this.d.play.play(daily.level, { kind: 'daily', day: today, baseId: daily.base.id });
  }
}
