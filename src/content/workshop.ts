import type { ShopItem } from '../core/economy';
import { DEFAULT_BLAST_STYLE } from '../core/progress';
import type { Language } from '../presentation/strings';
import { SANDBOX_TEMPLATES } from './sandbox';

/**
 * The workshop catalogue: what scrap buys. Everything here is cosmetic or a
 * Free Site extra; nothing changes how a campaign job plays, so every mission
 * stays solvable with what a new player has.
 */

type Text = Readonly<Record<Language, string>>;

export interface WorkshopItem extends ShopItem {
  readonly kind: 'blast-style' | 'structure';
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

/** The first Free Site structures are open to everyone; the rest are bought. */
const STRUCTURE_COST: Readonly<Record<string, number>> = {
  bridge: 200,
  'glass-tower': 250,
  depot: 350,
  'steel-frame': 450,
};

export const structureItemId = (templateId: string): string => `structure:${templateId}`;

const STRUCTURES: readonly WorkshopItem[] = SANDBOX_TEMPLATES.map((t) => ({
  id: structureItemId(t.id),
  kind: 'structure',
  cost: STRUCTURE_COST[t.id] ?? 0,
  name: t.name,
  description: { tr: 'Serbest Şantiye yapısı', en: 'Free Site structure' },
}));

export const WORKSHOP: readonly WorkshopItem[] = [...BLAST_STYLES, ...STRUCTURES];

/** Free items are everyone's from the start. */
export const isOwned = (owned: readonly string[], item: WorkshopItem): boolean => item.cost === 0 || owned.includes(item.id);

export const workshopItem = (id: string): WorkshopItem | undefined => WORKSHOP.find((i) => i.id === id);

/** The style to show: the chosen one if it exists and is owned, otherwise the default. */
export const activeBlastStyle = (owned: readonly string[], chosen: string): string => {
  const item = workshopItem(chosen);
  return item?.kind === 'blast-style' && isOwned(owned, item) ? item.id : DEFAULT_BLAST_STYLE;
};
