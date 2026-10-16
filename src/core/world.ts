import { err, ok, type Result } from './result';

/** A part of the campaign: one capital city with its own levels. */
export interface WorldDefinition {
  /** Matches LevelDefinition.world. */
  readonly world: number;
  /** Stable key used by the presentation layer to pick the city's look. */
  readonly key: string;
  readonly city: string;
  readonly country: string;
  /** Total stars needed, on top of finishing the previous city. */
  readonly unlockStars: number;
}

export interface WorldError {
  readonly kind: 'invalid-world';
  readonly path: string;
  readonly message: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const parseWorlds = (input: unknown): Result<WorldDefinition[], WorldError> => {
  if (!Array.isArray(input)) return err({ kind: 'invalid-world', path: '$', message: 'expected array' });
  const worlds: WorldDefinition[] = [];
  for (const [i, raw] of input.entries()) {
    const path = `$[${i}]`;
    if (!isRecord(raw)) return err({ kind: 'invalid-world', path, message: 'expected object' });
    const { world, key, city, country, unlockStars } = raw;
    if (!Number.isInteger(world) || (world as number) < 1) {
      return err({ kind: 'invalid-world', path: `${path}.world`, message: 'expected positive integer' });
    }
    for (const [name, value] of Object.entries({ key, city, country })) {
      if (typeof value !== 'string' || value.length === 0) {
        return err({ kind: 'invalid-world', path: `${path}.${name}`, message: 'expected non-empty string' });
      }
    }
    if (!Number.isInteger(unlockStars) || (unlockStars as number) < 0) {
      return err({ kind: 'invalid-world', path: `${path}.unlockStars`, message: 'expected non-negative integer' });
    }
    if (worlds.some((w) => w.world === world || w.key === key)) {
      return err({ kind: 'invalid-world', path, message: 'duplicate world or key' });
    }
    worlds.push({
      world: world as number,
      key: key as string,
      city: city as string,
      country: country as string,
      unlockStars: unlockStars as number,
    });
  }
  worlds.sort((a, b) => a.world - b.world);
  return ok(worlds);
};
