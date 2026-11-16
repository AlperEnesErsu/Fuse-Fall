import { readFileSync, writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import type { LevelDefinition } from '../src/core/level';
import { MASTERY_DEFAULT_SHARE, masteryMet, type MasteryGoal, type MasteryKind } from '../src/core/mastery';
import type { LevelResult } from '../src/core/scoring';
import { loadCampaign } from '../src/content/levels';
import { playSolution } from './play';

/**
 * Finds each campaign job's mastery goal and a solution that earns its three stars,
 * and writes them to src/content/mastery.json. Off by default (it plays thousands of
 * collapses): `MASTERY=write npm run mastery`.
 * `MASTERY_ONLY=w1-01,w4-09` limits it to some jobs and keeps the others as they are.
 *
 * In order, the goal is the first that the recorded solution does not meet but a
 * variant of it does, within par:
 *   one charge fewer, a domino, every barrel, all the debris on site (95%), and last
 *   the whole structure, at the best share a variant reaches, if that is at least
 *   ten points over the recorded play. tests/levels.test.ts replays every one.
 */
type Charge = LevelDefinition['solution']['charges'][number];
interface Plan {
  readonly charges: readonly Charge[];
  readonly fireAt: number;
  readonly detonateAt: readonly number[];
}
interface Found {
  readonly goal: MasteryGoal;
  readonly solution: Plan;
  /** No better play was found: the recorded solution already meets this goal. */
  readonly free?: true;
}

const GRID = 5;
const snap = (v: number) => Math.round(v / GRID) * GRID;
/** The share a 'whole' goal asks for: the best reached, in 5% steps, rounded down. */
const shareOf = (ratio: number) => Math.floor(ratio * 20 + 1e-9) / 20;
/** How far a 'whole' goal must sit above the recorded play to ask for something better. */
const WHOLE_MARGIN = 0.1;
/** A 'quick' goal: the best time, rounded up to half a second, at least this much under the recorded play. */
const quickOf = (seconds: number) => Math.ceil(seconds * 2 - 1e-9) / 2;
const QUICK_MARGIN = 0.5;

const play = (level: LevelDefinition, plan: Plan): LevelResult | undefined => {
  try {
    return playSolution(level, plan.fireAt, plan.charges, plan.detonateAt).result;
  } catch {
    return undefined; // a charge the game would refuse there
  }
};

const hasTarget = (level: LevelDefinition) => level.blocks.some((b) => b.target) || level.cars.some((c) => c.target);
const structural = (level: LevelDefinition) => level.blocks.some((b) => !b.anchored && !b.protected);

/** Variants of `base`, nearest first: one charge moved, one delay or press moved, the fire moment moved. */
function* nudges(base: Plan): Generator<Plan> {
  for (const r of [5, 10, 15, 20, 30, 40])
    for (const [dx, dy] of [[r, 0], [-r, 0], [0, -r / 2], [0, r / 2], [r, -r / 2], [-r, -r / 2], [r, r / 2], [-r, r / 2]] as const)
      for (let i = 0; i < base.charges.length; i++) {
        const c = base.charges[i];
        if (!c) continue;
        yield { ...base, charges: base.charges.map((o, k) => (k === i ? { ...o, x: snap(c.x + dx), y: snap(c.y + snap(dy)) } : o)) };
      }
  for (const n of [0.1, -0.1, 0.2, -0.2, 0.3, -0.3, 0.4, -0.4, 0.6, -0.6]) {
    for (let i = 0; i < base.charges.length; i++) {
      const c = base.charges[i];
      if (!c) continue;
      const d = (c.delay ?? 0.35 * i) + n;
      if (d >= 0 && d <= 2) yield { ...base, charges: base.charges.map((o, k) => (k === i ? { ...o, delay: Math.round(d * 20) / 20 } : o)) };
    }
    if (base.fireAt > 0 && base.fireAt + n >= 0) yield { ...base, fireAt: Math.round((base.fireAt + n) * 60) / 60 };
    for (let i = 0; i < base.detonateAt.length; i++) {
      const t = (base.detonateAt[i] ?? 0) + n;
      if (t > 0) yield { ...base, detonateAt: base.detonateAt.map((o, k) => (k === i ? Math.round(t * 60) / 60 : o)) };
    }
  }
}

/** The plan with one charge left out, then that plan's nudges. */
function* withoutOne(base: Plan): Generator<Plan> {
  for (let i = 0; i < base.charges.length; i++) {
    const fewer = { ...base, charges: base.charges.filter((_, k) => k !== i) };
    yield fewer;
    yield* nudges(fewer);
  }
}

/** The plan with one more charge on a grid over the charge zones, while par allows it. */
function* withOneMore(level: LevelDefinition, base: Plan): Generator<Plan> {
  if (base.charges.length + 1 > Math.min(level.charges.par, level.charges.max)) return;
  const kinds = level.chargeKinds.filter((k) => k === 'standard' || k === 'precision' || k === 'implosion');
  for (const z of level.zones) {
    if (z.w < 20 || z.h < 20) continue;
    for (let y = z.y + z.h - 10; y >= z.y + 10; y -= 20)
      for (let x = z.x + 10; x <= z.x + z.w - 10; x += 20)
        for (const kind of kinds) yield { ...base, charges: [...base.charges, { x: snap(x), y: snap(y), delay: undefined, kind }] };
  }
}

const BUDGET = Number(process.env.MASTERY_BUDGET ?? 400);

/** Plays variants and returns the first winning one within par that `meets` accepts. */
const firstMeeting = (level: LevelDefinition, sources: Iterable<Plan>[], meets: (r: LevelResult) => boolean): Plan | undefined => {
  let tried = 0;
  for (const source of sources)
    for (const plan of source) {
      if (plan.charges.length > level.charges.par) continue;
      if (++tried > BUDGET) return undefined;
      const r = play(level, plan);
      if (r?.cleared && r.underPar && meets(r)) return plan;
    }
  return undefined;
};

/** Plays variants and returns the winning one within par that scores highest on `value`. */
const bestBy = (
  level: LevelDefinition,
  sources: Iterable<Plan>[],
  value: (r: LevelResult) => number,
  enough: number,
): { plan: Plan; value: number } | undefined => {
  let best: { plan: Plan; value: number } | undefined;
  let tried = 0;
  for (const source of sources)
    for (const plan of source) {
      if (plan.charges.length > level.charges.par) continue;
      if (++tried > BUDGET) return best;
      const r = play(level, plan);
      if (r?.cleared && r.underPar && (!best || value(r) > best.value)) best = { plan, value: value(r) };
      if (best && best.value >= enough) return best;
    }
  return best;
};

const findGoal = (level: LevelDefinition, recorded: Plan, base: LevelResult): Found | undefined => {
  const par = level.charges.par;
  const goals: MasteryGoal[] = [
    ...(par >= 2 && recorded.charges.length >= 2 ? [{ kind: 'one-less' as const }] : []),
    ...(hasTarget(level) ? [{ kind: 'domino' as const }] : []),
    ...(level.barrels.length > 0 ? [{ kind: 'chain' as const }] : []),
    ...(level.footprint ? [{ kind: 'site' as const, at: MASTERY_DEFAULT_SHARE }] : []),
  ];
  for (const goal of goals) {
    if (masteryMet(goal, base, par)) continue; // free with the recorded play: not mastery
    const sources = goal.kind === 'one-less' ? [withoutOne(recorded)] : goal.kind === 'chain' ? [nudges(recorded), withOneMore(level, recorded)] : [nudges(recorded)];
    const plan = firstMeeting(level, sources, (r) => masteryMet(goal, r, par));
    if (plan) return { goal, solution: plan };
  }
  if (structural(level)) {
    const best = bestBy(level, [nudges(recorded), withOneMore(level, recorded)], (r) => r.collapseRatio, 1);
    if (best && shareOf(best.value) >= base.collapseRatio + WHOLE_MARGIN) return { goal: { kind: 'whole', at: shareOf(best.value) }, solution: best.plan };
  }
  // Last, any job: finish quicker. Timing a blast well, or bringing it all down at once, settles sooner.
  const fastest = bestBy(level, [nudges(recorded)], (r) => -r.duration, 0);
  if (fastest && quickOf(-fastest.value) <= base.duration - QUICK_MARGIN) return { goal: { kind: 'quick', at: quickOf(-fastest.value) }, solution: fastest.plan };
  return undefined;
};

const OUT = 'src/content/mastery.json';

describe.skipIf(process.env.MASTERY !== 'write')('mastery search', () => {
  it('finds a goal and a three-star solution for every job', { timeout: 7_200_000 }, () => {
    const only = process.env.MASTERY_ONLY?.split(',');
    let previous: Record<string, Found>;
    try {
      previous = JSON.parse(readFileSync(OUT, 'utf8')) as Record<string, Found>;
    } catch {
      previous = {};
    }
    const out: Record<string, Found> = {};
    const missing: string[] = [];
    for (const level of loadCampaign().levels) {
      if (only && !only.includes(level.id)) {
        const kept = previous[level.id];
        if (kept) out[level.id] = kept;
        continue;
      }
      const recorded: Plan = { charges: level.solution.charges, fireAt: level.solution.fireAt, detonateAt: level.solution.detonateAt };
      // Judge the recorded play as the game will: without any goal set yet.
      const bare: LevelDefinition = { ...level, mastery: undefined };
      const base = play(bare, recorded);
      if (!base?.cleared) throw new Error(`${level.id}: the recorded solution does not win`);
      let found = findGoal(bare, recorded, base);
      if (!found) {
        // Nothing better was within reach: a goal the recorded play meets, marked so it can be designed by hand.
        // A share of nothing is no goal: 'whole' only where the recorded play brings down a real part.
        const kinds: MasteryKind[] = base.collapseRatio >= 0.5 ? ['domino', 'chain', 'site', 'whole'] : ['domino', 'chain', 'site'];
        const kind = kinds.find((k) => masteryMet({ kind: k, at: k === 'whole' ? shareOf(base.collapseRatio) : undefined }, base, level.charges.par));
        if (kind && base.underPar) found = { goal: kind === 'whole' ? { kind, at: shareOf(base.collapseRatio) } : { kind }, solution: recorded, free: true };
        // Traffic jobs with nothing to bring down: the clean, well-timed play the job is built around.
        else if (base.underPar) found = { goal: { kind: 'quick', at: quickOf(base.duration) }, solution: recorded, free: true };
      }
      if (!found) {
        missing.push(level.id);
        console.log(`${level.id}: NONE`);
        continue;
      }
      out[level.id] = found;
      console.log(`${level.id}: ${found.goal.kind}${found.goal.at !== undefined ? ` ${found.goal.at}` : ''}${found.free ? ' (free)' : ''}`);
    }
    writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
    if (missing.length > 0) throw new Error(`no mastery goal could be earned for: ${missing.join(', ')}`);
  });
});
