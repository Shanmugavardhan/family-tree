/**
 * Comprehensive Kinship Auto-Inference & Lineage Analysis Engine
 *
 * Implements 7 Core Kinship Upgrades:
 * 1. Sibling Auto-Discovery & Instant Linking
 * 2. Generational Epoch & Birth Year Estimation
 * 3. Biological & Chronological Sanity Checks (Temporal Anomaly & Cycle Safeguards)
 * 4. Surname & House Name Inheritance Heuristics
 * 5. Remarriage & Multi-Spouse Disambiguation
 * 6. Deep Kinship Nomenclature (Traditional Indian / Telugu & Exact English Relative Titles)
 * 7. Cascading Batch Linking ("Connect Entire Nuclear Family")
 */

export interface KinshipNode {
  id: string;
  firstName?: string;
  middleName?: string | null;
  lastName?: string | null;
  gender?: string;
  birthDate?: string | null;
  birthYear?: number | null;
  deathDate?: string | null;
  deathYear?: number | null;
  isLiving?: boolean;
}

export interface KinshipEdge {
  id?: string;
  source: string;
  target: string;
  type: string; // 'parent' | 'spouse' | 'child'
}

export interface DuplicateMemberMatch {
  id: string;
  fullName: string;
  birthYear?: number | null;
  birthDate?: string | null;
  gender?: string;
}

export interface KinshipMemberSummary {
  id: string;
  fullName: string;
  birthYear?: number | null;
  gender?: string;
}

// --------------------------------------------------------------------------
// 1. DUPLICATE DETECTION (Requirement 1)
// --------------------------------------------------------------------------

export function findDuplicateLineageMembers(
  firstName: string,
  lastName: string,
  nodes: KinshipNode[],
  excludeId?: string
): DuplicateMemberMatch[] {
  const fQuery = firstName.trim().toLowerCase();
  const lQuery = lastName.trim().toLowerCase();

  if (!fQuery) return [];

  const matches: DuplicateMemberMatch[] = [];

  for (const node of nodes) {
    if (excludeId && (node.id === excludeId || (node as any).personId === excludeId)) {
      continue;
    }

    const nFirst = (node.firstName || '').trim().toLowerCase();
    const nLast = (node.lastName || '').trim().toLowerCase();

    const isBothMatch = fQuery.length > 0 && lQuery.length > 0 && nFirst === fQuery && nLast === lQuery;
    const isFirstMatch = fQuery.length > 1 && !lQuery && nFirst === fQuery;

    if (isBothMatch || isFirstMatch) {
      const fullName = [node.firstName, node.middleName, node.lastName].filter(Boolean).join(' ');
      matches.push({
        id: node.id,
        fullName,
        birthYear: node.birthYear,
        birthDate: node.birthDate,
        gender: node.gender,
      });
    }
  }

  return matches;
}

// --------------------------------------------------------------------------
// 2. SIBLING AUTO-DISCOVERY (Upgrade 1)
// --------------------------------------------------------------------------

export interface SiblingDiscoveryResult {
  fullSiblings: KinshipMemberSummary[];
  halfSiblings: Array<KinshipMemberSummary & { sharedParent: 'father' | 'mother' }>;
  summaryText: string | null;
}

export function discoverSiblings(
  fatherId: string | null | undefined,
  motherId: string | null | undefined,
  currentPersonId: string | null | undefined,
  nodes: KinshipNode[],
  edges: KinshipEdge[]
): SiblingDiscoveryResult {
  if (!fatherId && !motherId) {
    return { fullSiblings: [], halfSiblings: [], summaryText: null };
  }

  const nodeMap = new Map<string, KinshipNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
    if ((n as any).personId) nodeMap.set((n as any).personId, n);
  }

  // Children of father
  const fatherChildIds = new Set<string>();
  if (fatherId) {
    for (const e of edges) {
      if (e.type === 'parent' && e.source === fatherId) {
        fatherChildIds.add(e.target);
      }
    }
  }

  // Children of mother
  const motherChildIds = new Set<string>();
  if (motherId) {
    for (const e of edges) {
      if (e.type === 'parent' && e.source === motherId) {
        motherChildIds.add(e.target);
      }
    }
  }

  const fullSiblings: KinshipMemberSummary[] = [];
  const halfSiblings: Array<KinshipMemberSummary & { sharedParent: 'father' | 'mother' }> = [];

  const seenIds = new Set<string>();

  // Full siblings: child of both father & mother
  if (fatherId && motherId) {
    for (const cId of fatherChildIds) {
      if (motherChildIds.has(cId) && cId !== currentPersonId) {
        seenIds.add(cId);
        const node = nodeMap.get(cId);
        if (node) {
          fullSiblings.push({
            id: node.id,
            fullName: [node.firstName, node.middleName, node.lastName].filter(Boolean).join(' '),
            birthYear: node.birthYear,
            gender: node.gender,
          });
        }
      }
    }
  }

  // Half siblings
  if (fatherId) {
    for (const cId of fatherChildIds) {
      if (!seenIds.has(cId) && cId !== currentPersonId) {
        seenIds.add(cId);
        const node = nodeMap.get(cId);
        if (node) {
          halfSiblings.push({
            id: node.id,
            fullName: [node.firstName, node.middleName, node.lastName].filter(Boolean).join(' '),
            birthYear: node.birthYear,
            gender: node.gender,
            sharedParent: 'father',
          });
        }
      }
    }
  }

  if (motherId) {
    for (const cId of motherChildIds) {
      if (!seenIds.has(cId) && cId !== currentPersonId) {
        seenIds.add(cId);
        const node = nodeMap.get(cId);
        if (node) {
          halfSiblings.push({
            id: node.id,
            fullName: [node.firstName, node.middleName, node.lastName].filter(Boolean).join(' '),
            birthYear: node.birthYear,
            gender: node.gender,
            sharedParent: 'mother',
          });
        }
      }
    }
  }

  let summaryText: string | null = null;
  if (fullSiblings.length > 0) {
    const names = fullSiblings.map((s) => s.fullName).slice(0, 3).join(', ');
    const countExtra = fullSiblings.length > 3 ? ` +${fullSiblings.length - 3} more` : '';
    summaryText = `✨ Detected ${fullSiblings.length} sibling${fullSiblings.length > 1 ? 's' : ''}: ${names}${countExtra}`;
  } else if (halfSiblings.length > 0) {
    summaryText = `✨ Detected ${halfSiblings.length} half-sibling${halfSiblings.length > 1 ? 's' : ''}`;
  }

  return { fullSiblings, halfSiblings, summaryText };
}

// --------------------------------------------------------------------------
// 3. GENERATIONAL EPOCH & BIRTH YEAR ESTIMATION (Upgrade 2)
// --------------------------------------------------------------------------

export interface GenerationEstimateResult {
  estimatedBirthYear: number | null;
  estimatedYearRange: string | null;
  generationName: string;
  generationId: string;
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
}

const HISTORICAL_GENERATIONS = [
  { id: 'ancestral_gilded', name: 'Gilded Generation', start: 1843, end: 1859 },
  { id: 'missionary', name: 'Missionary Generation', start: 1860, end: 1882 },
  { id: 'lost', name: 'Lost Generation', start: 1883, end: 1900 },
  { id: 'greatest', name: 'Greatest Generation', start: 1901, end: 1927 },
  { id: 'silent', name: 'Silent Generation', start: 1928, end: 1945 },
  { id: 'baby_boomers', name: 'Baby Boomers', start: 1946, end: 1964 },
  { id: 'gen_x', name: 'Generation X', start: 1965, end: 1980 },
  { id: 'millennials', name: 'Millennials (Gen Y)', start: 1981, end: 1996 },
  { id: 'gen_z', name: 'Generation Z', start: 1997, end: 2012 },
  { id: 'gen_alpha', name: 'Generation Alpha', start: 2013, end: 2024 },
  { id: 'gen_beta', name: 'Generation Beta', start: 2025, end: 2039 },
];

export function estimateBirthYearAndGeneration(params: {
  fatherId?: string | null;
  motherId?: string | null;
  spouseId?: string | null;
  childId?: string | null;
  nodes: KinshipNode[];
}): GenerationEstimateResult | null {
  const { fatherId, motherId, spouseId, childId, nodes } = params;

  const nodeMap = new Map<string, KinshipNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
    if ((n as any).personId) nodeMap.set((n as any).personId, n);
  }

  const parseYear = (val?: string | number | null): number | null => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string' && val.length >= 4) {
      const parsed = parseInt(val.slice(0, 4), 10);
      if (!isNaN(parsed) && parsed > 1700 && parsed < 2100) return parsed;
    }
    return null;
  };

  const fatherYear = parseYear(fatherId ? nodeMap.get(fatherId)?.birthYear || nodeMap.get(fatherId)?.birthDate : null);
  const motherYear = parseYear(motherId ? nodeMap.get(motherId)?.birthYear || nodeMap.get(motherId)?.birthDate : null);
  const spouseYear = parseYear(spouseId ? nodeMap.get(spouseId)?.birthYear || nodeMap.get(spouseId)?.birthDate : null);
  const childYear = parseYear(childId ? nodeMap.get(childId)?.birthYear || nodeMap.get(childId)?.birthDate : null);

  let estYear: number | null = null;
  let range: string | null = null;
  let confidence: 'high' | 'medium' | 'low' = 'low';
  let explanation = '';

  // 1. If spouse birth year is known: usually within +/- 3 years
  if (spouseYear) {
    estYear = spouseYear;
    range = `${spouseYear - 3} – ${spouseYear + 3}`;
    confidence = 'high';
    explanation = `Estimated based on Spouse (born ${spouseYear})`;
  }
  // 2. If both parents are known: average + 28
  else if (fatherYear && motherYear) {
    const avgParent = Math.round((fatherYear + motherYear) / 2);
    estYear = avgParent + 28;
    range = `${avgParent + 22} – ${avgParent + 34}`;
    confidence = 'high';
    explanation = `Estimated based on Parents' average birth year (${avgParent})`;
  }
  // 3. If one parent is known
  else if (fatherYear || motherYear) {
    const parentY = (fatherYear || motherYear)!;
    estYear = parentY + 28;
    range = `${parentY + 22} – ${parentY + 34}`;
    confidence = 'medium';
    explanation = `Estimated based on Parent (born ${parentY})`;
  }
  // 4. If child is known: child - 28
  else if (childYear) {
    estYear = childYear - 28;
    range = `${childYear - 34} – ${childYear - 22}`;
    confidence = 'medium';
    explanation = `Estimated based on Child (born ${childYear})`;
  }

  if (!estYear) return null;

  // Find generation cohort
  let genMatch = HISTORICAL_GENERATIONS.find((g) => estYear! >= g.start && estYear! <= g.end);
  if (!genMatch) {
    genMatch = estYear < 1843
      ? { id: 'ancient', name: 'Ancestral Era', start: 1700, end: 1842 }
      : { id: 'future', name: 'Future Generation', start: 2040, end: 2100 };
  }

  return {
    estimatedBirthYear: estYear,
    estimatedYearRange: range,
    generationName: genMatch.name,
    generationId: genMatch.id,
    confidence,
    explanation,
  };
}

// --------------------------------------------------------------------------
// 4. BIOLOGICAL & CHRONOLOGICAL SANITY CHECKS (Upgrade 3)
// --------------------------------------------------------------------------

export interface ChronologyIssue {
  severity: 'error' | 'warning';
  message: string;
  field: string;
}

/**
 * BFS cycle detection: checks if setting `proposedParentId` as parent of `personId`
 * would cause an ancestor-descendant cycle (person becoming ancestor of their own parent).
 */
export function detectAncestryCycle(
  personId: string | null | undefined,
  proposedParentId: string | null | undefined,
  edges: KinshipEdge[]
): boolean {
  if (!personId || !proposedParentId) return false;
  if (personId === proposedParentId) return true;

  // Traverse descendants of personId. If proposedParentId is encountered, it's a cycle!
  const queue: string[] = [personId];
  const visited = new Set<string>([personId]);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === proposedParentId) return true;

    // Children are targets where source === curr and type === 'parent'
    for (const e of edges) {
      if (e.type === 'parent' && e.source === curr) {
        if (!visited.has(e.target)) {
          visited.add(e.target);
          queue.push(e.target);
        }
      }
    }
  }

  return false;
}

export function validateKinshipChronology(params: {
  subjectBirthDate?: string | null;
  subjectDeathDate?: string | null;
  isLiving?: boolean;
  fatherId?: string | null;
  motherId?: string | null;
  childId?: string | null;
  currentPersonId?: string | null;
  nodes: KinshipNode[];
  edges: KinshipEdge[];
}): ChronologyIssue[] {
  const {
    subjectBirthDate,
    subjectDeathDate,
    isLiving,
    fatherId,
    motherId,
    childId,
    currentPersonId,
    nodes,
    edges,
  } = params;

  const issues: ChronologyIssue[] = [];

  const nodeMap = new Map<string, KinshipNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
    if ((n as any).personId) nodeMap.set((n as any).personId, n);
  }

  const parseYear = (val?: string | number | null): number | null => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string' && val.length >= 4) {
      const parsed = parseInt(val.slice(0, 4), 10);
      if (!isNaN(parsed) && parsed > 1700 && parsed < 2100) return parsed;
    }
    return null;
  };

  const subjectBirthYear = parseYear(subjectBirthDate);
  const subjectDeathYear = parseYear(subjectDeathDate);

  // Check living with death date
  if (isLiving && subjectDeathDate) {
    issues.push({
      severity: 'error',
      message: 'Living member cannot have a date of death.',
      field: 'death_date',
    });
  }

  // Check death before birth
  if (subjectBirthYear && subjectDeathYear && subjectDeathYear < subjectBirthYear) {
    issues.push({
      severity: 'error',
      message: `Date of death (${subjectDeathYear}) cannot precede date of birth (${subjectBirthYear}).`,
      field: 'death_date',
    });
  }

  // 1. Father validations
  if (fatherId) {
    const father = nodeMap.get(fatherId);
    if (father) {
      const fBirth = parseYear(father.birthYear || father.birthDate);
      const fDeath = parseYear(father.deathYear || father.deathDate);

      // Cycle check
      if (detectAncestryCycle(currentPersonId, fatherId, edges)) {
        issues.push({
          severity: 'error',
          message: `Cycle detected: ${father.firstName || 'Father'} is already a descendant in this lineage and cannot be set as Father.`,
          field: 'father',
        });
      }

      if (subjectBirthYear && fBirth) {
        if (subjectBirthYear <= fBirth) {
          issues.push({
            severity: 'error',
            message: `Chronology conflict: Child (born ${subjectBirthYear}) cannot be born before or same year as Father (born ${fBirth}).`,
            field: 'birth_date',
          });
        } else if (subjectBirthYear - fBirth < 13) {
          issues.push({
            severity: 'warning',
            message: `Biological anomaly: Father would be only ${subjectBirthYear - fBirth} years old at child's birth.`,
            field: 'father',
          });
        } else if (subjectBirthYear - fBirth > 75) {
          issues.push({
            severity: 'warning',
            message: `Notice: Father was ${subjectBirthYear - fBirth} years old at child's birth.`,
            field: 'father',
          });
        }
      }

      // Posthumous check (>1 year after father death)
      if (subjectBirthYear && fDeath && subjectBirthYear > fDeath + 1) {
        issues.push({
          severity: 'warning',
          message: `Posthumous anomaly: Child born in ${subjectBirthYear}, more than a year after Father passed away (${fDeath}).`,
          field: 'father',
        });
      }
    }
  }

  // 2. Mother validations
  if (motherId) {
    const mother = nodeMap.get(motherId);
    if (mother) {
      const mBirth = parseYear(mother.birthYear || mother.birthDate);
      const mDeath = parseYear(mother.deathYear || mother.deathDate);

      // Cycle check
      if (detectAncestryCycle(currentPersonId, motherId, edges)) {
        issues.push({
          severity: 'error',
          message: `Cycle detected: ${mother.firstName || 'Mother'} is already a descendant in this lineage and cannot be set as Mother.`,
          field: 'mother',
        });
      }

      if (subjectBirthYear && mBirth) {
        if (subjectBirthYear <= mBirth) {
          issues.push({
            severity: 'error',
            message: `Chronology conflict: Child (born ${subjectBirthYear}) cannot be born before or same year as Mother (born ${mBirth}).`,
            field: 'birth_date',
          });
        } else if (subjectBirthYear - mBirth < 12) {
          issues.push({
            severity: 'warning',
            message: `Biological anomaly: Mother would be only ${subjectBirthYear - mBirth} years old at child's birth.`,
            field: 'mother',
          });
        } else if (subjectBirthYear - mBirth > 55) {
          issues.push({
            severity: 'warning',
            message: `Biological anomaly: Mother would be ${subjectBirthYear - mBirth} years old at child's birth.`,
            field: 'mother',
          });
        }
      }

      // Mother passing before child birth
      if (subjectBirthYear && mDeath && subjectBirthYear > mDeath) {
        issues.push({
          severity: 'error',
          message: `Biological impossibility: Child born in ${subjectBirthYear}, after Mother passed away (${mDeath}).`,
          field: 'mother',
        });
      }
    }
  }

  // 3. Child validations
  if (childId) {
    const child = nodeMap.get(childId);
    if (child) {
      const cBirth = parseYear(child.birthYear || child.birthDate);
      if (subjectBirthYear && cBirth && cBirth <= subjectBirthYear) {
        issues.push({
          severity: 'error',
          message: `Chronology conflict: Child (born ${cBirth}) cannot be older than or same age as parent (born ${subjectBirthYear}).`,
          field: 'child',
        });
      }
    }
  }

  return issues;
}

// --------------------------------------------------------------------------
// 5. SURNAME & HOUSE NAME INHERITANCE (Upgrade 4)
// --------------------------------------------------------------------------

export function inferInheritedSurname(
  fatherId: string | null | undefined,
  currentLastName: string,
  nodes: KinshipNode[]
): { suggestedSurname: string | null; explanation: string | null } {
  if (!fatherId) return { suggestedSurname: null, explanation: null };

  const father = nodes.find((n) => n.id === fatherId || (n as any).personId === fatherId);
  if (!father || !father.lastName) return { suggestedSurname: null, explanation: null };

  const fatherLastName = father.lastName.trim();
  if (!currentLastName.trim() && fatherLastName) {
    return {
      suggestedSurname: fatherLastName,
      explanation: `Inherits family house surname "${fatherLastName}" from Father.`,
    };
  }

  return { suggestedSurname: null, explanation: null };
}

// --------------------------------------------------------------------------
// 6. MULTI-SPOUSE DISAMBIGUATION (Upgrade 5)
// --------------------------------------------------------------------------

export interface DisambiguationCandidate {
  id: string;
  fullName: string;
  birthYear?: number | null;
  gender?: string;
  isRecommended?: boolean;
}

// --------------------------------------------------------------------------
// 7. DEEP KINSHIP NOMENCLATURE (Traditional & English) (Upgrade 6)
// --------------------------------------------------------------------------

export interface KinshipNomenclature {
  formalEnglish: string;
  traditionalTelugu: string;
  description: string;
}

export function calculateKinshipNomenclature(
  category: string,
  targetGender: string = 'male',
  isPaternal: boolean = true,
  isElder: boolean = true
): KinshipNomenclature {
  const normCat = category.toLowerCase().replace(/[\s-]/g, '_');
  const isFemale = targetGender.toLowerCase() === 'female';

  switch (normCat) {
    case 'father':
      return { formalEnglish: 'Father', traditionalTelugu: 'Nanna / Thandri', description: 'Biological Father' };
    case 'mother':
      return { formalEnglish: 'Mother', traditionalTelugu: 'Amma / Thalli', description: 'Biological Mother' };
    case 'spouse':
      return isFemale
        ? { formalEnglish: 'Wife', traditionalTelugu: 'Bharya', description: 'Married Spouse' }
        : { formalEnglish: 'Husband', traditionalTelugu: 'Bartha', description: 'Married Spouse' };
    case 'son':
      return { formalEnglish: 'Son', traditionalTelugu: 'Koduku / Kumurudu', description: 'Direct Offspring' };
    case 'daughter':
      return { formalEnglish: 'Daughter', traditionalTelugu: 'Kuthuru / Kumarthe', description: 'Direct Offspring' };
    case 'brother':
    case 'sibling':
      if (isFemale) {
        return isElder
          ? { formalEnglish: 'Elder Sister', traditionalTelugu: 'Akka', description: 'Elder Female Sibling' }
          : { formalEnglish: 'Younger Sister', traditionalTelugu: 'Chelli', description: 'Younger Female Sibling' };
      }
      return isElder
        ? { formalEnglish: 'Elder Brother', traditionalTelugu: 'Annaya', description: 'Elder Male Sibling' }
        : { formalEnglish: 'Younger Brother', traditionalTelugu: 'Thammudu', description: 'Younger Male Sibling' };
    case 'grandparent':
    case 'grandfather':
      return isPaternal
        ? { formalEnglish: 'Paternal Grandfather', traditionalTelugu: 'Thathagaru (Paternal)', description: "Father's Father" }
        : { formalEnglish: 'Maternal Grandfather', traditionalTelugu: 'Thathagaru (Maternal)', description: "Mother's Father" };
    case 'grandmother':
      return isPaternal
        ? { formalEnglish: 'Paternal Grandmother', traditionalTelugu: 'Nanamma', description: "Father's Mother" }
        : { formalEnglish: 'Maternal Grandmother', traditionalTelugu: 'Ammamma', description: "Mother's Mother" };
    case 'uncle':
    case 'aunt':
    case 'uncles_aunts':
      if (isPaternal) {
        if (isFemale) {
          return { formalEnglish: 'Paternal Aunt', traditionalTelugu: 'Menatha / Athagaru', description: "Father's Sister" };
        }
        return isElder
          ? { formalEnglish: 'Elder Paternal Uncle', traditionalTelugu: 'Peddananna', description: "Father's Elder Brother" }
          : { formalEnglish: 'Younger Paternal Uncle', traditionalTelugu: 'Babai / Chinnanna', description: "Father's Younger Brother" };
      } else {
        if (isFemale) {
          return isElder
            ? { formalEnglish: 'Elder Maternal Aunt', traditionalTelugu: 'Peddamma', description: "Mother's Elder Sister" }
            : { formalEnglish: 'Younger Maternal Aunt', traditionalTelugu: 'Pinni / Chinnamma', description: "Mother's Younger Sister" };
        }
        return { formalEnglish: 'Maternal Uncle', traditionalTelugu: 'Menamama / Mamagaru', description: "Mother's Brother" };
      }
    default:
      return { formalEnglish: category, traditionalTelugu: category, description: 'Family Relative' };
  }
}

// --------------------------------------------------------------------------
// 8. CASCADING BATCH NUCLEAR FAMILY LINKING (Upgrade 7)
// --------------------------------------------------------------------------

export interface NuclearFamilyBatchCandidate {
  childId: string;
  fullName: string;
  birthYear?: number | null;
  gender?: string;
  hasOtherParent: boolean;
}

export function findNuclearFamilyBatchCandidates(
  spouseId: string | null | undefined,
  currentPersonId: string | null | undefined,
  nodes: KinshipNode[],
  edges: KinshipEdge[]
): NuclearFamilyBatchCandidate[] {
  if (!spouseId) return [];

  const nodeMap = new Map<string, KinshipNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
    if ((n as any).personId) nodeMap.set((n as any).personId, n);
  }

  // Find all children where source === spouseId and type === 'parent'
  const spouseChildIds: string[] = [];
  for (const e of edges) {
    if (e.type === 'parent' && e.source === spouseId && e.target !== currentPersonId) {
      spouseChildIds.push(e.target);
    }
  }

  const candidates: NuclearFamilyBatchCandidate[] = [];

  for (const cId of spouseChildIds) {
    // Check if child already has another parent
    const otherParentEdges = edges.filter(
      (e) => e.type === 'parent' && e.target === cId && e.source !== spouseId
    );
    const hasOtherParent = otherParentEdges.length > 0;

    const childNode = nodeMap.get(cId);
    if (childNode) {
      candidates.push({
        childId: childNode.id,
        fullName: [childNode.firstName, childNode.middleName, childNode.lastName].filter(Boolean).join(' '),
        birthYear: childNode.birthYear,
        gender: childNode.gender,
        hasOtherParent,
      });
    }
  }

  return candidates;
}

// --------------------------------------------------------------------------
// 9. ENHANCED KINSHIP INFERENCE RESULT (With Disambiguation & Siblings)
// --------------------------------------------------------------------------

export interface KinshipInferenceResult {
  inferredFatherId?: string;
  inferredMotherId?: string;
  inferredSpouseId?: string;
  inferredChildId?: string;
  reason?: string;
  multipleSpouseCandidates?: DisambiguationCandidate[];
  requiresDisambiguation?: boolean;
  discoveredSiblings?: SiblingDiscoveryResult;
  nuclearFamilyCandidates?: NuclearFamilyBatchCandidate[];
  estimatedGeneration?: GenerationEstimateResult | null;
  chronologyIssues?: ChronologyIssue[];
  suggestedSurname?: string | null;
}

export function inferKinshipRelations(params: {
  triggerField: 'father' | 'mother' | 'spouse' | 'child';
  triggerValue: string;
  currentFatherId?: string;
  currentMotherId?: string;
  currentSpouseId?: string;
  currentChildId?: string;
  subjectGender?: string;
  subjectBirthDate?: string | null;
  currentPersonId?: string | null;
  nodes: KinshipNode[];
  edges: KinshipEdge[];
}): KinshipInferenceResult {
  const {
    triggerField,
    triggerValue,
    currentFatherId,
    currentMotherId,
    currentSpouseId,
    currentChildId,
    subjectGender,
    subjectBirthDate,
    currentPersonId,
    nodes,
    edges,
  } = params;

  if (!triggerValue) {
    return {};
  }

  const nodeMap = new Map<string, KinshipNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
    if ((n as any).personId) nodeMap.set((n as any).personId, n);
  }

  const result: KinshipInferenceResult = {};

  // 1. Trigger is FATHER:
  if (triggerField === 'father') {
    const spouseEdges = edges.filter(
      (e) => e.type === 'spouse' && (e.source === triggerValue || e.target === triggerValue)
    );

    // Multi-spouse disambiguation (Upgrade 5)
    if (spouseEdges.length > 1) {
      const candidates: DisambiguationCandidate[] = spouseEdges.map((e) => {
        const sId = e.source === triggerValue ? e.target : e.source;
        const sNode = nodeMap.get(sId);
        return {
          id: sId,
          fullName: sNode ? [sNode.firstName, sNode.middleName, sNode.lastName].filter(Boolean).join(' ') : sId,
          birthYear: sNode?.birthYear,
          gender: sNode?.gender,
        };
      });
      result.multipleSpouseCandidates = candidates;
      result.requiresDisambiguation = true;
      result.reason = `✨ Father has ${candidates.length} recorded spouses in this lineage. Please select the biological Mother.`;
    } else if (spouseEdges.length === 1) {
      const spouseId = spouseEdges[0].source === triggerValue ? spouseEdges[0].target : spouseEdges[0].source;
      const spouseNode = nodeMap.get(spouseId);
      if (spouseNode && (!currentMotherId || currentMotherId === '')) {
        const spouseName = [spouseNode.firstName, spouseNode.middleName, spouseNode.lastName].filter(Boolean).join(' ');
        result.inferredMotherId = spouseNode.id;
        result.reason = `✨ Auto-filled Mother (${spouseName}) based on Father's spouse in this lineage.`;
      }
    }

    // Sibling auto-discovery (Upgrade 1)
    result.discoveredSiblings = discoverSiblings(
      triggerValue,
      result.inferredMotherId || currentMotherId,
      currentPersonId,
      nodes,
      edges
    );

    // Surname inheritance (Upgrade 4)
    const surnameInference = inferInheritedSurname(triggerValue, '', nodes);
    if (surnameInference.suggestedSurname) {
      result.suggestedSurname = surnameInference.suggestedSurname;
    }
  }

  // 2. Trigger is MOTHER:
  if (triggerField === 'mother') {
    const spouseEdges = edges.filter(
      (e) => e.type === 'spouse' && (e.source === triggerValue || e.target === triggerValue)
    );

    if (spouseEdges.length > 1) {
      const candidates: DisambiguationCandidate[] = spouseEdges.map((e) => {
        const sId = e.source === triggerValue ? e.target : e.source;
        const sNode = nodeMap.get(sId);
        return {
          id: sId,
          fullName: sNode ? [sNode.firstName, sNode.middleName, sNode.lastName].filter(Boolean).join(' ') : sId,
          birthYear: sNode?.birthYear,
          gender: sNode?.gender,
        };
      });
      result.multipleSpouseCandidates = candidates;
      result.requiresDisambiguation = true;
      result.reason = `✨ Mother has ${candidates.length} recorded spouses in this lineage. Please select the biological Father.`;
    } else if (spouseEdges.length === 1) {
      const spouseId = spouseEdges[0].source === triggerValue ? spouseEdges[0].target : spouseEdges[0].source;
      const spouseNode = nodeMap.get(spouseId);
      if (spouseNode && (!currentFatherId || currentFatherId === '')) {
        const spouseName = [spouseNode.firstName, spouseNode.middleName, spouseNode.lastName].filter(Boolean).join(' ');
        result.inferredFatherId = spouseNode.id;
        result.reason = `✨ Auto-filled Father (${spouseName}) based on Mother's spouse in this lineage.`;

        // Inherit surname from inferred father
        const surnameInference = inferInheritedSurname(spouseNode.id, '', nodes);
        if (surnameInference.suggestedSurname) {
          result.suggestedSurname = surnameInference.suggestedSurname;
        }
      }
    }

    // Sibling auto-discovery (Upgrade 1)
    result.discoveredSiblings = discoverSiblings(
      result.inferredFatherId || currentFatherId,
      triggerValue,
      currentPersonId,
      nodes,
      edges
    );
  }

  // 3. Trigger is CHILD:
  if (triggerField === 'child') {
    const parentEdges = edges.filter((e) => e.type === 'parent' && e.target === triggerValue);

    if (parentEdges.length > 0 && (!currentSpouseId || currentSpouseId === '')) {
      for (const pEdge of parentEdges) {
        const parentNode = nodeMap.get(pEdge.source);
        if (!parentNode) continue;

        if (subjectGender === 'male' && parentNode.gender === 'female') {
          const parentName = [parentNode.firstName, parentNode.lastName].filter(Boolean).join(' ');
          result.inferredSpouseId = parentNode.id;
          result.reason = `✨ Auto-filled Spouse (${parentName}) based on Child's biological mother in this lineage.`;
          break;
        }

        if (subjectGender === 'female' && parentNode.gender === 'male') {
          const parentName = [parentNode.firstName, parentNode.lastName].filter(Boolean).join(' ');
          result.inferredSpouseId = parentNode.id;
          result.reason = `✨ Auto-filled Spouse (${parentName}) based on Child's biological father in this lineage.`;
          break;
        }

        if (parentEdges.length === 1) {
          const parentName = [parentNode.firstName, parentNode.lastName].filter(Boolean).join(' ');
          result.inferredSpouseId = parentNode.id;
          result.reason = `✨ Auto-suggested Spouse (${parentName}) who is also a parent of this child.`;
        }
      }
    }
  }

  // 4. Trigger is SPOUSE:
  if (triggerField === 'spouse') {
    const childEdges = edges.filter((e) => e.type === 'parent' && e.source === triggerValue);

    if (childEdges.length > 0 && (!currentChildId || currentChildId === '')) {
      const firstChildNode = nodeMap.get(childEdges[0].target);
      if (firstChildNode) {
        const childName = [firstChildNode.firstName, firstChildNode.lastName].filter(Boolean).join(' ');
        result.inferredChildId = firstChildNode.id;
        result.reason = `✨ Auto-suggested Child (${childName}) connected to this spouse in this lineage.`;
      }
    }

    // Cascading Nuclear Family Candidates (Upgrade 7)
    const batchCandidates = findNuclearFamilyBatchCandidates(triggerValue, currentPersonId, nodes, edges);
    if (batchCandidates.length > 0) {
      result.nuclearFamilyCandidates = batchCandidates;
    }
  }

  // Estimated Generation & Birth Year (Upgrade 2)
  result.estimatedGeneration = estimateBirthYearAndGeneration({
    fatherId: triggerField === 'father' ? triggerValue : (result.inferredFatherId || currentFatherId),
    motherId: triggerField === 'mother' ? triggerValue : (result.inferredMotherId || currentMotherId),
    spouseId: triggerField === 'spouse' ? triggerValue : (result.inferredSpouseId || currentSpouseId),
    childId: triggerField === 'child' ? triggerValue : (result.inferredChildId || currentChildId),
    nodes,
  });

  // Chronology validation (Upgrade 3)
  result.chronologyIssues = validateKinshipChronology({
    subjectBirthDate,
    fatherId: triggerField === 'father' ? triggerValue : (result.inferredFatherId || currentFatherId),
    motherId: triggerField === 'mother' ? triggerValue : (result.inferredMotherId || currentMotherId),
    childId: triggerField === 'child' ? triggerValue : (result.inferredChildId || currentChildId),
    currentPersonId,
    nodes,
    edges,
  });

  return result;
}
