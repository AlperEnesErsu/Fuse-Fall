import { hashString } from './math';

/**
 * Weekly contracts: three goals a week, the same for everyone that week and
 * drawn offline from the week's number. Finishing one pays scrap. Only fresh
 * results count (a first full win, a stars gain, a daily's first win), so
 * replaying a finished job cannot fill a contract. The Free Site never counts.
 */

export const CONTRACT_KINDS = ['clear', 'three-stars', 'surgical', 'daily', 'barrels', 'cars', 'implosion', 'domino'] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];

export interface ContractDef {
  readonly kind: ContractKind;
  readonly goal: number;
  readonly reward: number;
}

const DEFS: Readonly<Record<ContractKind, { goal: number; reward: number }>> = {
  clear: { goal: 8, reward: 120 },
  'three-stars': { goal: 4, reward: 150 },
  surgical: { goal: 5, reward: 140 },
  daily: { goal: 3, reward: 160 },
  barrels: { goal: 10, reward: 130 },
  cars: { goal: 6, reward: 140 },
  implosion: { goal: 3, reward: 170 },
  domino: { goal: 2, reward: 180 },
};

/** Kinds anyone can do from the first city. */
const BASIC: readonly ContractKind[] = ['clear', 'three-stars', 'surgical', 'daily'];
/** Kinds that need later cities (barrels, traffic, implosion charges); offered once the player has this many stars. */
export const ADVANCED_STARS = 30;

export const CONTRACTS_PER_WEEK = 3;

/** ISO week of a local date, as YYYY-Www (weeks start on Monday). */
export const weekOf = (date: Date): string => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - weekday); // the Thursday of this week decides its year
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
};

/** This week's contracts: three different kinds, in a fixed order for the week. */
export const weeklyContracts = (week: string, stars: number): ContractDef[] => {
  const pool = stars >= ADVANCED_STARS ? [...CONTRACT_KINDS] : [...BASIC];
  const picked: ContractKind[] = [];
  let seed = hashString(`contracts:${week}`);
  while (picked.length < CONTRACTS_PER_WEEK && pool.length > 0) {
    const kind = pool.splice(seed % pool.length, 1)[0];
    if (kind) picked.push(kind);
    seed = hashString(`${seed}`);
  }
  return defsOf(picked);
};

/** What a finished job did, for the contracts. */
export interface JobFacts {
  /** A fresh result: a first full win, or one that raised the job's stars. Replays that gain nothing do not count. */
  readonly counts: boolean;
  readonly cleared: boolean;
  readonly stars: number;
  readonly underPar: boolean;
  readonly daily: boolean;
  readonly barrels: number;
  readonly cars: number;
  readonly implosions: number;
  readonly domino: boolean;
}

/** How far one job moves a contract of this kind. */
export const contribution = (kind: ContractKind, job: JobFacts): number => {
  switch (kind) {
    case 'clear':
      return Number(job.cleared);
    case 'three-stars':
      return Number(job.stars === 3);
    case 'surgical':
      return Number(job.cleared && job.underPar);
    case 'daily':
      return Number(job.daily && job.cleared);
    case 'barrels':
      return job.barrels;
    case 'cars':
      return job.cars;
    case 'implosion':
      return Number(job.cleared && job.implosions > 0);
    case 'domino':
      return Number(job.cleared && job.domino);
  }
};

/** Contract progress saved with the game: the week, the kinds drawn for it (kept all week), and counts per kind. */
export interface ContractProgress {
  readonly week: string;
  readonly kinds: readonly ContractKind[];
  readonly counts: Readonly<Partial<Record<ContractKind, number>>>;
}

export const NO_CONTRACTS: ContractProgress = { week: '', kinds: [], counts: {} };

/** A week's contracts with their counts. A saved week that is over starts afresh. */
export const contractsOf = (saved: ContractProgress, week: string, stars: number): ContractProgress => {
  if (saved.week === week && saved.kinds.length > 0) return saved;
  return { week, kinds: weeklyContracts(week, stars).map((c) => c.kind), counts: {} };
};

/** The definitions of a set of drawn kinds. */
export const defsOf = (kinds: readonly ContractKind[]): ContractDef[] => kinds.map((kind) => ({ kind, ...DEFS[kind] }));

/**
 * Adds a job to this week's contracts. Returns the new progress and the
 * contracts it finished (each finishes once: its count stops at the goal).
 */
export const advanceContracts = (
  saved: ContractProgress,
  week: string,
  stars: number,
  job: JobFacts,
): { progress: ContractProgress; finished: ContractDef[] } => {
  const current = contractsOf(saved, week, stars);
  const counts = { ...current.counts };
  const finished: ContractDef[] = [];
  for (const c of defsOf(current.kinds)) {
    const before = counts[c.kind] ?? 0;
    if (before >= c.goal) continue;
    const after = Math.min(c.goal, before + (job.counts ? contribution(c.kind, job) : 0));
    counts[c.kind] = after;
    if (after >= c.goal) finished.push(c);
  }
  return { progress: { ...current, counts }, finished };
};
