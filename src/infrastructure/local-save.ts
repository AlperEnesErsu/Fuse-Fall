import type { SaveRepository } from '../core/ports';
import { emptyProgress, parseProgress, type Progress } from '../core/progress';

/** The subset of Web Storage we use, so tests can pass a fake. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

const PRIMARY = 'fuse-and-fall/progress';
const BACKUP = 'fuse-and-fall/progress.bak';

/**
 * Stores progress on the device only. Before each write the last valid save is
 * copied to a backup key; on load a corrupt primary falls back to the backup,
 * then to a fresh profile. Storage failures (private mode, quota) never crash the game.
 */
export class LocalSaveRepository implements SaveRepository {
  constructor(private readonly store: KeyValueStore) {}

  load(): Progress {
    return this.read(PRIMARY) ?? this.read(BACKUP) ?? emptyProgress();
  }

  save(progress: Progress): void {
    try {
      const current = this.store.getItem(PRIMARY);
      if (current !== null && this.read(PRIMARY)) this.store.setItem(BACKUP, current);
      this.store.setItem(PRIMARY, JSON.stringify(progress));
    } catch {
      // Unavailable storage means progress lasts for this session only.
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
