import { Capacitor } from '@capacitor/core';

/**
 * Where a mission link points, or undefined to share the bare code. The web game links to
 * itself (a deploy preview to the preview); the app links to the public site when the build
 * knows it (VITE_SITE_URL), so a friend without the app can play the mission in a browser.
 */
export const linkBase = (): string | undefined => {
  if (Capacitor.isNativePlatform()) return __SITE_URL__ || undefined;
  if (location.protocol !== 'https:' && location.protocol !== 'http:') return undefined;
  return location.origin + location.pathname;
};

/** The mission code a link opened the game with, taken off the address so a reload does not replay it. */
export const takeLinkedCode = (): string | undefined => {
  if (Capacitor.isNativePlatform() || !location.hash.includes('FF1-')) return undefined;
  const hash = decodeURIComponent(location.hash.slice(1));
  history.replaceState(null, '', location.pathname + location.search);
  return hash;
};
