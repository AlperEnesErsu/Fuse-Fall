import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBurst, installCrashGuard } from '../src/app/crash-guard';

describe('ErrorBurst', () => {
  it('lets a glitch pass: errors spread over time never reach the limit', () => {
    const burst = new ErrorBurst(3, 1000);
    expect([0, 600, 1200, 1800, 2400].map((t) => burst.record(t))).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('calls a run of errors inside the window a crash', () => {
    const burst = new ErrorBurst(3, 1000);
    expect([0, 100, 200].map((t) => burst.record(t))).toEqual([false, false, true]);
  });

  it('forgets errors older than the window', () => {
    const burst = new ErrorBurst(3, 1000);
    burst.record(0);
    burst.record(100);
    expect(burst.record(1500)).toBe(false);
  });
});

describe('installCrashGuard', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the crash screen once, when errors keep coming', () => {
    const target = new EventTarget();
    vi.stubGlobal('window', target);
    const onFatal = vi.fn();
    installCrashGuard(onFatal, new ErrorBurst(2, 1000));

    target.dispatchEvent(new Event('error'));
    expect(onFatal).not.toHaveBeenCalled();
    target.dispatchEvent(new Event('unhandledrejection'));
    target.dispatchEvent(new Event('error'));

    expect(onFatal).toHaveBeenCalledTimes(1);
  });
});
