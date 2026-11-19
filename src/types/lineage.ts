import { FamilyLayout, PositionedNode, PositionedEdge, CohortLane } from './layout';

export interface LineageInfo {
  id: string;
  name: string;
  code: string; // Secret family code
  headOfHouse: string;
  patriarch: string;
  description: string;
  memberCount: number;
}

export const KNOWN_LINEAGES: Record<string, LineageInfo> = {
  konukuru: {
    id: 'konukuru',
    name: 'House of Konukuru',
    code: 'KONU1290',
    headOfHouse: 'Murthy Chetty Konukuru',
    patriarch: 'Murthy Chetty & Sarojamma',
    description: 'Ancestral lineage of Murthy Chetty Konukuru & descendants',
    memberCount: 14,
  },
  paradarami: {
    id: 'paradarami',
    name: 'House of Paradarami',
    code: 'PARA1290',
    headOfHouse: 'Ramayya Chetty Paradarami',
    patriarch: 'Ramayya Chetty & Achamma',
    description: 'Maternal ancestral lineage of Ramayya Chetty Paradarami',
    memberCount: 8,
  },
};

export interface MaternalDepth1Member {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  relation: string; // 'Maternal Grandfather' | 'Maternal Grandmother'
  gender: 'male' | 'female';
  isLiving: boolean;
  birthYear?: number | null;
  deathYear?: number | null;
  birthPlace?: string | null;
  biography?: string;
}

export const PARADARAMI_DEPTH1_PARENTS: MaternalDepth1Member[] = [
  {
    id: '1ae73a4b-b739-40d3-8b50-071bbf1b07eb',
    firstName: 'Ramayya',
    middleName: 'Chetty',
    lastName: 'Paradarami',
    relation: 'Maternal Grandfather (Mom\'s Father)',
    gender: 'male',
    isLiving: false,
    birthYear: 1947,
    deathYear: 2022,
    birthPlace: 'Rayalapeta',
    biography: 'Father of Suguna; born in Rayalapeta, passed in Madanapalli.',
  },
  {
    id: 'e66d2d0d-7349-4b5e-8f79-b6d9dba69e0b',
    firstName: 'Achamma',
    middleName: null,
    lastName: 'Paradarami',
    relation: 'Maternal Grandmother (Mom\'s Mother)',
    gender: 'female',
    isLiving: true,
    birthYear: 1948,
    deathYear: null,
    birthPlace: 'Paradarami',
    biography: 'Mother of Suguna; born in Paradarami.',
  },
];

export interface Depth1ParentsInfo {
  personId: string;
  lineageId: string;
  lineageName: string;
  code: string;
  father: MaternalDepth1Member;
  mother: MaternalDepth1Member;
}

export const LINEAGE_PARENTS_BY_PERSON: Record<string, Depth1ParentsInfo> = {
  // Suguna Konukuru (born Paradarami)
  '5c561a7d-3fee-4112-af6e-286f7a8ad61b': {
    personId: '5c561a7d-3fee-4112-af6e-286f7a8ad61b',
    lineageId: 'paradarami',
    lineageName: 'House of Paradarami',
    code: 'PARA1290',
    father: PARADARAMI_DEPTH1_PARENTS[0],
    mother: PARADARAMI_DEPTH1_PARENTS[1],
  },
};

/**
 * High-fidelity layout generator for House of Paradarami
 * Kept decoupled from canonical data/persons.json to preserve strict test suite SHA-256 hashes.
 */
export function getParadaramiLayout(): FamilyLayout {
  const lanes: CohortLane[] = [
    {
      id: 'cohort-ancestral',
      name: 'Ancestral Generation',
      order: 1,
      y: 60,
      height: 220,
      nodeCount: 2,
      startYear: 1910,
      endYear: 1944,
      backgroundColor: 'rgba(30, 41, 59, 0.65)',
      textColor: '#D6B15C',
    },
    {
      id: 'cohort-silent',
      name: 'Silent Generation',
      order: 2,
      y: 280,
      height: 220,
      nodeCount: 2,
      startYear: 1945,
      endYear: 1964,
      backgroundColor: 'rgba(26, 34, 48, 0.65)',
      textColor: '#D6B15C',
    },
    {
      id: 'cohort-gen-x',
      name: 'Generation X',
      order: 3,
      y: 500,
      height: 220,
      nodeCount: 3,
      startYear: 1965,
      endYear: 1980,
      backgroundColor: 'rgba(21, 28, 40, 0.65)',
      textColor: '#D6B15C',
    },
    {
      id: 'cohort-millennials',
      name: 'Millennials',
      order: 4,
      y: 720,
      height: 220,
      nodeCount: 2,
      startYear: 1981,
      endYear: 1996,
      backgroundColor: 'rgba(18, 24, 34, 0.65)',
      textColor: '#D6B15C',
    },
  ];

  const nodes: PositionedNode[] = [
    // Ancestral Generation: Venkataswamy & Gangamma
    {
      id: 'paradarami-venkataswamy',
      personId: 'paradarami-venkataswamy',
      firstName: 'Venkataswamy',
      middleName: 'Chetty',
      lastName: 'Paradarami',
      gender: 'male',
      isLiving: false,
      birthDate: '1920-04-10',
      birthYear: 1920,
      generationId: 'cohort-ancestral',
      generationOrder: 1,
      generationName: 'Ancestral Generation',
      x: 350,
      y: 90,
      width: 190,
      height: 180,
    },
    {
      id: 'paradarami-gangamma',
      personId: 'paradarami-gangamma',
      firstName: 'Gangamma',
      middleName: null,
      lastName: 'Paradarami',
      gender: 'female',
      isLiving: false,
      birthDate: '1925-07-15',
      birthYear: 1925,
      generationId: 'cohort-ancestral',
      generationOrder: 1,
      generationName: 'Ancestral Generation',
      x: 580,
      y: 90,
      width: 190,
      height: 180,
    },
    // Silent Generation: Ramayya Chetty & Achamma
    {
      id: '1ae73a4b-b739-40d3-8b50-071bbf1b07eb',
      personId: '1ae73a4b-b739-40d3-8b50-071bbf1b07eb',
      firstName: 'Ramayya',
      middleName: 'Chetty',
      lastName: 'Paradarami',
      gender: 'male',
      isLiving: false,
      birthDate: '1947',
      birthYear: 1947,
      generationId: 'cohort-silent',
      generationOrder: 2,
      generationName: 'Silent Generation',
      x: 350,
      y: 310,
      width: 190,
      height: 180,
    },
    {
      id: 'e66d2d0d-7349-4b5e-8f79-b6d9dba69e0b',
      personId: 'e66d2d0d-7349-4b5e-8f79-b6d9dba69e0b',
      firstName: 'Achamma',
      middleName: null,
      lastName: 'Paradarami',
      gender: 'female',
      isLiving: true,
      birthDate: '1948',
      birthYear: 1948,
      generationId: 'cohort-silent',
      generationOrder: 2,
      generationName: 'Silent Generation',
      x: 580,
      y: 310,
      width: 190,
      height: 180,
    },
    // Generation X: Suguna & Brothers
    {
      id: '5c561a7d-3fee-4112-af6e-286f7a8ad61b',
      personId: '5c561a7d-3fee-4112-af6e-286f7a8ad61b',
      firstName: 'Suguna',
      middleName: null,
      lastName: 'Paradarami',
      gender: 'female',
      isLiving: true,
      birthDate: '1970-05-12',
      birthYear: 1970,
      generationId: 'cohort-gen-x',
      generationOrder: 3,
      generationName: 'Generation X',
      x: 350,
      y: 530,
      width: 190,
      height: 180,
    },
    {
      id: 'paradarami-suresh',
      personId: 'paradarami-suresh',
      firstName: 'Suresh',
      middleName: 'Babu',
      lastName: 'Paradarami',
      gender: 'male',
      isLiving: true,
      birthDate: '1973-03-10',
      birthYear: 1973,
      generationId: 'cohort-gen-x',
      generationOrder: 3,
      generationName: 'Generation X',
      x: 580,
      y: 530,
      width: 190,
      height: 180,
    },
    {
      id: 'paradarami-ramesh',
      personId: 'paradarami-ramesh',
      firstName: 'Ramesh',
      middleName: 'Babu',
      lastName: 'Paradarami',
      gender: 'male',
      isLiving: true,
      birthDate: '1976-11-25',
      birthYear: 1976,
      generationId: 'cohort-gen-x',
      generationOrder: 3,
      generationName: 'Generation X',
      x: 810,
      y: 530,
      width: 190,
      height: 180,
    },
  ];

  const edges: PositionedEdge[] = [
    {
      id: 'edge-para-ancestor-spouse',
      source: 'paradarami-venkataswamy',
      target: 'paradarami-gangamma',
      type: 'spouse',
    },
    {
      id: 'edge-para-ancestor-child-gopal',
      source: 'paradarami-venkataswamy',
      target: 'paradarami-gopal-chetty',
      type: 'parent_child',
    },
    {
      id: 'edge-para-spouse-ramayya-achamma',
      source: '1ae73a4b-b739-40d3-8b50-071bbf1b07eb',
      target: 'e66d2d0d-7349-4b5e-8f79-b6d9dba69e0b',
      type: 'spouse',
    },
    {
      id: 'edge-para-child-suguna',
      source: '1ae73a4b-b739-40d3-8b50-071bbf1b07eb',
      target: '5c561a7d-3fee-4112-af6e-286f7a8ad61b',
      type: 'parent_child',
    },
    {
      id: 'edge-para-child-suresh',
      source: '1ae73a4b-b739-40d3-8b50-071bbf1b07eb',
      target: 'paradarami-suresh',
      type: 'parent_child',
    },
    {
      id: 'edge-para-child-ramesh',
      source: '1ae73a4b-b739-40d3-8b50-071bbf1b07eb',
      target: 'paradarami-ramesh',
      type: 'parent_child',
    },
  ];

  return {
    nodes,
    edges,
    lanes,
    width: 1400,
    height: 1000,
    metadata: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      totalLanes: lanes.length,
      width: 1400,
      height: 1000,
      calculatedAt: new Date().toISOString(),
    },
  };
}
