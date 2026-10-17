import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export type ShareOutcome = 'shared' | 'saved' | 'cancelled' | 'failed';

/**
 * Hands a recorded clip to the device. On Android it is written to the app's
 * cache and offered to the system share sheet; in a browser it uses the Web
 * Share API where files can be shared, and otherwise downloads the file.
 */
export const shareClip = async (clip: Blob, fileName: string, title: string): Promise<ShareOutcome> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const written = await Filesystem.writeFile({ path: fileName, data: await toBase64(clip), directory: Directory.Cache });
      await Share.share({ title, url: written.uri, dialogTitle: title });
      return 'shared';
    }
    const file = new File([clip], fileName, { type: clip.type });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
        return 'shared';
      } catch (e) {
        if (isCancel(e)) return 'cancelled';
        // Browsers only open the share sheet straight after a tap; the clip arrives later. Download instead.
      }
    }
    const url = URL.createObjectURL(clip);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'saved';
  } catch (e) {
    return isCancel(e) ? 'cancelled' : 'failed';
  }
};

/** Closing the share sheet is a choice, not a failure. */
const isCancel = (e: unknown): boolean => e instanceof Error && /cancel|abort/i.test(`${e.name} ${e.message}`);

const toBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
