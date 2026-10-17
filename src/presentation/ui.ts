import { WORLD, type LevelDefinition } from '../core/level';
import type { Settings, WorldStatus } from '../core/progress';
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
}

export interface ReportInfo {
  readonly city: string;
  readonly order: number;
  readonly par: number;
  readonly bonusCollapse: number;
  readonly best: number;
  readonly newBest: boolean;
  readonly cityComplete: boolean;
}

export interface MenuState {
  readonly totalStars: number;
  readonly daily: { readonly name: string; readonly streak: number; readonly wonToday: boolean } | undefined;
  readonly achievements: { readonly unlocked: number; readonly total: number };
  readonly onPlay: () => void;
  readonly onDaily: () => void;
  readonly onFreeSite: () => void;
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
  readonly onMenu: () => void;
  readonly onDelay: (chargeId: number, seconds: number) => void;
  readonly onKind: (kind: ChargeKind) => void;
}

export interface ResultActions {
  readonly onRetry: () => void;
  readonly onReplay: () => void;
  readonly onNext: (() => void) | undefined;
  readonly nextLabel: string;
  readonly onLevels: () => void;
}

/** DOM overlay for menus, HUD and the demolition report. It renders what it is given and reports taps. */
export class Ui {
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
    root.append(this.hud, this.screen, this.toastEl, h('div', { class: 'rotate' }, ICONS.phone(56), T.rotate));
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
        this.button(T.play, m.onPlay, 'primary big'),
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
        h(
          'div',
          { class: 'menu-row' },
          this.button(`${T.achievementsTitle} ${T.achievementsCount(m.achievements.unlocked, m.achievements.total)}`, m.onAchievements),
          this.button(T.settings, m.onSettings),
        ),
        h('p', { class: 'meta' }, `${T.totalStars(m.totalStars)} · ${T.offline}`),
      ),
    );
  }

  achievements(list: readonly { title: string; description: string; unlocked: boolean }[], onBack: () => void): void {
    this.hideHud();
    this.show(
      h(
        'div',
        { class: 'panel achievements' },
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
    chosen: { world: number; template: string },
    onPick: (pick: { world: number; template: string }) => void,
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
        this.button(T.start, onStart, 'primary big'),
      ),
    );
  }

  /** End of a Free Site run: a short summary and quick ways to go again. */
  freeSiteDone(r: LevelResult, a: { onReset: () => void; onReplay: () => void; onSetup: () => void }): void {
    this.show(
      h(
        'div',
        { class: 'panel freesite-done' },
        h('h2', {}, T.freeSiteDone),
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
          this.button(T.structureLabel, a.onSetup),
        ),
      ),
    );
  }

  /** Replay mode: no HUD or menus, just a label and a way out. */
  showReplay(onSkip: () => void): void {
    this.hideHud();
    this.replayEl.replaceChildren(h('span', { class: 'label' }, T.replayLabel), this.button(T.skip, onSkip));
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
              starRow(c.stars, 'sm'),
              c.best ? h('span', { class: 'best' }, String(c.best)) : undefined,
            ),
          ),
        ),
      ),
    );
  }

  settings(s: Settings, onChange: (patch: Partial<Settings>) => void, onTestSound: () => void, onBack: () => void): void {
    const toggle = (label: string, value: boolean, key: 'screenShake' | 'flashes' | 'haptics') => {
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
        this.button(T.testSound, onTestSound),
        toggle(T.shake, s.screenShake, 'screenShake'),
        toggle(T.flashes, s.flashes, 'flashes'),
        toggle(T.haptics, s.haptics, 'haptics'),
        this.button(T.back, onBack),
      ),
    );
  }

  showHud(a: HudActions): void {
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
          this.iconButton(ICONS.retry(), a.onRetry, T.retry),
          this.iconButton(ICONS.menu(), a.onMenu, T.menu),
        ),
      ),
      timeline.element,
      kindSwitch,
      fire,
      detonate,
    );
    this.hudParts = { name, charges, targets, guarded, fire, detonate, timeline, kinds: kindSwitch };
    this.hud.classList.remove('hidden');
  }

  updateHud(s: HudState): void {
    if (!this.hudParts) return;
    this.hudParts.name.textContent = `${T.mission(s.levelOrder)} · ${s.levelName}`;
    this.hudParts.charges.replaceChildren(
      h('span', { class: 'label' }, T.charges),
      ...Array.from({ length: s.chargesMax }, (_, i) =>
        h('span', { class: `pip${i < s.chargesUsed ? ' used' : ''}${i < s.par ? ' par' : ''}` }),
      ),
    );
    this.hudParts.targets.replaceChildren(h('span', { class: 'label' }, T.targets), String(s.targetsLeft));
    this.hudParts.targets.classList.toggle('hidden', !s.showTargets);
    this.hudParts.guarded.replaceChildren(h('span', { class: 'label' }, T.protectedLabel), String(s.protectedTotal));
    this.hudParts.guarded.classList.toggle('hidden', s.protectedTotal === 0);
    this.hudParts.fire.disabled = !s.canFire;
  }

  /** The delay timeline shows while placing whenever there is a charge to time. */
  updateTimeline(charges: readonly TimelineCharge[], placing: boolean): void {
    this.hudParts?.timeline.update(charges, placing);
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
    const reason = r.failure ? R.reasons[r.failure] : info.cityComplete ? R.cityComplete(info.city) : '';
    this.show(
      h(
        'div',
        { class: `panel report ${r.success ? 'win' : 'lose'}` },
        h('header', {}, h('span', { class: 'title' }, R.title), h('span', { class: 'meta' }, R.heading(info.city, info.order))),
        h(
          'div',
          { class: 'report-body' },
          h(
            'div',
            { class: 'verdict' },
            h('div', { class: 'stamp' }, r.success ? R.success : R.failure),
            reason ? h('p', { class: 'reason' }, reason) : undefined,
            starRow(r.stars, 'lg'),
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
              criterion(r.success, R.goal),
              ...styleKeys.map((k) =>
                criterion(r.success && r.styles[k], h('strong', {}, R.styles[k].name), ` · ${R.styles[k].how}`),
              ),
            ),
            h('p', { class: 'styles-note' }, R.stylesNote),
          ),
        ),
        h(
          'div',
          { class: 'actions' },
          this.button(T.retry, actions.onRetry, r.success ? '' : 'primary'),
          this.button(T.replay, actions.onReplay),
          actions.onNext && this.button(actions.nextLabel, actions.onNext, 'primary'),
          this.button(T.levels, actions.onLevels),
        ),
      ),
    );
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
