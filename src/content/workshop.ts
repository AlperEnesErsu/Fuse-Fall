import type { ShopItem } from '../core/economy';
import { DEFAULT_BLAST_STYLE, DEFAULT_BLOCK_THEME } from '../core/progress';
import type { Language } from '../presentation/strings';
import { SANDBOX_TEMPLATES } from './sandbox';

/**
 * The workshop catalogue: what scrap buys. Everything here is cosmetic or a
 * Free Site extra; nothing changes how a campaign job plays, so every mission
 * stays solvable with what a new player has.
 */

type Text = Readonly<Record<Language, string>>;

/** Blast styles and block themes are looks one of which is in use; structures are simply owned. */
export type WorkshopKind = 'blast-style' | 'block-theme' | 'structure';

export interface WorkshopItem extends ShopItem {
  readonly kind: WorkshopKind;
  readonly name: Text;
  readonly description: Text;
  /** A city's own look: on sale once that city (its world number) is open. */
  readonly city?: number;
}

/** Blast styles: the look of fire, smoke and sparks. Their colours live with the effects. */
const BLAST_STYLES: readonly WorkshopItem[] = [
  {
    id: DEFAULT_BLAST_STYLE,
    kind: 'blast-style',
    cost: 0,
    name: { tr: 'Klasik', en: 'Classic' },
    description: { tr: 'Turuncu ateş, kara duman.', en: 'Orange fire, black smoke.' },
  },
  {
    id: 'thermite',
    kind: 'blast-style',
    cost: 300,
    name: { tr: 'Termit', en: 'Thermite' },
    description: { tr: 'Beyaz sıcak alev, yeşil kıvılcımlar.', en: 'White-hot flame, green sparks.' },
  },
  {
    id: 'rose',
    kind: 'blast-style',
    cost: 400,
    name: { tr: 'Pembe Duman', en: 'Pink Smoke' },
    description: { tr: 'Gösteri patlaması: pembe duman bulutu.', en: 'Show blast: a cloud of pink smoke.' },
  },
  {
    id: 'neon',
    kind: 'blast-style',
    cost: 600,
    name: { tr: 'Neon', en: 'Neon' },
    description: { tr: 'Camgöbeği ateş, mor duman.', en: 'Cyan fire, violet smoke.' },
  },
  {
    id: 'confetti',
    kind: 'blast-style',
    cost: 900,
    name: { tr: 'Konfeti', en: 'Confetti' },
    description: { tr: 'Her patlamada renkli konfeti yağmuru.', en: 'A shower of coloured confetti with every blast.' },
  },
  {
    id: 'lightning',
    kind: 'blast-style',
    cost: 500,
    name: { tr: 'Elektrik Arkı', en: 'Electric Arc' },
    description: { tr: 'Mavi-beyaz elektrik, lacivert duman.', en: 'Blue-white electric flash, navy smoke.' },
  },
  {
    id: 'gold',
    kind: 'blast-style',
    cost: 750,
    name: { tr: 'Altın Toz', en: 'Gold Dust' },
    description: { tr: 'Sıcak altın alev ve her patlamada altın toz.', en: 'Warm gold flame and gold dust with every blast.' },
  },
];

/** Block themes: the surface every structure is drawn with. Physics is unchanged. */
const BLOCK_THEMES: readonly WorkshopItem[] = [
  {
    id: DEFAULT_BLOCK_THEME,
    kind: 'block-theme',
    cost: 0,
    name: { tr: 'Gerçek Malzeme', en: 'Real Materials' },
    description: { tr: 'Ahşap, tuğla, beton ve çelik.', en: 'Timber, brick, concrete and steel.' },
  },
  {
    id: 'theme:cardboard',
    kind: 'block-theme',
    cost: 350,
    name: { tr: 'Karton Şehir', en: 'Cardboard City' },
    description: { tr: 'Oluklu mukavva ve koli bandı.', en: 'Corrugated card and packing tape.' },
  },
  {
    id: 'theme:ice',
    kind: 'block-theme',
    cost: 550,
    name: { tr: 'Buz Kuleleri', en: 'Ice Towers' },
    description: { tr: 'Işığı geçiren buz blokları.', en: 'Blocks of glassy ice.' },
  },
];

/**
 * Each city brings its own set: a blast style and a block theme, on sale once
 * the city opens. Prices rise city by city, so scrap keeps a use to the end of
 * the campaign (and past it) instead of running out of things to buy halfway.
 */
const CITY_SETS: readonly { readonly world: number; readonly key: string; readonly style: Omit<WorkshopItem, 'id' | 'kind' | 'cost'>; readonly theme: Omit<WorkshopItem, 'id' | 'kind' | 'cost'> }[] = [
  {
    world: 1,
    key: 'ankara',
    style: { name: { tr: 'Al Bayrak', en: 'Red Banner' }, description: { tr: 'Kırmızı alev, beyaz kıvılcım.', en: 'Red flame, white sparks.' } },
    theme: { name: { tr: 'Ankara Taşı', en: 'Ankara Stone' }, description: { tr: 'Pembe andezit bloklar.', en: 'Rose andesite blocks.' } },
  },
  {
    world: 2,
    key: 'paris',
    style: { name: { tr: 'Üç Renk', en: 'Tricolour' }, description: { tr: 'Mavi, beyaz, kırmızı konfeti.', en: 'Blue, white and red confetti.' } },
    theme: { name: { tr: 'Haussmann', en: 'Haussmann' }, description: { tr: 'Krem kireçtaşı cepheler.', en: 'Cream limestone fronts.' } },
  },
  {
    world: 3,
    key: 'london',
    style: { name: { tr: 'Londra Sisi', en: 'London Fog' }, description: { tr: 'Fener sarısı ışık, gri sis.', en: 'Lamp-yellow glow, grey fog.' } },
    theme: { name: { tr: 'Sarı Tuğla', en: 'London Stock' }, description: { tr: 'Londra’nın sarı tuğlaları.', en: 'Yellow London stock brick.' } },
  },
  {
    world: 4,
    key: 'rome',
    style: { name: { tr: 'Vezüv', en: 'Vesuvius' }, description: { tr: 'Koyu kırmızı lav, kara kül.', en: 'Deep red lava, black ash.' } },
    theme: { name: { tr: 'Mermer', en: 'Marble' }, description: { tr: 'Damarlı beyaz mermer.', en: 'Veined white marble.' } },
  },
  {
    world: 5,
    key: 'tokyo',
    style: { name: { tr: 'Sakura', en: 'Sakura' }, description: { tr: 'Pembe çiçek yaprağı yağmuru.', en: 'A shower of pink petals.' } },
    theme: { name: { tr: 'Lake', en: 'Lacquer' }, description: { tr: 'Parlak kırmızı ve siyah lake.', en: 'Glossy red and black lacquer.' } },
  },
  {
    world: 6,
    key: 'istanbul',
    style: { name: { tr: 'Lale', en: 'Tulip' }, description: { tr: 'Kırmızı ve sarı lale ateşi.', en: 'Red and yellow tulip fire.' } },
    theme: { name: { tr: 'Çini', en: 'Iznik Tile' }, description: { tr: 'Turkuaz İznik çinileri.', en: 'Turquoise Iznik tiles.' } },
  },
  {
    world: 7,
    key: 'berlin',
    style: { name: { tr: 'Tekno', en: 'Techno' }, description: { tr: 'Macenta ışık, kara duman.', en: 'Magenta light, black smoke.' } },
    theme: { name: { tr: 'Grafiti', en: 'Graffiti' }, description: { tr: 'Spreyle boyanmış beton.', en: 'Concrete in spray paint.' } },
  },
  {
    world: 8,
    key: 'madrid',
    style: { name: { tr: 'Flamenko', en: 'Flamenco' }, description: { tr: 'Kırmızı ve altın alev.', en: 'Red and gold flame.' } },
    theme: { name: { tr: 'Pişmiş Toprak', en: 'Terracotta' }, description: { tr: 'Sıcak terrakota.', en: 'Warm terracotta.' } },
  },
  {
    world: 9,
    key: 'newyork',
    style: { name: { tr: 'Times Meydanı', en: 'Times Square' }, description: { tr: 'Neon sarı, pembe ve mavi.', en: 'Neon yellow, pink and blue.' } },
    theme: { name: { tr: 'Kahverengi Taş', en: 'Brownstone' }, description: { tr: 'New York’un brownstone cepheleri.', en: 'New York brownstone fronts.' } },
  },
];

/** A city set's blast style id, e.g. `city-paris`. */
export const cityStyleId = (key: string): string => `city-${key}`;
/** A city set's block theme id, e.g. `theme:paris`. */
export const cityThemeId = (key: string): string => `theme:${key}`;

const CITY_ITEMS: readonly WorkshopItem[] = CITY_SETS.flatMap((s) => [
  { id: cityStyleId(s.key), kind: 'blast-style' as const, cost: 300 + 75 * (s.world - 1), city: s.world, ...s.style },
  { id: cityThemeId(s.key), kind: 'block-theme' as const, cost: 500 + 100 * (s.world - 1), city: s.world, ...s.theme },
]);

/** Whether an item is on sale: a city's set waits for that city to open. */
export const onSale = (item: WorkshopItem, cityOpen: (world: number) => boolean): boolean => item.city === undefined || cityOpen(item.city);

/** The first Free Site structures are open to everyone; the rest are bought. */
const STRUCTURE_COST: Readonly<Record<string, number>> = {
  bridge: 200,
  'glass-tower': 250,
  depot: 350,
  'steel-frame': 450,
  'wrecking-ball': 300,
};

export const structureItemId = (templateId: string): string => `structure:${templateId}`;

const STRUCTURES: readonly WorkshopItem[] = SANDBOX_TEMPLATES.map((t) => ({
  id: structureItemId(t.id),
  kind: 'structure',
  cost: STRUCTURE_COST[t.id] ?? 0,
  name: t.name,
  description: { tr: 'Serbest Şantiye yapısı', en: 'Free Site structure' },
}));

export const WORKSHOP: readonly WorkshopItem[] = [
  ...BLAST_STYLES,
  ...CITY_ITEMS.filter((i) => i.kind === 'blast-style'),
  ...BLOCK_THEMES,
  ...CITY_ITEMS.filter((i) => i.kind === 'block-theme'),
  ...STRUCTURES,
];

/** Free items are everyone's from the start. */
export const isOwned = (owned: readonly string[], item: WorkshopItem): boolean => item.cost === 0 || owned.includes(item.id);

export const workshopItem = (id: string): WorkshopItem | undefined => WORKSHOP.find((i) => i.id === id);

/** The look to show for a kind: the chosen one if it exists, is of that kind and is owned; otherwise the default. */
export const activeLook = (owned: readonly string[], chosen: string, kind: 'blast-style' | 'block-theme'): string => {
  const item = workshopItem(chosen);
  if (item?.kind === kind && isOwned(owned, item)) return item.id;
  return kind === 'blast-style' ? DEFAULT_BLAST_STYLE : DEFAULT_BLOCK_THEME;
};
