import type { MaterialId } from '../core/materials';

/** Industrial palette: real material colours, hazard amber as the one accent, teal for protected property. */
export const PALETTE = {
  zone: 'rgba(242, 177, 52, 0.14)',
  zoneEdge: '#f2b134',
  accent: '#f2b134',
  target: '#e5484d',
  targetDown: '#7d828a',
  protect: '#3fb6a8',
  barrel: '#b8322f',
  valid: '#4cb36a',
  invalid: '#e5484d',
  fire: '#ff9f1c',
  smoke: '#545a70',
} as const;

export const MATERIAL_COLORS: Readonly<Record<MaterialId, { fill: string; detail: string }>> = {
  wood: { fill: '#b9844f', detail: '#8e6036' },
  glass: { fill: 'rgba(150, 200, 225, 0.7)', detail: 'rgba(235, 248, 255, 0.9)' },
  concrete: { fill: '#8f9399', detail: '#6e7278' },
  metal: { fill: '#5a6672', detail: '#a8b2bc' },
  vehicle: { fill: '#3d6e8f', detail: '#2a4f68' },
};

/** Particle colours per material when it breaks. */
export const DEBRIS_COLORS: Readonly<Record<MaterialId, readonly string[]>> = {
  wood: ['#b9844f', '#8e6036', '#d2a06d'],
  glass: ['#d8f1ff', '#9bd8ff', '#ffffff'],
  concrete: ['#8f9399', '#a7abb1', '#6e7278'],
  metal: ['#a8b2bc', '#5a6672'],
  vehicle: ['#3d6e8f', '#3b3b46', '#f2b134'],
};
