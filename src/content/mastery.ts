import { isMasteryKind, type MasteryGoal } from '../core/mastery';
import type { LevelDefinition } from '../core/level';
import data from './mastery.json';

/**
 * Each campaign job's third-star goal, and a play that earns all three stars
 * (found by tests/mastery-search.test.ts, replayed by tests/levels.test.ts).
 * The play is proof the goal can be met; the game only reads the goal.
 */
export interface MasteryEntry {
  readonly goal: MasteryGoal;
  readonly solution: {
    readonly charges: LevelDefinition['solution']['charges'];
    readonly fireAt: number;
    readonly detonateAt: readonly number[];
  };
  /** No better play was found: the recorded solution already meets this goal. */
  readonly free?: true;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Bundled content, checked once: a bad entry fails loudly in development and tests. */
export const MASTERY: Readonly<Record<string, MasteryEntry>> = (() => {
  const raw: unknown = data;
  if (!isRecord(raw)) throw new Error('mastery.json: expected an object');
  const out: Record<string, MasteryEntry> = {};
  for (const [id, entry] of Object.entries(raw)) {
    const goal = isRecord(entry) ? entry.goal : undefined;
    const at = isRecord(goal) ? goal.at : undefined;
    if (
      !isRecord(entry) ||
      !isRecord(goal) ||
      !isMasteryKind(goal.kind) ||
      (at !== undefined && (typeof at !== 'number' || at <= 0 || (goal.kind !== 'quick' && at > 1))) ||
      (goal.kind === 'quick' && at === undefined) ||
      !isRecord(entry.solution) ||
      !Array.isArray(entry.solution.charges)
    ) {
      throw new Error(`mastery.json: bad entry for ${id}`);
    }
    out[id] = entry as unknown as MasteryEntry;
  }
  return out;
})();

/** The jobs with their third-star goals filled in. */
export const withMastery = (levels: readonly LevelDefinition[]): LevelDefinition[] =>
  levels.map((l) => {
    const goal = MASTERY[l.id]?.goal;
    return goal ? { ...l, mastery: goal } : l;
  });
