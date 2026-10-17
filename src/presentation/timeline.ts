import { T } from './strings';

export interface TimelineCharge {
  readonly id: number;
  /** 1-based number shown on the charge in the world. */
  readonly label: number;
  readonly delay: number;
}

/**
 * The blasting machine's delay timeline: one lane per charge, a marker you drag
 * to set when it fires. Markers are kept between updates (keyed by charge id)
 * so a drag survives re-renders.
 */
export class DelayTimeline {
  readonly element: HTMLElement;
  private readonly lanes: HTMLElement;
  private readonly markers = new Map<number, { lane: HTMLElement; marker: HTMLElement; value: HTMLElement }>();

  constructor(
    private readonly maxDelay: number,
    private readonly onChange: (id: number, seconds: number) => void,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'timeline hidden';
    const head = document.createElement('div');
    head.className = 'timeline-head';
    const title = document.createElement('span');
    title.className = 'label';
    title.textContent = T.delayTitle;
    const scale = document.createElement('div');
    scale.className = 'timeline-scale';
    for (let ms = 0; ms <= maxDelay * 1000; ms += 500) {
      const tick = document.createElement('span');
      tick.style.left = `${(ms / (maxDelay * 1000)) * 100}%`;
      tick.textContent = String(ms);
      scale.append(tick);
    }
    head.append(title);
    this.lanes = document.createElement('div');
    this.lanes.className = 'timeline-lanes';
    this.element.append(head, scale, this.lanes);
  }

  update(charges: readonly TimelineCharge[], visible: boolean): void {
    const hidden = !visible || charges.length === 0;
    // While a job runs the timeline stays hidden; there is nothing to lay out every frame.
    if (hidden && this.element.classList.contains('hidden')) return;
    this.element.classList.toggle('hidden', hidden);
    const keep = new Set(charges.map((c) => c.id));
    for (const [id, parts] of this.markers) {
      if (!keep.has(id)) {
        parts.lane.remove();
        this.markers.delete(id);
      }
    }
    charges.forEach((c, i) => {
      const parts = this.markers.get(c.id) ?? this.createLane(c.id);
      parts.marker.textContent = String(c.label);
      parts.marker.style.left = `${(c.delay / this.maxDelay) * 100}%`;
      parts.value.textContent = T.ms(c.delay);
      // Reorder only when needed: moving a lane in the DOM would cancel a drag in progress.
      const at = this.lanes.children[i];
      if (at !== parts.lane) this.lanes.insertBefore(parts.lane, at ?? null);
    });
  }

  private createLane(id: number): { lane: HTMLElement; marker: HTMLElement; value: HTMLElement } {
    const lane = document.createElement('div');
    lane.className = 'timeline-lane';
    const track = document.createElement('div');
    track.className = 'timeline-track';
    const marker = document.createElement('button');
    marker.className = 'timeline-marker';
    marker.setAttribute('aria-label', T.delayTitle);
    const value = document.createElement('span');
    value.className = 'timeline-value';
    track.append(marker);
    lane.append(track, value);

    const setFrom = (clientX: number) => {
      const rect = track.getBoundingClientRect();
      const t = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      this.onChange(id, t * this.maxDelay);
    };
    // Dragging the marker, or tapping anywhere on the track, sets the delay.
    track.addEventListener('pointerdown', (e) => {
      track.setPointerCapture(e.pointerId);
      setFrom(e.clientX);
    });
    track.addEventListener('pointermove', (e) => {
      if (track.hasPointerCapture(e.pointerId)) setFrom(e.clientX);
    });
    const parts = { lane, marker, value };
    this.markers.set(id, parts);
    return parts;
  }
}
