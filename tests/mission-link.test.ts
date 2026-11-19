import { afterEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({ on: false }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.on } }));
vi.stubGlobal('__SITE_URL__', 'https://site.test/game');

const { linkBase, takeLinkedCode } = await import('../src/infrastructure/mission-link');

const at = (href: string) => {
  const url = new URL(href);
  const replaced: string[] = [];
  vi.stubGlobal('location', { protocol: url.protocol, origin: url.origin, pathname: url.pathname, search: url.search, hash: url.hash });
  vi.stubGlobal('history', { replaceState: (_s: unknown, _t: string, to: string) => replaced.push(to) });
  return replaced;
};

afterEach(() => {
  native.on = false;
});

describe('mission links', () => {
  it('on the web, link to the page itself', () => {
    at('https://fuse.test/play/?x=1#old');
    expect(linkBase()).toBe('https://fuse.test/play/');
  });

  it('not from a page opened as a file', () => {
    at('file:///C:/game/index.html');
    expect(linkBase()).toBeUndefined();
  });

  it('in the app, link to the public site the build knows', () => {
    native.on = true;
    expect(linkBase()).toBe('https://site.test/game/index.html');
  });

  it('take the code from the address once, and clean the address', () => {
    const replaced = at('https://fuse.test/play/?x=1#FF1-abc');
    expect(takeLinkedCode()).toBe('FF1-abc');
    expect(replaced).toEqual(['/play/?x=1']);
    at('https://fuse.test/play/#about');
    expect(takeLinkedCode()).toBeUndefined();
  });
});
