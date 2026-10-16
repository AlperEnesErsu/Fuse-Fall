import { WORLD, type LevelDefinition } from '../core/level';
import type { Settings, WorldStatus } from '../core/progress';
import type { LevelResult, Stars } from '../core/scoring';
import type { WorldDefinition } from '../core/world';
import { ICONS } from './icons';
import { DelayTimeline, type TimelineCharge } from './timeline';
import { TUNING } from '../core/tuning';
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
  readonly status: WorldStatus;
  readonly stars: number;
  readonly maxStars: number;
  readonly previousCity: string | undefined;
}

export interface LevelCard {
  readonly level: LevelDefinition;
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

export interface ResultActions {
  readonly onRetry: () => void;
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
        timeline: DelayTimeline;
      }
    | undefined;
  private toastTimer = 0;

  constructor(
    root: HTMLElement,
    private readonly onAnyTap: () => void,
  ) {
    this.hud = h('div', { class: 'hud hidden' });
    this.screen = h('div', { class: 'screen hidden' });
    this.toastEl = h('div', { class: 'toast', role: 'status' });
    root.append(this.hud, this.screen, this.toastEl, h('div', { class: 'rotate' }, ICONS.phone(56), T.rotate));
  }

  menu(totalStars: number, onPlay: () => void, onSettings: () => void): void {
    this.hideHud();
    this.show(
      h(
        'div',
        { class: 'panel menu' },
        h('h1', { class: 'logo' }, 'FUSE ', h('span', {}, '&'), ' FALL'),
        h('div', { class: 'hazard' }),
        h('p', { class: 'subtitle' }, T.subtitle),
        h('p', { class: 'tagline' }, T.tagline),
        this.button(T.play, onPlay, 'primary big'),
        this.button(T.settings, onSettings),
        h('p', { class: 'meta' }, `${T.totalStars(totalStars)} · ${T.offline}`),
      ),
    );
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
          h('span', { class: 'city-name' }, card.world.city),
          h('span', { class: 'city-country' }, card.world.country),
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
          h('div', {}, h('span', { class: 'city-part' }, T.site(world.world)), h('h2', {}, `${world.city} · ${T.levels}`)),
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
              h('span', { class: 'name' }, c.level.name),
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

  showHud(
    onFire: () => void,
    onRetry: () => void,
    onMenu: () => void,
    onDelay: (chargeId: number, seconds: number) => void,
  ): void {
    this.hideScreen();
    const name = h('div', { class: 'hud-name' });
    const charges = h('div', { class: 'stat' });
    const targets = h('div', { class: 'stat' });
    const guarded = h('div', { class: 'stat guarded' });
    const fire = h(
      'button',
      { class: 'fire-btn', 'aria-label': T.fire, click: () => this.tap(onFire) },
      ICONS.detonator(30),
      h('span', {}, T.fire),
    ) as HTMLButtonElement;
    const timeline = new DelayTimeline(TUNING.charge.delay.max, onDelay);
    this.hud.replaceChildren(
      h(
        'div',
        { class: 'hud-top' },
        h('div', { class: 'hud-info' }, name, h('div', { class: 'hud-stats' }, charges, targets, guarded)),
        h(
          'div',
          { class: 'hud-actions' },
          this.iconButton(ICONS.retry(), onRetry, T.retry),
          this.iconButton(ICONS.menu(), onMenu, T.menu),
        ),
      ),
      timeline.element,
      fire,
    );
    this.hudParts = { name, charges, targets, guarded, fire, timeline };
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
    this.hudParts.guarded.replaceChildren(h('span', { class: 'label' }, T.protectedLabel), String(s.protectedTotal));
    this.hudParts.guarded.classList.toggle('hidden', s.protectedTotal === 0);
    this.hudParts.fire.disabled = !s.canFire;
  }

  /** The delay timeline shows while placing whenever there is a charge to time. */
  updateTimeline(charges: readonly TimelineCharge[], placing: boolean): void {
    this.hudParts?.timeline.update(charges, placing);
  }

  setFireVisible(visible: boolean): void {
    this.hudParts?.fire.classList.toggle('hidden', !visible);
  }

  /** The demolition report: verdict, measured results, score and the three criteria. */
  report(r: LevelResult, info: ReportInfo, actions: ResultActions): void {
    const R = T.report;
    const row = (label: string, value: string, note?: string, tone = '') =>
      h(
        'div',
        { class: `row ${tone}`.trim() },
        h('span', {}, label),
        h('strong', {}, value, note ? h('small', {}, ` ${note}`) : undefined),
      );
    const criteria = [r.success, r.success && r.underPar, r.success && r.bonusMet];
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
            row(R.duration, R.seconds(r.duration)),
            h(
              'ul',
              { class: 'criteria' },
              ...R.criteria.map((c, i) =>
                h('li', { class: criteria[i] ? 'met' : '' }, criteria[i] ? ICONS.check(14) : ICONS.cross(14), c),
              ),
            ),
          ),
        ),
        h(
          'div',
          { class: 'actions' },
          this.button(T.retry, actions.onRetry, r.success ? '' : 'primary'),
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

  private iconButton(icon: SVGSVGElement, onClick: () => void, label: string): HTMLElement {
    return h('button', { class: 'btn icon', title: label, 'aria-label': label, click: () => this.tap(onClick) }, icon);
  }

  private tap(action: () => void): void {
    this.onAnyTap();
    action();
  }
}
