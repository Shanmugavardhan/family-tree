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
    memberCount: 10,
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
  // Suguna Konukuru (born Paradarami) -> Parents: Ramayya Chetty & Achamma Paradarami
  '5c561a7d-3fee-4112-af6e-286f7a8ad61b': {
    personId: '5c561a7d-3fee-4112-af6e-286f7a8ad61b',
    lineageId: 'paradarami',
    lineageName: 'House of Paradarami',
    code: 'PARA1290',
    father: PARADARAMI_DEPTH1_PARENTS[0],
    mother: PARADARAMI_DEPTH1_PARENTS[1],
  },
  // Jagannadham Konukuru (Suguna's husband, born Konukuru) -> Parents: Murthy Chetty & Sarojamma Konukuru
  'b19dee44-9906-4c46-84b6-70d2fa70a5b5': {
    personId: 'b19dee44-9906-4c46-84b6-70d2fa70a5b5',
    lineageId: 'konukuru',
    lineageName: 'House of Konukuru',
    code: 'KONU1290',
    father: {
      id: '867842c1-b8a2-45ad-8d9c-89150e68eb16',
      firstName: 'Murthy',
      middleName: 'Chetty',
      lastName: 'Konukuru',
      relation: 'Paternal Grandfather (Father)',
      gender: 'male',
      isLiving: false,
      birthYear: null,
      deathYear: 2009,
      birthPlace: 'Gangupalli',
      biography: 'Came to town (Tirupati) in his early marriage age with the children and started a small door-to-door milk delivery business.',
    },
    mother: {
      id: '4a80001b-76bf-4e13-963b-89b2aafbb413',
      firstName: 'Sarojamma',
      middleName: null,
      lastName: 'Konukuru',
      relation: 'Paternal Grandmother (Mother)',
      gender: 'female',
      isLiving: false,
      birthYear: null,
      deathYear: null,
      birthPlace: 'Samsireddypalli',
      biography: 'Homemaker; after her husband\'s death, worked in the local market as a vegetable seller.',
    },
  },
};

/**
 * Clean layout generator for House of Paradarami containing only verified database members.
 * Free of any sample/demo data.
 */
export function getParadaramiLayout(): FamilyLayout {
  const lanes: CohortLane[] = [
    {
      id: 'cohort-silent',
      name: 'Silent Generation',
      order: 1,
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
      order: 2,
      y: 500,
      height: 220,
      nodeCount: 3,
      startYear: 1965,
      endYear: 1980,
      backgroundColor: 'rgba(21, 28, 40, 0.65)',
      textColor: '#D6B15C',
    },
  ];

  const nodes: PositionedNode[] = [
    // Silent Generation: Ramayya Chetty & Achamma Paradarami
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
      generationOrder: 1,
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
      generationOrder: 1,
      generationName: 'Silent Generation',
      x: 580,
      y: 310,
      width: 190,
      height: 180,
    },
    // Generation X: Suguna Konukuru (daughter), Jagannadham Konukuru (Suguna's husband), Rada Galeti (daughter)
    {
      id: '5c561a7d-3fee-4112-af6e-286f7a8ad61b',
      personId: '5c561a7d-3fee-4112-af6e-286f7a8ad61b',
      firstName: 'Suguna',
      middleName: null,
      lastName: 'Konukuru',
      gender: 'female',
      isLiving: true,
      birthDate: null,
      birthYear: 1970,
      generationId: 'cohort-gen-x',
      generationOrder: 2,
      generationName: 'Generation X',
      x: 350,
      y: 530,
      width: 190,
      height: 180,
    },
    {
      id: 'b19dee44-9906-4c46-84b6-70d2fa70a5b5',
      personId: 'b19dee44-9906-4c46-84b6-70d2fa70a5b5',
      firstName: 'Jagannadham',
      middleName: null,
      lastName: 'Konukuru',
      gender: 'male',
      isLiving: true,
      birthDate: '1972-10-16',
      birthYear: 1972,
      generationId: 'cohort-gen-x',
      generationOrder: 2,
      generationName: 'Generation X',
      x: 580,
      y: 530,
      width: 190,
      height: 180,
      hasExternalLineage: true,
      externalLineage: {
        father: {
          id: '867842c1-b8a2-45ad-8d9c-89150e68eb16',
          firstName: 'Murthy',
          middleName: 'Chetty',
          lastName: 'Konukuru',
          gender: 'male',
          isLiving: false,
          birthYear: null,
          deathYear: 2009,
          birthPlace: 'Gangupalli',
          biography: 'Came to town (Tirupati) in his early marriage age with the children and started a small door-to-door milk delivery business.',
          relation: 'Father',
        },
        mother: {
          id: '4a80001b-76bf-4e13-963b-89b2aafbb413',
          firstName: 'Sarojamma',
          middleName: null,
          lastName: 'Konukuru',
          gender: 'female',
          isLiving: false,
          birthYear: null,
          deathYear: null,
          birthPlace: 'Samsireddypalli',
          biography: 'Homemaker; after her husband\'s death, worked in the local market as a vegetable seller.',
          relation: 'Mother',
        },
        lineageName: 'House of Konukuru',
        lineageId: 'konukuru',
      },
    },
    {
      id: 'fd26db0a-7e43-47d8-bb1c-55b1b84026c2',
      personId: 'fd26db0a-7e43-47d8-bb1c-55b1b84026c2',
      firstName: 'Rada',
      middleName: null,
      lastName: 'Galeti',
      gender: 'female',
      isLiving: true,
      birthDate: null,
      birthYear: 1974,
      generationId: 'cohort-gen-x',
      generationOrder: 2,
      generationName: 'Generation X',
      x: 810,
      y: 530,
      width: 190,
      height: 180,
    },
  ];

  const edges: PositionedEdge[] = [
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
      id: 'edge-para-child-rada',
      source: '1ae73a4b-b739-40d3-8b50-071bbf1b07eb',
      target: 'fd26db0a-7e43-47d8-bb1c-55b1b84026c2',
      type: 'parent_child',
    },
    {
      id: 'edge-para-spouse-suguna-jagannadham',
      source: '5c561a7d-3fee-4112-af6e-286f7a8ad61b',
      target: 'b19dee44-9906-4c46-84b6-70d2fa70a5b5',
      type: 'spouse',
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
