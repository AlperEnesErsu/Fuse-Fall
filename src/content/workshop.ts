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

export const WORKSHOP: readonly WorkshopItem[] = [...BLAST_STYLES, ...BLOCK_THEMES, ...STRUCTURES];

/** Free items are everyone's from the start. */
export const isOwned = (owned: readonly string[], item: WorkshopItem): boolean => item.cost === 0 || owned.includes(item.id);

export const workshopItem = (id: string): WorkshopItem | undefined => WORKSHOP.find((i) => i.id === id);

/** The look to show for a kind: the chosen one if it exists, is of that kind and is owned; otherwise the default. */
export const activeLook = (owned: readonly string[], chosen: string, kind: 'blast-style' | 'block-theme'): string => {
  const item = workshopItem(chosen);
  if (item?.kind === kind && isOwned(owned, item)) return item.id;
  return kind === 'blast-style' ? DEFAULT_BLAST_STYLE : DEFAULT_BLOCK_THEME;
};
