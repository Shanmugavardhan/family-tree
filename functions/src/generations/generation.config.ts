import { Generation } from './generation.types';

/**
 * Standard birth-cohort generation definitions.
 * Configurable and decoupled from genealogical kinship rules.
 */
export const GENERATION_DEFINITIONS: Generation[] = [
  {
    id: 'silent',
    name: 'Silent Generation',
    startYear: 1928,
    endYear: 1945,
    order: 1,
    backgroundColor: '#1A202C',
    textColor: '#F1E9D7',
    description: 'Born 1928–1945',
  },
  {
    id: 'baby_boomers',
    name: 'Baby Boomers',
    startYear: 1946,
    endYear: 1964,
    order: 2,
    backgroundColor: '#183B38',
    textColor: '#F1E9D7',
    description: 'Born 1946–1964',
  },
  {
    id: 'gen_x',
    name: 'Generation X',
    startYear: 1965,
    endYear: 1980,
    order: 3,
    backgroundColor: '#202C43',
    textColor: '#F1E9D7',
    description: 'Born 1965–1980',
  },
  {
    id: 'millennials',
    name: 'Millennials (Gen Y)',
    startYear: 1981,
    endYear: 1996,
    order: 4,
    backgroundColor: '#392A3E',
    textColor: '#F1E9D7',
    description: 'Born 1981–1996',
  },
  {
    id: 'gen_z',
    name: 'Generation Z',
    startYear: 1997,
    endYear: 2012,
    order: 5,
    backgroundColor: '#44372A',
    textColor: '#F1E9D7',
    description: 'Born 1997–2012',
  },
  {
    id: 'gen_alpha',
    name: 'Generation Alpha',
    startYear: 2013,
    endYear: 2024,
    order: 6,
    backgroundColor: '#263B49',
    textColor: '#F1E9D7',
    description: 'Born 2013–2024',
  },
  {
    id: 'gen_beta',
    name: 'Generation Beta',
    startYear: 2025,
    endYear: 2039,
    order: 7,
    backgroundColor: '#2D1E26',
    textColor: '#F1E9D7',
    description: 'Born 2025–2039',
  },
];

