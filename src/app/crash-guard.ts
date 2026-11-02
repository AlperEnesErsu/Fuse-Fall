/**
 * The loop already survives an error in one frame (it schedules the next frame
 * first). What it cannot survive is an error in every frame: the picture
 * freezes and the player has no way out. This counts uncaught errors and calls
 * the game broken only when they keep coming.
 */
export class ErrorBurst {
  private readonly times: number[] = [];

  constructor(
    /** Errors within `windowMs` that mean the game is stuck, not glitching. */
    private readonly limit = 30,
    private readonly windowMs = 3000,
  ) {}

  /** Records one error at `now` (ms); true once the burst is reached. */
  record(now: number): boolean {
    this.times.push(now);
    while (now - (this.times[0] ?? now) > this.windowMs) this.times.shift();
    return this.times.length >= this.limit;
  }
}

/**
 * Shows `onFatal` once, when uncaught errors or rejections come in a burst.
 * Nothing leaves the device (NFR-06): errors still go to the console only.
 */
export const installCrashGuard = (onFatal: () => void, burst = new ErrorBurst()): void => {
  let shown = false;
  const seen = () => {
    if (shown || !burst.record(performance.now())) return;
    shown = true;
    onFatal();
  };
  window.addEventListener('error', seen);
  window.addEventListener('unhandledrejection', seen);
};
