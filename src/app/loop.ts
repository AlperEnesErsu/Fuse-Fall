export const FIXED_STEP = 1 / 60;
/** Longest frame we simulate; longer gaps (tab switch) are dropped, not fast-forwarded. */
const MAX_FRAME = 0.1;
const MAX_STEPS_PER_FRAME = 6;

/**
 * Fixed-timestep accumulator: physics always advances in 1/60 s steps, so the
 * same placement gives the same demolition (NFR-05), while rendering runs at
 * the display's own rate.
 */
export class FixedStepLoop {
  private accumulator = 0;
  private last = 0;
  private handle = 0;

  constructor(
    private readonly hooks: {
      /** Maps real time to simulation time (hit-stop, slow motion). */
      readonly timeScale: (realDt: number) => number;
      readonly step: (dt: number) => void;
      readonly frame: (realDt: number, simDt: number) => void;
    },
  ) {}

  start(): void {
    this.last = performance.now();
    const tick = (now: number) => {
      // Schedule the next frame first: an error in one frame must never stop the game for good.
      this.handle = requestAnimationFrame(tick);
      const realDt = Math.min(MAX_FRAME, (now - this.last) / 1000);
      this.last = now;
      const simDt = this.hooks.timeScale(realDt);
      this.accumulator += simDt;
      let steps = 0;
      while (this.accumulator >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME) {
        this.hooks.step(FIXED_STEP);
        this.accumulator -= FIXED_STEP;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
      this.hooks.frame(realDt, simDt);
    };
    this.handle = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.handle);
  }
}
