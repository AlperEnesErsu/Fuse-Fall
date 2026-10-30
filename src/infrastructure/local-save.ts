import type { SaveRepository } from '../core/ports';
import { emptyProgress, parseProgress, type Progress } from '../core/progress';

/** The subset of Web Storage we use, so tests can pass a fake. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

const PRIMARY = 'fuse-and-fall/progress';
const BACKUP = 'fuse-and-fall/progress.bak';
/** A save this build could not read, kept as it was instead of being overwritten. */
const UNREADABLE = 'fuse-and-fall/progress.unreadable';

/**
 * Stores progress on the device only. Before each write the last valid save is
 * copied to a backup key; on load a corrupt primary falls back to the backup,
 * then to a fresh profile. A primary this build cannot read (damaged, or written
 * by a newer version) is set aside before it is first overwritten, so the
 * player's progress is never destroyed by a save. Storage failures (private
 * mode, quota) never crash the game.
 */
export class LocalSaveRepository implements SaveRepository {
  constructor(private readonly store: KeyValueStore) {}

  load(): Progress {
    return this.read(PRIMARY) ?? this.read(BACKUP) ?? emptyProgress();
  }

  save(progress: Progress): boolean {
    try {
      const current = this.store.getItem(PRIMARY);
      if (current !== null) {
        if (this.read(PRIMARY)) this.store.setItem(BACKUP, current);
        // Kept once: the first save that could not be read is the one worth recovering.
        else if (this.store.getItem(UNREADABLE) === null) this.store.setItem(UNREADABLE, current);
      }
      const json = JSON.stringify(progress);
      this.store.setItem(PRIMARY, json);
      // Some stores drop writes without throwing; only a read-back proves the save holds.
      return this.store.getItem(PRIMARY) === json;
    } catch {
      // Unavailable storage means progress lasts for this session only.
      return false;
    }
  }

  private read(key: string): Progress | undefined {
    try {
      const raw = this.store.getItem(key);
      if (raw === null) return undefined;
      const parsed = parseProgress(JSON.parse(raw));
      return parsed.ok ? parsed.value : undefined;
    } catch {
      return undefined;
    }
  }
}
