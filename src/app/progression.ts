import { contractsOf, defsOf, weekOf } from '../core/contracts';
import type { LevelDefinition } from '../core/level';
import {
  isLevelUnlocked,
  levelsOf,
  totalStars,
  worldStatus,
  type Campaign,
  type Progress,
  type WorldStatus,
} from '../core/progress';
import type { ContractView } from '../presentation/ui';

/**
 * Which cities and missions the player may open. `unlockAll` is the test
 * switch that opens everything that has missions, without touching the save.
 */
export class Progression {
  constructor(
    private readonly campaign: Campaign,
    private readonly progress: () => Progress,
    private readonly unlockAll: boolean,
  ) {}

  worldStatus(world: number): WorldStatus {
    const status = worldStatus(this.progress(), this.campaign, world);
    return this.unlockAll && status.kind === 'locked' ? { kind: 'open' } : status;
  }

  levelUnlocked(levelId: string): boolean {
    return this.unlockAll || isLevelUnlocked(this.progress(), this.campaign, levelId);
  }

  /** The first open mission not yet won, in campaign order. */
  nextMission(): LevelDefinition | undefined {
    const progress = this.progress();
    for (const world of this.campaign.worlds) {
      for (const level of levelsOf(this.campaign, world.world)) {
        if ((progress.stars[level.id] ?? 0) === 0 && this.levelUnlocked(level.id)) return level;
      }
    }
    return undefined;
  }

  /** The mission after `level` in its city, if any. */
  nextLevel(level: LevelDefinition): LevelDefinition | undefined {
    const same = levelsOf(this.campaign, level.world);
    return same[same.indexOf(level) + 1];
  }
}

/** This week's contracts with their counts (a new week starts them afresh). */
export const contractViews = (progress: Progress, now: Date): ContractView[] => {
  const week = contractsOf(progress.contracts, weekOf(now), totalStars(progress));
  return defsOf(week.kinds).map((c) => ({ ...c, count: week.counts[c.kind] ?? 0 }));
};
