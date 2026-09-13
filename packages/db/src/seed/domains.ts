import type { DomainKey } from '@saveus/common';

/**
 * Research domains.
 *
 * Adding a domain means adding an entry here and re-running the seed (or
 * inserting the row). The key must also exist in the DomainKey enum in
 * @saveus/common - see README, "How to add a new problem domain".
 */
export interface DomainReference {
  key: DomainKey;
  label: string;
  description: string;
  /** Hue used for the domain marker in the interface. */
  accent: string;
}

export const DOMAIN_REFERENCE: readonly DomainReference[] = [
  {
    key: 'climate',
    label: 'CLIMATE',
    description: 'Greenhouse gases, warming, adaptation and the physical climate system.',
    accent: '#E0803C',
  },
  {
    key: 'energy',
    label: 'ENERGY',
    description: 'Generation, grids, storage, fuels and demand.',
    accent: '#D9B23C',
  },
  {
    key: 'water',
    label: 'WATER',
    description: 'Freshwater supply, quality, sanitation and hydrology.',
    accent: '#3D9BD4',
  },
  {
    key: 'food',
    label: 'FOOD',
    description: 'Agriculture, soils, nutrition, losses and food systems.',
    accent: '#7CA648',
  },
  {
    key: 'biodiversity',
    label: 'BIODIVERSITY',
    description: 'Species, ecosystems, habitat and ecological function.',
    accent: '#4CA97E',
  },
  {
    key: 'health',
    label: 'HEALTH',
    description: 'Disease burden, health systems, exposure and public health.',
    accent: '#C8556B',
  },
  {
    key: 'materials',
    label: 'MATERIALS',
    description: 'Industrial materials, chemistry, circularity and supply.',
    accent: '#9B8BC4',
  },
  {
    key: 'cities',
    label: 'CITIES',
    description: 'Urban form, buildings, infrastructure and municipal capacity.',
    accent: '#7E8EA8',
  },
  {
    key: 'transport',
    label: 'TRANSPORT',
    description: 'Mobility, freight, aviation, shipping and road safety.',
    accent: '#5FA8A0',
  },
  {
    key: 'ai',
    label: 'AI',
    description: 'Machine intelligence as a research instrument and as a problem in itself.',
    accent: '#B0B7BF',
  },
  {
    key: 'other',
    label: 'OTHER',
    description: 'Cross-cutting problems that do not sit inside one domain.',
    accent: '#6E7681',
  },
];
