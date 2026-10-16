import './styles.css';
import { Capacitor } from '@capacitor/core';
import { Game } from './app/game';
import { loadCampaign } from './content/levels';
import { LocalSaveRepository, type KeyValueStore } from './infrastructure/local-save';

const memoryStore = (): KeyValueStore => {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

/** Some private modes throw on access to localStorage; fall back to memory. */
const deviceStore = (): KeyValueStore => {
  try {
    return window.localStorage;
  } catch {
    return memoryStore();
  }
};

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const uiRoot = document.querySelector<HTMLElement>('#ui');
if (!canvas || !uiRoot) throw new Error('Missing #game or #ui element');

new Game(canvas, uiRoot, loadCampaign(), new LocalSaveRepository(deviceStore()), (ms) => {
  navigator.vibrate?.(ms);
}).start();

// Offline support (NFR-02) for the web build. The native app already ships its files, so it needs none.
if (import.meta.env.PROD && 'serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js');
  });
}
