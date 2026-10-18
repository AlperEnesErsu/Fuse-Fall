import { WORLD, type LevelDefinition } from '../core/level';
import { difficultyOf } from '../core/difficulty';
import type { ContractKind } from '../core/contracts';
import type { Payout, Rank } from '../core/economy';
import type { ScrapPack } from '../core/ports';
import { SANDBOX_VARIANTS, type SandboxVariant } from '../content/sandbox';
import type { CareerStats, Settings, WorldStatus } from '../core/progress';
import type { LevelResult, Stars } from '../core/scoring';
import type { WorldDefinition } from '../core/world';
import { ICONS } from './icons';
import { DelayTimeline, type TimelineCharge } from './timeline';
import { TUNING } from '../core/tuning';
import type { ChargeKind } from '../core/level';
import { paintScene, skyAt } from './scenery';
import { T } from './strings';

type Child = Node | string | false | undefined;

const h = (
  tag: string,
  props: Record<string, string | ((e: Event) => void)> = {},
  ...children: Child[]
): HTMLElement => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === 'function') el.addEventListener(k, v);
    else el.setAttribute(k, v);
  }
  for (const c of children) if (c) el.append(c);
  return el;
};

const starRow = (stars: Stars, size: 'sm' | 'lg'): HTMLElement =>
  h(
    'div',
    { class: `stars stars-${size}`, 'aria-label': `${stars} / 3` },
    ...[1, 2, 3].map((n) => h('span', { class: n <= stars ? 'star on' : 'star' }, '★')),
  );

/** A small painting of the city's skyline for its card. */
const cityThumbnail = (key: string, progress: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  const scale = 0.32;
  canvas.width = Math.round(WORLD.width * scale);
  canvas.height = Math.round((WORLD.groundY + 30) * scale);
  const c = canvas.getContext('2d');
  if (c) {
    c.setTransform(scale, 0, 0, scale, 0, 0);
    paintScene(c, key, skyAt(progress));
  }
  canvas.className = 'thumb';
  return canvas;
};

export interface CityCard {
  readonly world: WorldDefinition;
  readonly city: string;
  readonly country: string;
  readonly status: WorldStatus;
  readonly stars: number;
  readonly maxStars: number;
  readonly previousCity: string | undefined;
}

export interface LevelCard {
  readonly level: LevelDefinition;
  readonly name: string;
  readonly stars: Stars;
  readonly best: number | undefined;
  readonly unlocked: boolean;
}

export interface HudState {
  readonly levelOrder: number;
  readonly levelName: string;
  readonly chargesUsed: number;
  readonly chargesMax: number;
  readonly par: number;
  readonly targetsLeft: number;
  readonly showTargets: boolean;
  readonly protectedTotal: number;
  readonly canFire: boolean;
  /** A charge is on the field and can be taken back. */
  readonly canUndo: boolean;
  /** The hint button shows once the player has struggled with this job. */
  readonly hintAvailable: boolean;
}

export interface ReportInfo {
  readonly city: string;
  readonly order: number;
  readonly par: number;
  readonly bonusCollapse: number;
  readonly best: number;
  readonly newBest: boolean;
  readonly cityComplete: boolean;
  readonly payout: Payout;
  /** Career rank index reached with this job, if it was a promotion. */
  readonly promotedTo: number | undefined;
  /** Doubles the scrap with a rewarded ad, when one can be shown. */
  readonly onDouble: (() => void) | undefined;
}

/** What the offer store has: rewarded ads (with today's count) and packs; `demo` marks the development stand-in. */
export interface WorkshopOffers {
  readonly ad: { readonly reward: number; readonly watched: number; readonly cap: number } | undefined;
  readonly packs: readonly ScrapPack[];
  readonly demo: boolean;
}

/** A weekly contract as shown: what to do, how far along, and what it pays. */
export interface ContractView {
  readonly kind: ContractKind;
  readonly goal: number;
  readonly reward: number;
  readonly count: number;
}

export interface WorkshopView {
  readonly scrap: number;
  readonly contracts: readonly ContractView[];
  readonly rank: Rank;
  readonly items: readonly {
    readonly id: string;
    readonly kind: 'blast-style' | 'block-theme' | 'structure';
    readonly name: string;
    readonly description: string;
    readonly cost: number;
    readonly owned: boolean;
    readonly active: boolean;
  }[];
}

export interface MenuState {
  readonly totalStars: number;
  /** The next mission to play, for the Continue button. */
  readonly next: { readonly label: string } | undefined;
  readonly onContinue: () => void;
  readonly daily: { readonly name: string; readonly streak: number; readonly wonToday: boolean } | undefined;
  readonly achievements: { readonly unlocked: number; readonly total: number };
  readonly onPlay: () => void;
  readonly onDaily: () => void;
  readonly onFreeSite: () => void;
  readonly onWorkshop: () => void;
  readonly scrap: number;
  readonly rank: Rank;
  readonly contracts: { readonly done: number; readonly total: number };
  readonly onAchievements: () => void;
  readonly onSettings: () => void;
}

export interface HudActions {
  readonly kinds: readonly ChargeKind[];
  /** Bombs hang in the sky, so the timeline docks under the buttons instead of covering them. */
  readonly skyInUse: boolean;
  readonly onFire: () => void;
  readonly onDetonate: () => void;
  readonly onRetry: () => void;
  readonly onUndo: () => void;
  readonly onHint: () => void;
  readonly onMenu: () => void;
  readonly onDelay: (chargeId: number, seconds: number) => void;
  readonly onKind: (kind: ChargeKind) => void;
  /** Shows this job's feature cards again; no "?" button without it. */
  readonly onHelp?: (() => void) | undefined;
}

export interface ResultActions {
  readonly onRetry: () => void;
  readonly onReplay: () => void;
  readonly onShare: () => void;
  readonly onNext: (() => void) | undefined;
  readonly nextLabel: string;
  readonly onLevels: () => void;
}

/** DOM overlay for menus, HUD and the demolition report. It renders what it is given and reports taps. */
export class Ui {
  /** The HUD state last drawn, so unchanged frames skip the DOM. */
  private lastHud: HudState | undefined;
  private readonly hud: HTMLElement;
  private readonly screen: HTMLElement;
  private readonly toastEl: HTMLElement;
  private hudParts:
    | {
        name: HTMLElement;
        charges: HTMLElement;
        targets: HTMLElement;
        guarded: HTMLElement;
        fire: HTMLButtonElement;
        detonate: HTMLButtonElement;
        undo: HTMLElement;
        hint: HTMLElement;
        timeline: DelayTimeline;
        kinds: HTMLElement;
      }
    | undefined;
  private toastTimer = 0;
  private readonly replayEl: HTMLElement;

  constructor(
    root: HTMLElement,
    private readonly onAnyTap: () => void,
  ) {
    this.hud = h('div', { class: 'hud hidden' });
    this.screen = h('div', { class: 'screen hidden' });
    this.toastEl = h('div', { class: 'toast', role: 'status' });
    this.replayEl = h('div', { class: 'replay hidden' });
    root.append(this.replayEl);
    root.append(this.hud, this.screen, this.toastEl);
  }

  menu(m: MenuState): void {
    this.hideHud();
    this.show(
      h(
        'div',
        { class: 'panel menu' },
        h('h1', { class: 'logo' }, 'FUSE ', h('span', {}, '&'), ' FALL'),
        h('div', { class: 'hazard' }),
        h('p', { class: 'subtitle' }, T.subtitle),
        h('p', { class: 'tagline' }, T.tagline),
        m.next
          ? h(
              'div',
              { class: 'menu-main' },
              h(
                'button',
                { class: 'btn primary big continue', click: () => this.tap(m.onContinue) },
                h('span', {}, T.continue),
                h('small', {}, m.next.label),
              ),
              this.button(T.play, m.onPlay, 'big'),
            )
          : this.button(T.play, m.onPlay, 'primary big'),
        h(
          'div',
          { class: 'menu-modes' },
          m.daily &&
            h(
              'button',
              { class: `btn daily${m.daily.wonToday ? ' done' : ''}`, click: () => this.tap(m.onDaily) },
              h('span', {}, T.daily),
              h('small', {}, T.dailyInfo(m.daily.name, m.daily.streak, m.daily.wonToday)),
            ),
          h(
            'button',
            { class: 'btn freesite', click: () => this.tap(m.onFreeSite) },
            h('span', {}, T.freeSite),
            h('small', {}, T.freeSiteTagline),
          ),
        ),
        h(
          'div',
          { class: 'menu-row' },
          this.button(T.workshop.title, m.onWorkshop),
          this.button(`${T.achievementsTitle} ${T.achievementsCount(m.achievements.unlocked, m.achievements.total)}`, m.onAchievements),
          this.button(T.settings, m.onSettings),
        ),
        h(
          'p',
          { class: 'meta' },
          h('strong', { class: 'rank-inline' }, T.ranks[m.rank.index] ?? ''),
          ` · ${T.scrap(m.scrap)} · ${T.totalStars(m.totalStars)} · ${T.contracts.footer(m.contracts.done, m.contracts.total)} · ${T.offline}`,
        ),
      ),
    );
  }

  /** Rank title and scrap balance, as a strip. */
  private career(rank: Rank, scrap: number): HTMLElement {
    return h(
      'div',
      { class: 'career' },
      h('span', { class: 'rank' }, T.ranks[rank.index] ?? ''),
      h('span', { class: 'scrap' }, h('span', { class: 'label' }, T.scrapLabel), String(scrap)),
    );
  }

  /** The workshop: blast styles and Free Site structures, bought with scrap. */
  workshop(
    v: WorkshopView,
    a: {
      onBuy: (id: string) => void;
      onEquip: (id: string) => void;
      onBack: () => void;
      onWatchAd: () => void;
      onBuyPack: (id: string) => void;
    },
    offers?: WorkshopOffers,
  ): void {
    this.hideHud();
    const W = T.workshop;
    const card = (item: WorkshopView['items'][number]) => {
      const action = !item.owned
        ? h(
            'button',
            { class: `btn small${v.scrap >= item.cost ? ' primary' : ' short'}`, click: () => this.tap(() => a.onBuy(item.id)) },
            W.buy(item.cost),
          )
        : item.kind !== 'structure'
          ? item.active
            ? h('span', { class: 'tag active' }, W.inUse)
            : h('button', { class: 'btn small', click: () => this.tap(() => a.onEquip(item.id)) }, W.use)
          : h('span', { class: 'tag' }, W.owned);
      return h(
        'li',
        { class: `shop-item${item.owned ? ' owned' : ''}${item.active ? ' active' : ''}` },
        item.kind !== 'structure' ? h('span', { class: `swatch style-${item.id.replace(':', '-')}` }) : undefined,
        h('div', { class: 'shop-text' }, h('strong', {}, item.name), h('small', {}, item.description)),
        action,
      );
    };
    const section = (title: string, kind: WorkshopView['items'][number]['kind']) =>
      h(
        'section',
        {},
        h('span', { class: 'label section' }, title),
        h('ul', { class: 'shop-list' }, ...v.items.filter((i) => i.kind === kind).map(card)),
      );
    this.show(
      h(
        'div',
        { class: 'panel workshop' },
        h('div', { class: 'levels-head' }, this.iconButton(ICONS.back(), a.onBack, T.back), h('h2', {}, W.title)),
        this.career(v.rank, v.scrap),
        h('p', { class: 'meta' }, `${T.career(v.rank.next)} · ${W.tagline}`),
        this.contractsSection(v.contracts),
        offers && (offers.ad || offers.packs.length > 0) ? this.offersSection(offers, a) : undefined,
        section(W.styles, 'blast-style'),
        section(W.themes, 'block-theme'),
        section(W.structures, 'structure'),
      ),
    );
  }

  /** This week's contracts, each with a progress bar. */
  private contractsSection(list: readonly ContractView[]): HTMLElement | undefined {
    if (list.length === 0) return undefined;
    const C = T.contracts;
    return h(
      'section',
      { class: 'contracts' },
      h('span', { class: 'label section' }, C.title),
      h('p', { class: 'meta' }, C.renews),
      h(
        'ul',
        { class: 'shop-list' },
        ...list.map((c) => {
          const count = Math.min(c.count, c.goal);
          const done = count >= c.goal;
          return h(
            'li',
            { class: `shop-item contract${done ? ' owned' : ''}` },
            h(
              'div',
              { class: 'shop-text' },
              h('strong', {}, C.kinds[c.kind](c.goal)),
              h('small', {}, C.reward(c.reward, count, c.goal)),
              h('div', { class: 'progress' }, h('div', { class: 'bar', style: `width:${Math.round((count / c.goal) * 100)}%` })),
            ),
            done ? h('span', { class: 'tag active' }, C.done) : undefined,
          );
        }),
      ),
    );
  }

  /** Scrap for a rewarded ad (with today's count) and scrap packs at store prices. */
  private offersSection(o: WorkshopOffers, a: { onWatchAd: () => void; onBuyPack: (id: string) => void }): HTMLElement {
    const O = T.offers;
    const left = o.ad ? o.ad.cap - o.ad.watched : 0;
    return h(
      'section',
      { class: 'offers' },
      h('span', { class: 'label section' }, O.title),
      o.demo ? h('p', { class: 'meta' }, O.demo) : undefined,
      h(
        'ul',
        { class: 'shop-list' },
        o.ad
          ? h(
              'li',
              { class: 'shop-item' },
              h('div', { class: 'shop-text' }, h('strong', {}, O.watch(o.ad.reward)), h('small', {}, O.left(left, o.ad.cap))),
              h('button', { class: `btn small${left > 0 ? ' primary' : ' short'}`, click: () => this.tap(a.onWatchAd) }, O.watchButton),
            )
          : undefined,
        ...o.packs.map((p) =>
          h(
            'li',
            { class: 'shop-item' },
            h('div', { class: 'shop-text' }, h('strong', {}, O.pack(p.scrap)), h('small', {}, O.packNote)),
            h('button', { class: 'btn small', click: () => this.tap(() => a.onBuyPack(p.id)) }, p.price),
          ),
        ),
      ),
    );
  }

  /** Whether a given screen is up (async work checks this before redrawing it). */
  isShowing(screen: 'workshop'): boolean {
    return this.screen.querySelector(`.panel.${screen}`) !== null;
  }

  achievements(
    list: readonly { title: string; description: string; unlocked: boolean }[],
    onBack: () => void,
    career?: CareerStats & { readonly scrap: number },
  ): void {
    this.hideHud();
    const C = T.careerStats;
    const stat = (label: string, value: string) => h('div', { class: 'career-stat' }, h('strong', {}, value), h('span', {}, label));
    this.show(
      h(
        'div',
        { class: 'panel achievements' },
        career
          ? h(
              'div',
              { class: 'career-stats' },
              stat(C.jobs, `${career.cleared} / ${career.jobs}`),
              stat(C.blasts, String(career.blasts)),
              // 30 world px make a metre: a column of 110 px is about a storey.
              stat(C.area, C.squareMetres(Math.round(career.area / 900))),
              stat(C.barrels, String(career.barrels)),
              stat(C.cars, String(career.cars)),
              stat(C.scrap, String(career.scrap)),
            )
          : undefined,
        h('h2', {}, T.achievementsTitle),
        h(
          'ul',
          { class: 'achievement-list' },
          ...list.map((a) =>
            h(
              'li',
              { class: a.unlocked ? 'unlocked' : '' },
              a.unlocked ? ICONS.check(16) : ICONS.lock(16),
              h('div', {}, h('strong', {}, a.title), h('span', {}, a.description)),
            ),
          ),
        ),
        this.button(T.back, onBack),
      ),
    );
  }

  /** Free Site setup: choose a city and a structure, then start. */
  freeSite(
    cities: readonly { world: number; name: string }[],
    templates: readonly { id: string; name: string }[],
    moreInWorkshop: boolean,
    chosen: { world: number; template: string; variant: SandboxVariant; traffic: boolean },
    /** One Shot best for the chosen structure, if any. */
    oneShotBest: number | undefined,
    onPick: (pick: { world: number; template: string; variant: SandboxVariant; traffic: boolean }) => void,
    onStart: () => void,
    onBack: () => void,
  ): void {
    this.hideHud();
    const chip = (label: string, active: boolean, pick: () => void) =>
      h('button', { class: `chip${active ? ' active' : ''}`, click: () => this.tap(pick) }, label);
    this.show(
      h(
        'div',
        { class: 'panel freesite-setup' },
        h('div', { class: 'levels-head' }, this.iconButton(ICONS.back(), onBack, T.back), h('h2', {}, T.freeSite)),
        h('p', { class: 'meta' }, T.freeSiteTagline),
        h('span', { class: 'label section' }, T.cityLabel),
        h('div', { class: 'chips' }, ...cities.map((c) => chip(c.name, c.world === chosen.world, () => onPick({ ...chosen, world: c.world })))),
        h('span', { class: 'label section' }, T.structureLabel),
        h(
          'div',
          { class: 'chips' },
          ...templates.map((t) => chip(t.name, t.id === chosen.template, () => onPick({ ...chosen, template: t.id }))),
        ),
        moreInWorkshop ? h('p', { class: 'meta' }, T.freeSiteMore) : undefined,
        h('span', { class: 'label section' }, T.modeLabel),
        h(
          'div',
          { class: 'chips' },
          ...SANDBOX_VARIANTS.map((v) => chip(T.freeSiteModes[v].name, v === chosen.variant, () => onPick({ ...chosen, variant: v }))),
        ),
        h(
          'p',
          { class: 'meta' },
          T.freeSiteModes[chosen.variant].hint,
          chosen.variant === 'one-shot' && oneShotBest !== undefined ? ` ${T.oneShotBest(oneShotBest)}` : '',
        ),
        h(
          'div',
          { class: 'chips' },
          chip(`${T.traffic.label}: ${chosen.traffic ? T.traffic.on : T.traffic.off}`, chosen.traffic, () => onPick({ ...chosen, traffic: !chosen.traffic })),
        ),
        this.button(T.start, onStart, 'primary big'),
      ),
    );
  }

  /** End of a Free Site run: a short summary and quick ways to go again. */
  freeSiteDone(
    r: LevelResult,
    a: { onReset: () => void; onReplay: () => void; onShare: () => void; onSetup: () => void },
    record?: { readonly best: number; readonly isNew: boolean },
  ): void {
    this.show(
      h(
        'div',
        { class: 'panel freesite-done' },
        h('h2', {}, T.freeSiteDone),
        record
          ? h(
              'div',
              { class: 'payout' },
              h('span', { class: 'label' }, T.freeSiteModes['one-shot'].name.toUpperCase()),
              h('span', { class: 'value' }, `%${Math.round(r.collapseRatio * 100)}`),
              record.isNew ? h('span', { class: 'badge' }, T.report.newBest) : h('small', {}, T.oneShotBest(record.best)),
            )
          : undefined,
        h(
          'div',
          { class: 'stats' },
          h('span', {}, `${T.report.collapse} %${Math.round(r.collapseRatio * 100)}`),
          h('span', {}, `${T.report.charges} ${r.chargesUsed}`),
          h('span', {}, `${T.report.duration} ${T.report.seconds(r.duration)}`),
        ),
        h(
          'div',
          { class: 'actions' },
          this.button(T.reset, a.onReset, 'primary'),
          this.button(T.replay, a.onReplay),
          this.iconButton(ICONS.share(), a.onShare, T.clip.share),
          this.button(T.structureLabel, a.onSetup),
        ),
      ),
    );
  }

  /** Replay mode: no HUD or menus, just a label and a way out. */
  /** Replay controls: skip, and the playback speed when the player may choose it. */
  showReplay(
    onSkip: () => void,
    speed?: { readonly options: readonly number[]; readonly current: number; readonly onPick: (value: number) => void },
  ): void {
    this.hideHud();
    const buttons: HTMLElement[] = [];
    for (const value of speed?.options ?? []) {
      const b: HTMLElement = h(
        'button',
        {
          class: `btn small${value === speed?.current ? ' primary' : ''}`,
          click: () =>
            this.tap(() => {
              speed?.onPick(value);
              buttons.forEach((x) => x.classList.toggle('primary', x === b));
            }),
        },
        `×${value}`,
      );
      buttons.push(b);
    }
    this.replayEl.replaceChildren(h('span', { class: 'label' }, T.replayLabel), ...buttons, this.button(T.skip, onSkip));
    this.replayEl.classList.remove('hidden');
  }

  hideReplay(): void {
    this.replayEl.classList.add('hidden');
  }

  /** Horizontally swipeable operation sites, one per city. */
  cityMap(cards: readonly CityCard[], focus: number, onPick: (world: number) => void, onBack: () => void): void {
    this.hideHud();
    const strip = h(
      'div',
      { class: 'city-strip' },
      ...cards.map((card) => {
        const open = card.status.kind === 'open';
        const lockText =
          card.status.kind === 'coming-soon'
            ? T.comingSoon
            : card.status.kind === 'locked'
              ? card.status.needsPrevious && card.previousCity
                ? T.needsPrevious(card.previousCity)
                : T.needsStars(card.status.needsStars)
              : undefined;
        const pct = card.maxStars > 0 ? Math.round((card.stars / card.maxStars) * 100) : 0;
        return h(
          'button',
          {
            class: `city-card${open ? '' : ' locked'}`,
            ...(open ? {} : { 'aria-disabled': 'true' }),
            click: () => (open ? this.tap(() => onPick(card.world.world)) : this.toast(lockText ?? '')),
          },
          cityThumbnail(card.world.key, 0.55),
          h('span', { class: 'city-part' }, T.site(card.world.world)),
          h('span', { class: 'city-name' }, card.city),
          h('span', { class: 'city-country' }, card.country),
          card.status.kind !== 'coming-soon'
            ? h('div', { class: 'progress' }, h('div', { class: 'bar', style: `width:${pct}%` }))
            : undefined,
          lockText
            ? h('span', { class: 'city-stars lock' }, ICONS.lock(14), lockText)
            : h('span', { class: 'city-stars' }, `★ ${card.stars} / ${card.maxStars}`),
        );
      }),
    );
    this.show(
      h(
        'div',
        { class: 'map' },
        h('div', { class: 'map-head' }, this.iconButton(ICONS.back(), onBack, T.back), h('h2', {}, T.cities)),
        strip,
      ),
      'full',
    );
    const target = strip.children[focus] as HTMLElement | undefined;
    requestAnimationFrame(() => target?.scrollIntoView({ inline: 'center', block: 'nearest' }));
  }

  levelSelect(
    world: WorldDefinition,
    cityName: string,
    stars: number,
    maxStars: number,
    cards: readonly LevelCard[],
    onPick: (id: string) => void,
    onBack: () => void,
  ): void {
    this.hideHud();
    this.show(
      h(
        'div',
        { class: 'panel levels' },
        h(
          'div',
          { class: 'levels-head' },
          this.iconButton(ICONS.back(), onBack, T.cities),
          h('div', {}, h('span', { class: 'city-part' }, T.site(world.world)), h('h2', {}, `${cityName} · ${T.levels}`)),
          h('span', { class: 'meta push' }, `★ ${stars} / ${maxStars}`),
        ),
        h(
          'div',
          { class: 'level-grid' },
          ...cards.map((c) =>
            h(
              'button',
              {
                class: `level-card${c.unlocked ? '' : ' locked'}${c.stars === 3 ? ' perfect' : ''}`,
                ...(c.unlocked ? {} : { disabled: 'true' }),
                click: () => this.tap(() => onPick(c.level.id)),
              },
              h('span', { class: 'num' }, c.unlocked ? T.mission(c.level.order) : ICONS.lock(18)),
              h('span', { class: 'name' }, c.name),
              c.unlocked ? h('span', { class: `difficulty ${difficultyOf(c.level)}` }, T.difficulty[difficultyOf(c.level)]) : undefined,
              starRow(c.stars, 'sm'),
              c.best ? h('span', { class: 'best' }, String(c.best)) : undefined,
            ),
          ),
        ),
      ),
    );
  }

  settings(
    s: Settings,
    onChange: (patch: Partial<Settings>) => void,
    onTestSound: () => void,
    onBack: () => void,
    onPrivacyChoices?: () => void,
  ): void {
    const toggle = (label: string, value: boolean, key: 'screenShake' | 'flashes' | 'haptics' | 'leftHanded' | 'reducedMotion' | 'largeText') => {
      const input = h('input', {
        type: 'checkbox',
        change: (e) => onChange({ [key]: (e.target as HTMLInputElement).checked }),
      }) as HTMLInputElement;
      input.checked = value;
      return h('label', { class: 'row' }, label, input);
    };
    this.hideHud();
    this.show(
      h(
        'div',
        { class: 'panel settings' },
        h('h2', {}, T.settings),
        h(
          'label',
          { class: 'row' },
          T.languageLabel,
          this.select(
            [
              ['auto', T.languageAuto],
              ['tr', 'Türkçe'],
              ['en', 'English'],
            ],
            s.language,
            (value) => onChange({ language: value as Settings['language'] }),
          ),
        ),
        h(
          'label',
          { class: 'row' },
          T.sfx,
          h('input', {
            type: 'range',
            min: '0',
            max: '1',
            step: '0.05',
            value: String(s.sfxVolume),
            input: (e) => onChange({ sfxVolume: Number((e.target as HTMLInputElement).value) }),
          }),
        ),
        h(
          'label',
          { class: 'row' },
          T.music,
          h('input', {
            type: 'range',
            min: '0',
            max: '1',
            step: '0.05',
            value: String(s.musicVolume),
            input: (e) => onChange({ musicVolume: Number((e.target as HTMLInputElement).value) }),
          }),
        ),
        this.button(T.testSound, onTestSound),
        toggle(T.shake, s.screenShake, 'screenShake'),
        toggle(T.flashes, s.flashes, 'flashes'),
        toggle(T.haptics, s.haptics, 'haptics'),
        h('span', { class: 'label section' }, T.access.title),
        toggle(T.access.leftHanded, s.leftHanded, 'leftHanded'),
        toggle(T.access.reducedMotion, s.reducedMotion, 'reducedMotion'),
        toggle(T.access.largeText, s.largeText, 'largeText'),
        onPrivacyChoices ? this.button(T.offers.privacyChoices, onPrivacyChoices) : undefined,
        this.button(T.back, onBack),
      ),
    );
  }

  showHud(a: HudActions): void {
    this.lastHud = undefined;
    this.hideScreen();
    const name = h('div', { class: 'hud-name' });
    const charges = h('div', { class: 'stat' });
    const targets = h('div', { class: 'stat' });
    const guarded = h('div', { class: 'stat guarded' });
    const fire = h(
      'button',
      { class: 'fire-btn', 'aria-label': T.fire, click: () => this.tap(a.onFire) },
      ICONS.detonator(30),
      h('span', {}, T.fire),
    ) as HTMLButtonElement;
    const detonate = h(
      'button',
      { class: 'fire-btn detonate-btn hidden', 'aria-label': T.detonate, click: () => this.tap(a.onDetonate) },
      ICONS.detonator(30),
      h('span', {}, T.detonate),
    ) as HTMLButtonElement;
    const undo = this.iconButton(ICONS.undo(), a.onUndo, T.undo);
    const hint = this.iconButton(ICONS.hint(), a.onHint, T.hint.button);
    hint.classList.add('hint-btn');
    const timeline = new DelayTimeline(TUNING.charge.delay.max, a.onDelay);
    timeline.element.classList.toggle('docked', a.skyInUse);
    // Charge type switch, only where the job offers more than one type.
    const kindSwitch = h(
      'div',
      { class: `kind-toggle${a.kinds.length > 1 ? '' : ' hidden'}`, role: 'radiogroup', 'aria-label': T.chargeKindLabel },
      ...a.kinds.map((k) =>
        h('button', { 'data-kind': k, role: 'radio', click: () => this.tap(() => a.onKind(k)) }, T.chargeKinds[k]),
      ),
    );
    this.hud.replaceChildren(
      h(
        'div',
        { class: 'hud-top' },
        h('div', { class: 'hud-info' }, name, h('div', { class: 'hud-stats' }, charges, targets, guarded)),
        h(
          'div',
          { class: 'hud-actions' },
          a.onHelp ? this.helpButton(a.onHelp) : undefined,
          hint,
          undo,
          this.iconButton(ICONS.retry(), a.onRetry, T.retry),
          this.iconButton(ICONS.menu(), a.onMenu, T.menu),
        ),
      ),
      timeline.element,
      kindSwitch,
      fire,
      detonate,
    );
    this.hudParts = { name, charges, targets, guarded, fire, detonate, undo, hint, timeline, kinds: kindSwitch };
    this.hud.classList.remove('hidden');
  }

  /** Called every frame while a job runs: the DOM is touched only when something shown has changed. */
  updateHud(s: HudState): void {
    if (!this.hudParts) return;
    const last = this.lastHud;
    if (last && (Object.keys(s) as (keyof HudState)[]).every((k) => s[k] === last[k])) return;
    this.lastHud = s;
    this.hudParts.name.textContent = `${T.mission(s.levelOrder)} · ${s.levelName}`;
    this.hudParts.charges.replaceChildren(
      h('span', { class: 'label' }, T.charges),
      ...Array.from({ length: s.chargesMax }, (_, i) =>
        h('span', { class: `pip${i < s.chargesUsed ? ' used' : ''}${i < s.par ? ' par' : ''}` }),
      ),
    );
    this.hudParts.charges.classList.toggle('hidden', s.chargesMax === 0);
    this.hudParts.targets.replaceChildren(h('span', { class: 'label' }, T.targets), String(s.targetsLeft));
    this.hudParts.targets.classList.toggle('hidden', !s.showTargets);
    this.hudParts.guarded.replaceChildren(h('span', { class: 'label' }, T.protectedLabel), String(s.protectedTotal));
    this.hudParts.guarded.classList.toggle('hidden', s.protectedTotal === 0);
    this.hudParts.fire.disabled = !s.canFire;
    this.hudParts.undo.classList.toggle('hidden', !s.canUndo);
    this.hudParts.hint.classList.toggle('hidden', !s.hintAvailable);
  }

  /** The delay timeline shows while placing whenever there is a charge to time. */
  updateTimeline(charges: readonly TimelineCharge[], placing: boolean): void {
    this.hudParts?.timeline.update(charges, placing);
  }

  /** A loadout: each kind's button shows how many are left, and an empty one dims. */
  setKindCounts(counts: Readonly<Partial<Record<ChargeKind, number>>> | undefined): void {
    for (const b of this.hudParts?.kinds.querySelectorAll('button') ?? []) {
      const kind = b.getAttribute('data-kind') as ChargeKind | null;
      if (!kind) continue;
      const n = counts?.[kind];
      b.textContent = n === undefined ? T.chargeKinds[kind] : `${T.chargeKinds[kind]} ×${n}`;
      b.classList.toggle('empty', n === 0);
    }
  }

  /** The "?" button: a round button with a question mark, no icon file needed. */
  private helpButton(onHelp: () => void): HTMLElement {
    return h('button', { class: 'btn icon help-btn', title: T.features.help, 'aria-label': T.features.help, click: () => this.tap(onHelp) }, '?');
  }

  setChargeKind(kind: ChargeKind): void {
    for (const b of this.hudParts?.kinds.querySelectorAll('button') ?? []) {
      b.setAttribute('aria-checked', String(b.getAttribute('data-kind') === kind));
    }
  }

  /** The detonator replaces the fire button while free-fall bombs are live. */
  setDetonateVisible(visible: boolean): void {
    this.hudParts?.detonate.classList.toggle('hidden', !visible);
  }

  setFireVisible(visible: boolean): void {
    this.hudParts?.kinds.classList.toggle('gone', !visible);
    this.hudParts?.fire.classList.toggle('hidden', !visible);
  }

  /** The demolition report: verdict, measured results, score and the play styles behind the stars. */
  report(r: LevelResult, info: ReportInfo, actions: ResultActions): void {
    const R = T.report;
    const row = (label: string, value: string, note?: string, tone = '') =>
      h(
        'div',
        { class: `row ${tone}`.trim() },
        h('span', {}, label),
        h('strong', {}, value, note ? h('small', {}, ` ${note}`) : undefined),
      );
    const styleKeys = ['surgical', 'demolition', 'domino'] as const;
    const criterion = (met: boolean, ...label: (string | HTMLElement)[]) =>
      h('li', { class: met ? 'met' : '' }, met ? ICONS.check(14) : ICONS.cross(14), h('span', {}, ...label));
    const protectedValue =
      r.protectedTotal === 0 ? R.none : r.protectedDamaged === 0 ? R.intact : R.damaged(r.protectedDamaged);
    const perfect = r.cleared && r.stars === 3;
    const tier = perfect ? 'perfect' : r.cleared ? 'win' : r.partial ? 'partial' : 'lose';
    const reason = r.partial
      ? R.partialReason
      : r.failure
        ? R.reasons[r.failure]
        : info.cityComplete
          ? R.cityComplete(info.city)
          : '';
    this.show(
      h(
        'div',
        { class: `panel report ${tier}` },
        h('header', {}, h('span', { class: 'title' }, R.title), h('span', { class: 'meta' }, R.heading(info.city, info.order))),
        h(
          'div',
          { class: 'report-body' },
          h(
            'div',
            { class: 'verdict' },
            h('div', { class: 'stamp' }, perfect ? R.perfect : r.cleared ? R.success : r.partial ? R.partialWin : R.failure),
            reason ? h('p', { class: 'reason' }, reason) : undefined,
            starRow(r.stars, 'lg'),
            h(
              'div',
              { class: 'payout' },
              h('span', { class: 'label' }, T.scrapLabel),
              h('span', { class: 'value' }, `+${info.payout.total}`),
              h('small', {}, R.scrapParts(info.payout.salvage, info.payout.styles, info.payout.firstClear)),
              info.onDouble ? h('button', { class: 'btn small primary', click: () => this.tap(info.onDouble ?? (() => undefined)) }, T.offers.double) : undefined,
            ),
            info.promotedTo !== undefined ? h('span', { class: 'badge promoted' }, R.promoted(T.ranks[info.promotedTo] ?? '')) : undefined,
            h(
              'div',
              { class: 'score' },
              h('span', { class: 'label' }, R.score),
              h('span', { class: 'value' }, String(r.score)),
              info.newBest && r.score > 0
                ? h('span', { class: 'badge' }, R.newBest)
                : h('span', { class: 'meta' }, T.best(info.best)),
            ),
          ),
          h(
            'div',
            { class: 'facts' },
            row(R.targets, `${r.targetsDown} / ${r.targetsTotal}`, undefined, r.targetsDown < r.targetsTotal ? 'bad' : ''),
            row(R.charges, `${r.chargesUsed} / ${r.chargesMax}`, R.par(info.par)),
            row(R.collapse, `%${Math.round(r.collapseRatio * 100)}`, `/ %${Math.round(info.bonusCollapse * 100)}`),
            row(R.protectedRow, protectedValue, undefined, r.protectedDamaged > 0 ? 'bad' : ''),
            r.footprint &&
              row(
                R.footprintRow,
                `%${Math.round(r.footprint.achieved * 100)}`,
                `/ %${Math.round(r.footprint.required * 100)}`,
                r.footprint.achieved < r.footprint.required ? 'bad' : '',
              ),
            row(R.duration, R.seconds(r.duration)),
            h(
              'ul',
              { class: 'criteria' },
              criterion(r.cleared, R.goal),
              ...styleKeys.map((k) =>
                criterion(r.cleared && r.styles[k], h('strong', {}, R.styles[k].name), ` · ${R.styles[k].how}`),
              ),
            ),
            h('p', { class: 'styles-note' }, R.stylesNote),
          ),
        ),
        h(
          'div',
          { class: 'actions' },
          this.button(T.retry, actions.onRetry, r.cleared ? '' : 'primary'),
          this.button(T.replay, actions.onReplay),
          this.iconButton(ICONS.share(), actions.onShare, T.clip.share),
          actions.onNext && this.button(actions.nextLabel, actions.onNext, 'primary'),
          this.button(T.levels, actions.onLevels),
        ),
      ),
    );
    if (perfect) this.confetti();
  }

  /** A burst of confetti over the screen for a perfect job (skipped with reduced motion, in CSS). */
  private confetti(): void {
    const colours = ['#f2b134', '#e5484d', '#3fb6a8', '#7c6cf0', '#4cb36a', '#ebe8e2'];
    const layer = h('div', { class: 'confetti' });
    for (let i = 0; i < 48; i++) {
      const piece = h('span', {});
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colours[i % colours.length] ?? '#ffffff';
      piece.style.animationDelay = `${Math.random() * 400}ms`;
      piece.style.animationDuration = `${1600 + Math.random() * 1200}ms`;
      piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 160}px`);
      piece.style.setProperty('--spin', `${(Math.random() - 0.5) * 1440}deg`);
      layer.append(piece);
    }
    this.screen.append(layer);
    window.setTimeout(() => layer.remove(), 3400);
  }

  /**
   * Intro cards for what a job brings in, one after another over the site:
   * a tag, a title, what it is and the trick that makes it work.
   */
  featureCards(cards: readonly { readonly title: string; readonly text: string; readonly tip: string }[], fresh: boolean, onDone: () => void): void {
    const F = T.features;
    let index = 0;
    const render = () => {
      const card = cards[index];
      if (!card) {
        this.hideScreen();
        onDone();
        return;
      }
      const last = index === cards.length - 1;
      this.show(
        h(
          'div',
          { class: 'panel feature-card', role: 'dialog', 'aria-label': card.title },
          h('span', { class: 'tag new' }, fresh ? F.new : F.reminder),
          h('h2', {}, card.title),
          h('p', {}, card.text),
          h('p', { class: 'tip' }, h('strong', {}, F.trick), ' ', card.tip),
          h(
            'div',
            { class: 'row-buttons' },
            cards.length > 1 ? h('span', { class: 'meta' }, `${index + 1} / ${cards.length}`) : undefined,
            this.button(last ? F.gotIt : F.next, () => {
              index++;
              render();
            }, 'primary'),
          ),
        ),
        'feature',
      );
      this.screen.querySelector<HTMLButtonElement>('.feature-card .btn.primary')?.focus();
    };
    render();
  }

  toast(text: string, ms = 1400): void {
    if (!text) return;
    this.toastEl.textContent = text;
    this.toastEl.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('visible'), ms);
  }

  hideScreen(): void {
    this.screen.classList.add('hidden');
    this.screen.replaceChildren();
  }

  private hideHud(): void {
    this.hud.classList.add('hidden');
    this.hudParts = undefined;
  }

  private show(content: HTMLElement, variant = ''): void {
    this.screen.className = `screen ${variant}`.trim();
    this.screen.replaceChildren(content);
  }

  private button(label: string, onClick: () => void, variant = ''): HTMLElement {
    return h('button', { class: `btn ${variant}`.trim(), click: () => this.tap(onClick) }, label);
  }

  private select(options: readonly (readonly [string, string])[], value: string, onChange: (value: string) => void): HTMLElement {
    const el = h(
      'select',
      { change: (e) => onChange((e.target as HTMLSelectElement).value) },
      ...options.map(([v, label]) => h('option', { value: v, ...(v === value ? { selected: 'true' } : {}) }, label)),
    );
    return el;
  }

  private iconButton(icon: SVGSVGElement, onClick: () => void, label: string): HTMLElement {
    return h('button', { class: 'btn icon', title: label, 'aria-label': label, click: () => this.tap(onClick) }, icon);
  }

  private tap(action: () => void): void {
    this.onAnyTap();
    action();
  }
}
