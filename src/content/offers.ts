/**
 * Scrap packs, by store product id. Prices are the store's; only the scrap
 * each pack credits is decided here. Scrap buys looks and Free Site extras,
 * never an easier job.
 */
export const SCRAP_PACKS: readonly { readonly id: string; readonly scrap: number }[] = [
  { id: 'scrap_small', scrap: 500 },
  { id: 'scrap_medium', scrap: 1500 },
  { id: 'scrap_large', scrap: 4000 },
];
