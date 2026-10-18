import { parseLevelPack } from '../core/level';
import type { Campaign } from '../core/progress';
import { parseWorlds } from '../core/world';
import cities from './cities.json';
import ankara from './levels/ankara.json';
import london from './levels/london.json';
import paris from './levels/paris.json';
import rome from './levels/rome.json';
import tokyo from './levels/tokyo.json';
import istanbul from './levels/istanbul.json';
import berlin from './levels/berlin.json';
import madrid from './levels/madrid.json';
import newyork from './levels/newyork.json';

/** Level packs in campaign order. A city listed in cities.json without a pack shows as "coming soon". */
const PACKS: readonly unknown[][] = [ankara, paris, london, rome, tokyo, istanbul, berlin, madrid, newyork];

/** Bundled content, validated once at startup. Bad content fails loudly in development and tests. */
export const loadCampaign = (): Campaign => {
  const worlds = parseWorlds(cities);
  if (!worlds.ok) throw new Error(`City data invalid at ${worlds.error.path}: ${worlds.error.message}`);
  const levels = parseLevelPack(PACKS.flat());
  if (!levels.ok) throw new Error(`Level data invalid at ${levels.error.path}: ${levels.error.message}`);
  const orphan = levels.value.find((l) => !worlds.value.some((w) => w.world === l.world));
  if (orphan) throw new Error(`Level ${orphan.id} belongs to unknown world ${orphan.world}`);
  return { worlds: worlds.value, levels: levels.value };
};
