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
  'w1-07': { name: 'Bridge', hint: 'The deck is tied to its piers; cut one and the bridge keels over.' },
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
  'w2-09': { name: 'Pyramid Base', hint: 'Cut the base; the pyramid comes down under its own weight.' },
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
  'w4-01': {
    name: 'Precision Charge',
    hint: 'The neighbour is too close: a standard blast would reach it. Switch to precision.',
  },
  'w4-02': { name: 'Tight Site', hint: 'The debris must stay in the striped site. Precision charges throw less.' },
  'w4-03': { name: 'Arcade Court', hint: 'Three supports. Cut the right one and it folds into itself.' },
  'w4-04': { name: 'Marble Columns', hint: 'The historic building on the left is protected, and the site is tight.' },
  'w4-05': { name: 'Market Square', hint: 'Two structures, one site. Bring both down inside it.' },
  'w4-06': { name: 'Tiber Bridge', hint: 'Cut the piers while the vehicle is on the bridge; the bridge must land on site.' },
  'w4-07': { name: 'Bell Tower', hint: 'The site is to the left of the tower. Lay it down that way.' },
  'w4-08': { name: 'Colonnade', hint: 'A long four-support building; historic buildings on both sides.' },
  'w4-09': { name: 'Dome', hint: 'Cut the drum; the dome comes down under its own weight.' },
  'w4-10': { name: 'Rome Finale', hint: 'Two structures, a tight site, a historic neighbour. Choose each charge type and spot.' },
  'w5-01': { name: 'Between Trains', hint: 'A protected train passes every few seconds. Do not fire while a circle is red.' },
  'w5-02': { name: 'Two Stops', hint: 'Two structures, one window. Both charges must go off while the train is away.' },
  'w5-03': { name: 'Under the Deck', hint: 'The cut is right under the deck. A precision circle does not reach the train.' },
  'w5-04': { name: 'Platform Canopy', hint: 'Keep the canopy debris on the platform site; do not fire while the train passes.' },
  'w5-05': { name: 'Signal Mast', hint: 'The kiosk on the left is protected. Lay the mast down to the right; mind the train.' },
  'w5-06': { name: 'Road Below', hint: 'Catch the vehicle on the lower road; the train above is protected.' },
  'w5-07': { name: 'Night Service', hint: 'The night train is faster. The window is narrower.' },
  'w5-08': { name: 'Fuel Depot', hint: 'The barrel chain throws upward too. Wait for the train.' },
  'w5-09': { name: 'Crossing Below', hint: 'Two vehicles below, a train above. Set the delays for both.' },
  'w5-10': { name: 'Tokyo Finale', hint: 'A tight site, a protected kiosk and the timetable. Think about all of them at once.' },
  'w6-01': { name: 'First Bomb', hint: 'Hang the bomb above the tower, FIRE, and DETONATE as it falls.' },
  'w6-02': { name: 'Airburst', hint: 'The houses below are protected. Detonate while the bomb is level with the mast top, before it lands.' },
  'w6-03': { name: 'Roof Storey', hint: 'Drop the bomb onto the ridge and detonate at once. Left to its fuse, it slides off the roof.' },
  'w6-04': { name: 'Two Bombs', hint: 'Two bombs, one DETONATE. The house between them is protected: press before they land, once both have reached their targets.' },
  'w6-05': { name: 'Fuse and Bomb', hint: 'The fuse cuts the base; the bomb catches the top storey. The house on the right is protected: detonate in the air.' },
  'w6-06': { name: 'Galata Tower', hint: 'The stone tower is tall and solid. Bring the bomb down on its top; the neighbour is protected.' },
  'w6-07': { name: 'Bosphorus Bridge', hint: 'A car shuttles across the bridge. Drop the bomb on the road and DETONATE as the car comes by.' },
  'w6-08': { name: 'Han Courtyard', hint: "Two wings, a protected fountain between them and a protected watchman's hut on the left. Detonate both bombs above the wings." },
  'w6-09': { name: 'Ferry Pier', hint: 'Drop the bomb beside the barrels. The chain brings the tower down.' },
  'w7-01': { name: 'First Swing', hint: 'FIRE lets the crane go. The ball swings and hits the tower.' },
  'w7-02': { name: 'Cut Loose', hint: 'The kiosk is protected and the tower out of reach. Cut the rope at the right moment and the ball flies.' },
  'w7-03': { name: 'The Wall', hint: 'A brick wall at the bottom of the swing. The ball goes straight through.' },
  'w7-04': { name: 'Two Cranes', hint: 'Two balls from both sides. The tower in the middle cannot hold.' },
  'w7-05': { name: 'Ball and Fuse', hint: 'Concrete columns shrug off the ball. Crack them with a charge first.' },
  'w7-06': { name: 'Chimney', hint: 'Strike the chimney high. The house on the left is protected; the ball passes over it.' },
  'w7-07': { name: 'Over the Top', hint: 'The building in between is protected. Let the ball go as it rises so it clears the roof.' },
  'w7-08': { name: 'Chain', hint: 'The ball hits the barrels on the stand; their blasts bring the depot down.' },
  'w7-09': { name: 'Flying Start', hint: 'Send the ball flying onto the barrels. The chain brings the tower down; the kiosk is protected.' },
  'w7-10': { name: 'Berlin Finale', hint: 'The ball, two charges and a protected neighbour. Think about all of them at once.' },
  'w6-10': { name: 'Istanbul Finale', hint: 'The apartment and the chimney come down together. Fuse on the middle column, bomb on top of the chimney.' },
};

const EN_CITIES: Readonly<Record<string, { readonly city: string; readonly country: string }>> = {
  ankara: { city: 'Ankara', country: 'Türkiye' },
  paris: { city: 'Paris', country: 'France' },
  london: { city: 'London', country: 'United Kingdom' },
  rome: { city: 'Rome', country: 'Italy' },
  tokyo: { city: 'Tokyo', country: 'Japan' },
  istanbul: { city: 'Istanbul', country: 'Türkiye' },
  berlin: { city: 'Berlin', country: 'Germany' },
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
