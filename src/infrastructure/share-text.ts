import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import type { ShareOutcome } from './share-clip';

/**
 * Hands a piece of text to the system share sheet: on Android through Capacitor,
 * in a browser through the Web Share API. Where neither exists it goes to the
 * clipboard instead ('saved'), so the player can paste it wherever they like.
 * Nothing is ever sent by the game itself.
 */
export const shareText = async (text: string, title: string): Promise<ShareOutcome> => {
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({ title, text, dialogTitle: title });
      return 'shared';
    }
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text });
        return 'shared';
      } catch (e) {
        if (isCancel(e)) return 'cancelled';
        // No share target, or not allowed here: fall back to the clipboard.
      }
    }
    await navigator.clipboard.writeText(text);
    return 'saved';
  } catch (e) {
    return isCancel(e) ? 'cancelled' : 'failed';
  }
};

const isCancel = (e: unknown): boolean => e instanceof Error && /cancel|abort/i.test(`${e.name} ${e.message}`);
