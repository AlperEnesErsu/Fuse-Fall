import type { LevelResult } from './scoring';

/**
 * A result carried in a mission code, to beat: "I did this one with 1 charge, 92% down,
 * in 3.4 s. Can you do better?" No accounts and no server: the code is the challenge.
 */
export interface Challenge {
  readonly charges: number;
  /** Share of the structure brought down, in whole percent. */
  readonly collapse: number;
  /** Seconds from Fire until it all settled, to a tenth. */
  readonly seconds: number;
}

/** The challenge a won job leaves for the next player. */
export const challengeOf = (result: LevelResult): Challenge => ({
  charges: result.chargesUsed,
  collapse: Math.round(result.collapseRatio * 100),
  seconds: Math.round(result.duration * 10) / 10,
});

/** A challenge read from a pasted code: untrusted, so only whole, sensible numbers pass. */
export const parseChallenge = (raw: unknown, maxCharges: number): Challenge | undefined => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const { charges, collapse, seconds } = o;
  if (typeof charges !== 'number' || !Number.isInteger(charges) || charges < 0 || charges > maxCharges) return undefined;
  if (typeof collapse !== 'number' || !Number.isInteger(collapse) || collapse < 0 || collapse > 100) return undefined;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0 || seconds > 60) return undefined;
  return { charges, collapse, seconds: Math.round(seconds * 10) / 10 };
};

export type ChallengeVerdict = 'beaten' | 'tied' | 'missed';

/**
 * Whether a result beats a challenge. Only a win counts. Then fewer charges wins; with
 * the same charges, more brought down; with that equal too, a quicker finish.
 */
export const judgeChallenge = (challenge: Challenge, result: LevelResult): ChallengeVerdict => {
  if (!result.cleared) return 'missed';
  const mine = challengeOf(result);
  // How far ahead this result is on each measure, in order: positive is better.
  const ahead = [challenge.charges - mine.charges, mine.collapse - challenge.collapse, challenge.seconds - mine.seconds];
  for (const by of ahead) {
    if (by > 1e-9) return 'beaten';
    if (by < -1e-9) return 'missed';
  }
  return 'tied';
};
