import { Person } from '../types/person';
import { Relationship } from '../types/relationship';
import {
  TfaQuestion,
  TfaQuestionOption,
  VerificationRecord,
} from '../types/verification';
import { buildFactId, getVerificationBadgeInfo } from '../services/verificationApi';
import { deriveRelationshipBetween } from './kinshipInference';

function getFullName(p: Person): string {
  return [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ');
}

function getPronouns(gender?: string) {
  const g = (gender || '').toLowerCase();
  if (g === 'female') return { subject: 'she', object: 'her', possessive: 'her' };
  if (g === 'male') return { subject: 'he', object: 'him', possessive: 'his' };
  return { subject: 'they', object: 'them', possessive: 'their' };
}

function parseBirthYear(raw?: string | null): number | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{4})/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  return !isNaN(y) && y > 1800 && y < 2100 ? y : null;
}

function formatBirthYearOrDate(raw: string): { year: number | null; isFullDate: boolean; display: string } {
  const trimmed = raw.trim();
  const year = parseBirthYear(trimmed);
  const isFullDate = /^\d{4}-\d{2}-\d{2}/.test(trimmed);
  return { year, isFullDate, display: isFullDate ? trimmed : year ? String(year) : trimmed };
}

function shuffleWithRng<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function isRecentlyUpdated(updatedAt?: string, nowMs = Date.now()): boolean {
  if (!updatedAt) return false;
  const ts = Date.parse(updatedAt);
  if (isNaN(ts)) return false;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  return nowMs - ts <= SEVEN_DAYS_MS;
}

export interface GenerateTfaOptions {
  maxQuestions?: number;
  skippedFactIds?: Set<string>;
  cooledBranchKeys?: Set<string>;
  rng?: () => number;
  nowMs?: number;
}

/**
 * Probabilistic check so TFA questions appear randomly, not on every single visit.
 */
export function shouldTriggerTfaPrompt(
  probability = 0.85,
  rng: () => number = Math.random
): boolean {
  return rng() < probability;
}

/**
 * Intelligent Algorithmic TFA Question Framing Engine (Upgrades 1–7).
 */
export function generateTfaQuestionsForViewer(
  allPersons: Person[],
  allRelationships: Relationship[],
  viewerId: string,
  verificationMap: Record<string, VerificationRecord> = {},
  options: GenerateTfaOptions = {}
): TfaQuestion[] {
  const maxQuestions = options.maxQuestions ?? 2;
  const skippedFactIds = options.skippedFactIds ?? new Set<string>();
  const cooledBranchKeys = options.cooledBranchKeys ?? new Set<string>();
  const rng = options.rng ?? Math.random;
  const nowMs = options.nowMs ?? Date.now();

  const activePersons = allPersons.filter((p) => !p.is_archived);
  const viewer = activePersons.find((p) => p.id === viewerId);
  if (!viewer) return [];

  const personById = new Map(activePersons.map((p) => [p.id, p]));
  const viewerBirthYear = parseBirthYear(viewer.birth_date);
  const isElderViewer = viewerBirthYear !== null && viewerBirthYear <= 1980;
  const isYoungerViewer = viewerBirthYear !== null && viewerBirthYear >= 1981;

  // Collect all known birth places across the tree for realistic distractor generation
  const allBirthPlaces = Array.from(
    new Set(
      activePersons
        .map((p) => p.birth_place?.trim())
        .filter((bp): bp is string => Boolean(bp))
    )
  );

  // Detect chronology anomalies (tight parent-child gap <16y or wide gap >50y)
  const anomalyPersonIds = new Set<string>();
  const parentsOfPerson = new Map<string, Person[]>();
  const childrenOfPerson = new Map<string, Person[]>();

  for (const rel of allRelationships) {
    if (rel.relationship_type === 'parent') {
      const child = personById.get(rel.person_id);
      const parent = personById.get(rel.related_person_id);
      if (child && parent) {
        if (!parentsOfPerson.has(child.id)) parentsOfPerson.set(child.id, []);
        parentsOfPerson.get(child.id)!.push(parent);
        if (!childrenOfPerson.has(parent.id)) childrenOfPerson.set(parent.id, []);
        childrenOfPerson.get(parent.id)!.push(child);

        const py = parseBirthYear(parent.birth_date);
        const cy = parseBirthYear(child.birth_date);
        if (py !== null && cy !== null) {
          const gap = cy - py;
          if (gap < 16 || gap > 50) {
            anomalyPersonIds.add(child.id);
            anomalyPersonIds.add(parent.id);
          }
        }
      }
    }
  }

  const candidates: TfaQuestion[] = [];

  const isFactEligible = (factId: string, record?: VerificationRecord): boolean => {
    if (skippedFactIds.has(factId)) return false;
    if (record) {
      if (record.recorded_by && record.recorded_by === viewerId) return false;
      if (record.verifiers?.includes(viewerId)) return false;
      if (record.disputed_by?.includes(viewerId)) return false;
      if (getVerificationBadgeInfo(record).isVerified) return false;
    }
    return true;
  };

  const applySharedBoosts = (
    baseScore: number,
    _factId: string,
    subject: Person,
    record?: VerificationRecord
  ) => {
    let score = baseScore;
    const isDisputed = Boolean(record?.disputed_by && record.disputed_by.length > 0);
    const isAnomaly = anomalyPersonIds.has(subject.id);
    const branchKey = (subject.last_name || 'general').trim().toLowerCase();

    // Upgrade 2: Conflict resolution tie-breaker boost
    if (isDisputed) score += 200;
    // Upgrade 3: Anomaly & fresh-edit boosts
    if (isAnomaly) score += 120;
    if (isRecentlyUpdated(subject.updated_at, nowMs)) score += 80;
    // Upgrade 4: Adaptive branch cooling
    if (cooledBranchKeys.has(branchKey)) score -= 90;

    return { score, isDisputed, isAnomaly, branchKey };
  };

  // =========================================================================
  // 1 & 5. Relationship + Compound Triangulated Kinship Questions
  // =========================================================================
  const seenRelPairs = new Set<string>();
  for (const rel of allRelationships) {
    const p1 = personById.get(rel.person_id);
    const p2 = personById.get(rel.related_person_id);
    if (!p1 || !p2) continue;

    const pairKey =
      rel.relationship_type === 'spouse'
        ? `spouse:${[p1.id, p2.id].sort().join('<->')}`
        : `parent:${p2.id}->${p1.id}`;
    if (seenRelPairs.has(pairKey)) continue;
    seenRelPairs.add(pairKey);

    const factId = buildFactId('relationship', rel.id, 'relationship');
    const record = verificationMap[factId];
    if (!isFactEligible(factId, record)) continue;

    let questionText = '';
    let detailHint = '';
    let subject = p2;
    let relevance = 100;
    let optionsList: TfaQuestionOption[] = [
      { id: 'confirm', label: 'Yes, Confirmed', action: 'confirm', isCorrectOption: true },
      { id: 'reject', label: 'No, Incorrect', action: 'reject' },
      { id: 'skip', label: 'Not Sure', action: 'skip' },
    ];

    if (rel.relationship_type === 'spouse') {
      if (p1.id === viewerId || p2.id === viewerId) {
        const partner = p1.id === viewerId ? p2 : p1;
        subject = partner;
        questionText = `Is ${getFullName(partner)} your spouse?`;
        detailHint = 'Confirming your marital connection';
        relevance += 60;
      } else {
        const relToP1 = deriveRelationshipBetween(viewerId, p1.id, activePersons, allRelationships);
        const isClose = relToP1.category !== 'unrelated';
        subject = p1;
        questionText = `Are ${getFullName(p1)} and ${getFullName(p2)} married spouses?`;
        detailHint = isClose ? `Connected via your ${relToP1.relationship}` : 'Spouse relationship verification';
        relevance += isClose ? 35 : 5;
      }
    } else if (rel.relationship_type === 'parent') {
      const parentLabel = p2.gender === 'female' ? 'mother' : p2.gender === 'male' ? 'father' : 'parent';
      if (p1.id === viewerId) {
        subject = p2;
        questionText = `Is ${getFullName(p2)} your ${parentLabel}?`;
        detailHint = 'Direct parent-child lineage';
        relevance += 75;
      } else if (p2.id === viewerId) {
        const childLabel = p1.gender === 'female' ? 'daughter' : p1.gender === 'male' ? 'son' : 'child';
        subject = p1;
        questionText = `Is ${getFullName(p1)} your ${childLabel}?`;
        detailHint = 'Direct parent-child lineage';
        relevance += 75;
      } else {
        const derivedFromViewer = deriveRelationshipBetween(viewerId, p2.id, activePersons, allRelationships);
        subject = p2;

        // Upgrade 1: Smart multiple-choice kinship distractors when viewer is connected
        if (derivedFromViewer.category !== 'unrelated' && derivedFromViewer.path.length <= 4) {
          const correctRel = derivedFromViewer.relationship;
          const distractorPool = [
            'Father',
            'Mother',
            'Uncle',
            'Aunt',
            'Grandfather',
            'Grandmother',
            'Great-Uncle',
            'Brother',
            'Sister',
            'Cousin',
            'Nephew',
            'Niece',
          ].filter((r) => r.toLowerCase() !== correctRel.toLowerCase());
          const pickedDistractors = shuffleWithRng(distractorPool, rng).slice(0, 2);

          questionText = `How is ${getFullName(p2)} related to you?`;
          detailHint = `Parent of ${getFullName(p1)}`;
          optionsList = [
            ...shuffleWithRng(
              [
                { id: 'confirm', label: correctRel, action: 'confirm' as const, isCorrectOption: true },
                ...pickedDistractors.map((d, idx) => ({
                  id: `dist-${idx}`,
                  label: d,
                  action: 'reject' as const,
                })),
              ],
              rng
            ),
            { id: 'reject_other', label: 'None of these (Incorrect)', action: 'reject' },
            { id: 'skip', label: 'Not Sure', action: 'skip' },
          ];
          relevance += 55;
        } else {
          const targetPronouns = getPronouns(p1.gender);
          questionText = `Is ${getFullName(p2)} the ${parentLabel} of ${getFullName(p1)} (${targetPronouns.possessive} ${parentLabel})?`;
          detailHint = 'Parent-child relationship record';
          relevance += 15;
        }
      }
    }

    if (!questionText) continue;

    // Upgrade 4: Generational routing boost
    const subjectYear = parseBirthYear(subject.birth_date);
    if (isElderViewer && subjectYear !== null && subjectYear <= 1980) relevance += 45;
    if (isYoungerViewer && subjectYear !== null && subjectYear >= 1981) relevance += 45;

    const boosts = applySharedBoosts(relevance, factId, subject, record);

    candidates.push({
      fact_id: factId,
      entity_type: 'relationship',
      entity_id: rel.id,
      field: 'relationship',
      recorded_by: record?.recorded_by ?? null,
      subject_person_id: subject.id,
      subject_name: getFullName(subject),
      subject_photo: subject.profile_photo,
      subject_gender: subject.gender,
      category_label: boosts.isDisputed ? 'Disputed Tie-Breaker · Kinship' : 'Kinship Verification',
      question_text: questionText,
      detail_hint: detailHint,
      options: optionsList,
      relevance_score: boosts.score + rng() * 5,
      allowCorrection: true,
      correctionPlaceholder: 'Optional: describe the correct relationship...',
      isDisputed: boosts.isDisputed,
      isAnomaly: boosts.isAnomaly,
      branchKey: boosts.branchKey,
    });
  }

  // Upgrade 5: Compound / Triangulated Kinship Questions (Multi-child & Sibling pairs)
  for (const rel of allRelationships) {
    if (rel.relationship_type !== 'spouse') continue;
    const sp1 = personById.get(rel.person_id);
    const sp2 = personById.get(rel.related_person_id);
    if (!sp1 || !sp2 || sp1.id === viewerId || sp2.id === viewerId) continue;

    const c1 = new Set((childrenOfPerson.get(sp1.id) || []).map((c) => c.id));
    const sharedChildren = (childrenOfPerson.get(sp2.id) || []).filter((c) => c1.has(c.id));
    if (sharedChildren.length >= 2) {
      const factId = buildFactId('relationship', rel.id, 'relationship');
      const record = verificationMap[factId];
      if (!isFactEligible(factId, record)) continue;
      const childNames = sharedChildren.map((c) => c.first_name).join(' & ');
      const boosts = applySharedBoosts(145, factId, sp1, record);
      candidates.push({
        fact_id: `${factId}__compound`,
        entity_type: 'relationship',
        entity_id: rel.id,
        field: 'relationship',
        recorded_by: record?.recorded_by ?? null,
        subject_person_id: sp1.id,
        subject_name: `${getFullName(sp1)} & ${getFullName(sp2)}`,
        subject_photo: sp1.profile_photo,
        subject_gender: sp1.gender,
        category_label: 'Triangulated Family Check',
        question_text: `Do ${getFullName(sp1)} and ${getFullName(sp2)} have ${sharedChildren.length} children together (${childNames})?`,
        detail_hint: 'Verifies marriage and all parent-child links together',
        options: [
          { id: 'confirm', label: `Yes, ${sharedChildren.length} children (${childNames})`, action: 'confirm', isCorrectOption: true },
          { id: 'reject', label: 'No, Incorrect', action: 'reject' },
          { id: 'skip', label: 'Not Sure', action: 'skip' },
        ],
        relevance_score: boosts.score + rng() * 5,
        allowCorrection: true,
        correctionPlaceholder: 'Optional: list the correct children...',
        isDisputed: boosts.isDisputed,
        isAnomaly: boosts.isAnomaly,
        branchKey: boosts.branchKey,
      });
    }
  }

  // =========================================================================
  // 2. Birth Date / Birth Year Questions (Smart Distractors + Fill-in-the-Blank)
  // =========================================================================
  for (const person of activePersons) {
    const factId = buildFactId('person', person.id, 'birth_date');
    const record = verificationMap[factId];
    if (!isFactEligible(factId, record)) continue;

    const derived =
      person.id === viewerId
        ? null
        : deriveRelationshipBetween(viewerId, person.id, activePersons, allRelationships);
    const isClose = person.id === viewerId || (derived && derived.category !== 'unrelated');

    if (!person.birth_date) {
      // Upgrade 3: Fill-in-the-blank prompt for missing DOB (close relatives only)
      if (!isClose || person.id === viewerId) continue;
      const boosts = applySharedBoosts(110, factId, person, record);
      candidates.push({
        fact_id: factId,
        entity_type: 'person',
        entity_id: person.id,
        field: 'birth_date',
        recorded_by: record?.recorded_by ?? null,
        subject_person_id: person.id,
        subject_name: getFullName(person),
        subject_photo: person.profile_photo,
        subject_gender: person.gender,
        category_label: 'Missing Record · DOB',
        question_text: `We don't have a birth year recorded for ${getFullName(person)}. Do you know when they were born?`,
        detail_hint: derived ? `Your ${derived.relationship}` : 'Help complete family history',
        options: [
          { id: 'fill', label: 'Submit Birth Year / Date', action: 'fill' },
          { id: 'skip', label: 'Not Sure', action: 'skip' },
        ],
        relevance_score: boosts.score + rng() * 4,
        allowFillInput: true,
        fillPlaceholder: 'e.g. 1978 or 1978-05-14',
        branchKey: boosts.branchKey,
      });
      continue;
    }

    const parsed = formatBirthYearOrDate(person.birth_date);
    let baseRel = isClose ? 130 : 85;
    if (isElderViewer && parsed.year !== null && parsed.year <= 1980) baseRel += 45;
    if (isYoungerViewer && parsed.year !== null && parsed.year >= 1981) baseRel += 45;

    const boosts = applySharedBoosts(baseRel, factId, person, record);

    // Upgrade 1: Smart Multiple-Choice Year Distractors bounded by parent/child chronology
    let optionsList: TfaQuestionOption[];
    let questionText: string;

    if (parsed.year !== null && !parsed.isFullDate) {
      const parentYears = (parentsOfPerson.get(person.id) || [])
        .map((p) => parseBirthYear(p.birth_date))
        .filter((y): y is number => y !== null);
      const minBound = parentYears.length > 0 ? Math.max(...parentYears) + 16 : parsed.year - 6;

      const d1 = parsed.year - 2 >= minBound ? parsed.year - 2 : parsed.year + 4;
      const d2 = parsed.year + 2;
      const yearChoices = Array.from(new Set([d1, parsed.year, d2])).map(String);

      questionText =
        person.id === viewerId
          ? 'Which year were you born?'
          : `Which year was ${getFullName(person)} born?`;

      optionsList = [
        ...shuffleWithRng(
          yearChoices.map((yc) => ({
            id: `yr-${yc}`,
            label: yc,
            action: yc === String(parsed.year) ? ('confirm' as const) : ('reject' as const),
            isCorrectOption: yc === String(parsed.year),
          })),
          rng
        ),
        { id: 'reject_other', label: 'Different Year (Incorrect)', action: 'reject' },
        { id: 'skip', label: 'Not Sure', action: 'skip' },
      ];
    } else {
      questionText =
        person.id === viewerId
          ? `Is your date of birth ${parsed.display}?`
          : `Was ${getFullName(person)} born on ${parsed.display}?`;
      optionsList = [
        { id: 'confirm', label: `Yes, ${parsed.display}`, action: 'confirm', isCorrectOption: true },
        { id: 'reject', label: 'No, Different Date', action: 'reject' },
        { id: 'skip', label: 'Not Sure', action: 'skip' },
      ];
    }

    candidates.push({
      fact_id: factId,
      entity_type: 'person',
      entity_id: person.id,
      field: 'birth_date',
      recorded_by: record?.recorded_by ?? null,
      subject_person_id: person.id,
      subject_name: getFullName(person),
      subject_photo: person.profile_photo,
      subject_gender: person.gender,
      category_label: boosts.isAnomaly
        ? 'Chronology Check · DOB'
        : boosts.isDisputed
        ? 'Disputed Tie-Breaker · DOB'
        : 'Date of Birth (DOB)',
      question_text: questionText,
      detail_hint: derived && derived.category !== 'unrelated'
        ? `${getFullName(person)} (${derived.relationship})`
        : 'Birth record verification',
      options: optionsList,
      relevance_score: boosts.score + rng() * 5,
      allowCorrection: true,
      correctionPlaceholder: 'Optional: enter correct birth year or YYYY-MM-DD',
      isDisputed: boosts.isDisputed,
      isAnomaly: boosts.isAnomaly,
      branchKey: boosts.branchKey,
    });
  }

  // =========================================================================
  // 3. Birth Place Questions (Smart Place Distractors + Fill-in-the-Blank)
  // =========================================================================
  for (const person of activePersons) {
    const factId = buildFactId('person', person.id, 'birth_place');
    const record = verificationMap[factId];
    if (!isFactEligible(factId, record)) continue;

    const place = person.birth_place?.trim();
    if (!place) {
      const derived =
        person.id === viewerId
          ? null
          : deriveRelationshipBetween(viewerId, person.id, activePersons, allRelationships);
      if (!derived || derived.category === 'unrelated') continue;
      const boosts = applySharedBoosts(85, factId, person, record);
      candidates.push({
        fact_id: factId,
        entity_type: 'person',
        entity_id: person.id,
        field: 'birth_place',
        recorded_by: record?.recorded_by ?? null,
        subject_person_id: person.id,
        subject_name: getFullName(person),
        subject_photo: person.profile_photo,
        subject_gender: person.gender,
        category_label: 'Missing Record · Birth Place',
        question_text: `Do you know the birthplace of ${getFullName(person)}?`,
        detail_hint: `Your ${derived.relationship}`,
        options: [
          { id: 'fill', label: 'Submit Birth Place', action: 'fill' },
          { id: 'skip', label: 'Not Sure', action: 'skip' },
        ],
        relevance_score: boosts.score + rng() * 4,
        allowFillInput: true,
        fillPlaceholder: 'e.g. Madanapalli, Tirupati',
        branchKey: boosts.branchKey,
      });
      continue;
    }

    const otherPlaces = shuffleWithRng(
      allBirthPlaces.filter((bp) => bp.toLowerCase() !== place.toLowerCase()),
      rng
    ).slice(0, 2);

    const boosts = applySharedBoosts(95, factId, person, record);
    const optionsList: TfaQuestionOption[] =
      otherPlaces.length > 0
        ? [
            ...shuffleWithRng(
              [
                { id: 'confirm', label: place, action: 'confirm' as const, isCorrectOption: true },
                ...otherPlaces.map((op, idx) => ({
                  id: `pl-${idx}`,
                  label: op,
                  action: 'reject' as const,
                })),
              ],
              rng
            ),
            { id: 'reject_other', label: 'Another Place (Incorrect)', action: 'reject' },
            { id: 'skip', label: 'Not Sure', action: 'skip' },
          ]
        : [
            { id: 'confirm', label: `Yes, ${place}`, action: 'confirm', isCorrectOption: true },
            { id: 'reject', label: 'No, Different Place', action: 'reject' },
            { id: 'skip', label: 'Not Sure', action: 'skip' },
          ];

    candidates.push({
      fact_id: factId,
      entity_type: 'person',
      entity_id: person.id,
      field: 'birth_place',
      recorded_by: record?.recorded_by ?? null,
      subject_person_id: person.id,
      subject_name: getFullName(person),
      subject_photo: person.profile_photo,
      subject_gender: person.gender,
      category_label: boosts.isDisputed ? 'Disputed Tie-Breaker · Birth Place' : 'Birth Place',
      question_text:
        person.id === viewerId
          ? 'Where were you born?'
          : `Where was ${getFullName(person)} born?`,
      detail_hint: 'Birthplace record verification',
      options: optionsList,
      relevance_score: boosts.score + rng() * 5,
      allowCorrection: true,
      correctionPlaceholder: 'Optional: enter correct birthplace',
      isDisputed: boosts.isDisputed,
      branchKey: boosts.branchKey,
    });
  }

  // =========================================================================
  // 7. Expanded Fields: Alias (Nickname / House Name) & Living/Deceased Status
  // =========================================================================
  for (const person of activePersons) {
    if (person.alias && person.alias.trim()) {
      const factId = buildFactId('person', person.id, 'alias');
      const record = verificationMap[factId];
      if (isFactEligible(factId, record)) {
        const boosts = applySharedBoosts(90, factId, person, record);
        candidates.push({
          fact_id: factId,
          entity_type: 'person',
          entity_id: person.id,
          field: 'alias',
          recorded_by: record?.recorded_by ?? null,
          subject_person_id: person.id,
          subject_name: getFullName(person),
          subject_photo: person.profile_photo,
          subject_gender: person.gender,
          category_label: 'Alias / Family Name',
          question_text: `Is ${getFullName(person)} also known as "${person.alias.trim()}"?`,
          detail_hint: 'Nickname / alias verification',
          options: [
            { id: 'confirm', label: `Yes, "${person.alias.trim()}"`, action: 'confirm', isCorrectOption: true },
            { id: 'reject', label: 'No, Incorrect', action: 'reject' },
            { id: 'skip', label: 'Not Sure', action: 'skip' },
          ],
          relevance_score: boosts.score + rng() * 4,
          allowCorrection: true,
          correctionPlaceholder: 'Optional: enter correct nickname/alias',
          isDisputed: boosts.isDisputed,
          branchKey: boosts.branchKey,
        });
      }
    }

    if (!person.is_living || person.death_date) {
      const factId = buildFactId('person', person.id, 'is_living');
      const record = verificationMap[factId];
      if (isFactEligible(factId, record)) {
        const boosts = applySharedBoosts(88, factId, person, record);
        candidates.push({
          fact_id: factId,
          entity_type: 'person',
          entity_id: person.id,
          field: 'is_living',
          recorded_by: record?.recorded_by ?? null,
          subject_person_id: person.id,
          subject_name: getFullName(person),
          subject_photo: person.profile_photo,
          subject_gender: person.gender,
          category_label: 'Life Record',
          question_text: person.death_date
            ? `Did ${getFullName(person)} pass away in ${person.death_date.slice(0, 4)}?`
            : `Is ${getFullName(person)} recorded accurately as deceased?`,
          detail_hint: 'Life status verification',
          options: [
            { id: 'confirm', label: 'Yes, Accurate', action: 'confirm', isCorrectOption: true },
            { id: 'reject', label: 'No, Incorrect', action: 'reject' },
            { id: 'skip', label: 'Not Sure', action: 'skip' },
          ],
          relevance_score: boosts.score + rng() * 4,
          allowCorrection: true,
          correctionPlaceholder: 'Optional: enter correct year or status',
          isDisputed: boosts.isDisputed,
          branchKey: boosts.branchKey,
        });
      }
    }
  }

  candidates.sort((a, b) => b.relevance_score - a.relevance_score);
  return candidates.slice(0, maxQuestions);
}
