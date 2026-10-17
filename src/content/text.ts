import type { LevelDefinition } from '../core/level';
import type { WorldDefinition } from '../core/world';
import type { Language } from '../presentation/strings';

/**
 * Display text for content. Turkish lives in the level and city data (the
 * source of truth); other languages are tables keyed by id here. A test checks
 * that every level and city has an English entry.
 */
const EN_LEVELS: Readonly<Record<string, { readonly name: string; readonly hint: string }>> = {
  'w1-01': { name: 'First Charge', hint: 'Place the charge at the foot of the supports, then fire.' },
  'w1-02': { name: 'Twin Masts', hint: 'One well-placed charge brings down both structures.' },
  'w1-03': { name: 'Glass Pavilion', hint: 'Glass is weak; a charge from a distance is enough.' },
  'w1-04': { name: 'Fuel Depot', hint: 'Fuel barrels set each other off. Use that.' },
  'w1-05': { name: 'Reinforced Concrete', hint: 'Concrete columns are tough. Each one needs its own charge.' },
  'w1-06': {
    name: 'Factory Chimney',
    hint: 'The building on the right is protected. A chimney falls toward the side its base is cut; keep the blast circle off the building.',
  },
  'w1-07': { name: 'Bridge', hint: 'Cut both piers to drop the deck.' },
  'w1-08': { name: 'Chain Reaction', hint: 'Set off the first barrel; the chain does the rest.' },
  'w1-09': { name: 'Steel Beams', hint: 'Steel does not break, but it tips. Use its weight.' },
  'w1-10': { name: 'Operation Kızılay', hint: 'Three targets, one protected building. Plan the order.' },
  'w2-01': { name: 'Glass Facade', hint: 'Glass columns are brittle; no need to get close.' },
  'w2-02': { name: 'Party Wall', hint: 'The building on the left is protected. Cut the chimney on the right side.' },
  'w2-03': { name: 'Glass Terrace', hint: 'The shop on the left is protected. Keep the charge away from it.' },
  'w2-04': { name: 'Moving Target', hint: 'Fire as the vehicle passes over the charge. Timing is critical.' },
  'w2-05': { name: 'Timber Bridge', hint: 'If the bridge goes, the vehicle goes with it.' },
  'w2-06': { name: 'Junction', hint: 'Two vehicles, two charges. They go off in turn; allow for the second delay.' },
  'w2-07': { name: 'Convoy', hint: 'Catch the vehicle first, then bring down the tower.' },
  'w2-08': { name: 'Barrel Road', hint: 'Start the chain when the vehicle reaches the barrels.' },
  'w2-09': { name: 'Pyramid Base', hint: 'Cut the base from both sides; the pyramid comes down under its own weight.' },
  'w2-10': { name: 'Operation Seine', hint: 'Traffic, glass and timber. Bring down all three targets.' },
  'w3-01': { name: 'Two Columns', hint: 'The building on the right is protected. Keep the blast circle clear of it.' },
  'w3-02': { name: 'Three Columns', hint: 'The middle column carries most of the load.' },
  'w3-03': { name: 'Convoy', hint: 'Two vehicles pass the same spot. Set the second delay for the second vehicle.' },
  'w3-04': { name: 'Tower Crane', hint: 'Steel will not break; cut the timber legs to tip the crane.' },
  'w3-05': { name: 'Two Lanes', hint: 'The upper lane is fast, the lower one slow. Catch both with one firing.' },
  'w3-06': { name: 'Clock Tower', hint: 'The building on the left is protected. Cut the tower on the right side.' },
  'w3-07': { name: 'Tower Bridge', hint: 'Two towers and a vehicle on the bridge. Towers at once, the vehicle when it arrives.' },
  'w3-08': { name: 'Night Convoy', hint: 'Three vehicles in a row. Set the delays to the gaps between them.' },
  'w3-09': { name: 'Glass Tower', hint: 'Glass is brittle; use the charge from a distance.' },
  'w3-10': { name: 'London Finale', hint: 'A convoy and a building. Set three delays for one firing.' },
};

const EN_CITIES: Readonly<Record<string, { readonly city: string; readonly country: string }>> = {
  ankara: { city: 'Ankara', country: 'Türkiye' },
  paris: { city: 'Paris', country: 'France' },
  london: { city: 'London', country: 'United Kingdom' },
  rome: { city: 'Rome', country: 'Italy' },
  tokyo: { city: 'Tokyo', country: 'Japan' },
};

/** Daily missions have their own id: callers pass the base mission for its text. */
export interface ContentText {
  levelName(level: LevelDefinition): string;
  levelHint(level: LevelDefinition): string | undefined;
  city(world: WorldDefinition): string;
  country(world: WorldDefinition): string;
}

export const contentText = (language: Language): ContentText =>
  language === 'tr'
    ? {
        levelName: (l) => l.name,
        levelHint: (l) => l.hint,
        city: (w) => w.city,
        country: (w) => w.country,
      }
    : {
        levelName: (l) => EN_LEVELS[l.id]?.name ?? l.name,
        levelHint: (l) => (l.hint === undefined ? undefined : (EN_LEVELS[l.id]?.hint ?? l.hint)),
        city: (w) => EN_CITIES[w.key]?.city ?? w.city,
        country: (w) => EN_CITIES[w.key]?.country ?? w.country,
      };

/** For the completeness test. */
export const englishCoverage = { levels: EN_LEVELS, cities: EN_CITIES };
