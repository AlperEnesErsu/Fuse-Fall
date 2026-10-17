import type { Vec2 } from '../core/math';
import { T } from './strings';

/** What moves a tutorial step forward. */
export type CoachTrigger = 'placed' | 'fired' | 'delay' | 'kind' | 'tap';

export interface CoachStep {
  readonly text: string;
  /** Point at a spot in the world, or at a UI element by CSS selector. */
  readonly highlight: { readonly world: Vec2; readonly radius: number } | { readonly selector: string } | undefined;
  readonly until: CoachTrigger;
  /** For `placed`: how many charges must be on the field. Defaults to 1. */
  readonly count?: number;
}

/**
 * Step-by-step coaching for missions that introduce a new idea. It shows one
 * instruction at a time, points at what matters, and advances only when the
 * player actually does it. It owns no game state; the app reports actions.
 */
export class Coach {
  private readonly card: HTMLElement;
  private readonly text: HTMLElement;
  private readonly counter: HTMLElement;
  private steps: readonly CoachStep[] = [];
  private index = -1;
  private highlighted: Element | undefined;

  constructor(root: HTMLElement) {
    this.card = document.createElement('div');
    this.card.className = 'coach hidden';
    this.card.setAttribute('role', 'status');
    this.counter = document.createElement('span');
    this.counter.className = 'coach-step';
    this.text = document.createElement('p');
    const skip = document.createElement('button');
    skip.className = 'coach-skip';
    skip.textContent = T.skip;
    skip.addEventListener('click', (e) => {
      e.stopPropagation();
      this.stop();
    });
    this.card.addEventListener('click', () => this.notify('tap'));
    this.card.append(this.counter, this.text, skip);
    root.append(this.card);
  }

  get active(): boolean {
    return this.index >= 0;
  }

  /** The world spot to mark on the canvas, if the current step points at one. */
  get worldMarker(): { readonly world: Vec2; readonly radius: number } | undefined {
    const h = this.steps[this.index]?.highlight;
    return h && 'world' in h ? h : undefined;
  }

  start(steps: readonly CoachStep[]): void {
    this.steps = steps;
    this.index = steps.length > 0 ? 0 : -1;
    this.render();
  }

  stop(): void {
    this.index = -1;
    this.render();
  }

  /** `count` is the number of charges on the field, for `placed` steps. */
  notify(trigger: CoachTrigger, count = 1): void {
    const step = this.steps[this.index];
    if (!step || step.until !== trigger) return;
    if (trigger === 'placed' && count < (step.count ?? 1)) return;
    this.index = this.index + 1 < this.steps.length ? this.index + 1 : -1;
    this.render();
  }

  /** UI elements appear and disappear (the timeline shows after the first charge), so re-apply the highlight. */
  refresh(): void {
    const h = this.steps[this.index]?.highlight;
    const target = h && 'selector' in h ? (document.querySelector(h.selector) ?? undefined) : undefined;
    if (target === this.highlighted) return;
    this.highlighted?.classList.remove('coach-target');
    target?.classList.add('coach-target');
    this.highlighted = target;
  }

  private render(): void {
    const step = this.steps[this.index];
    this.card.classList.toggle('hidden', !step);
    if (step) {
      this.counter.textContent = `${this.index + 1} / ${this.steps.length}`;
      this.text.textContent = step.text;
      this.card.classList.toggle('tap', step.until === 'tap');
    }
    this.refresh();
  }
}
