import { Person } from '../types/person';
import { Relationship } from '../types/relationship';
import {
  TfaQuestion,
  VerificationRecord,
} from '../types/verification';
import { buildFactId, getVerificationBadgeInfo } from '../services/verificationApi';
import { deriveRelationshipBetween } from './kinshipInference';

function getFullName(p: Person): string {
  return [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ');
}

function getPronouns(gender?: string) {
  const g = (gender || '').toLowerCase();
  if (g === 'female') {
    return { subject: 'she', object: 'her', possessive: 'her' };
  }
  if (g === 'male') {
    return { subject: 'he', object: 'him', possessive: 'his' };
  }
  return { subject: 'they', object: 'them', possessive: 'their' };
}

function formatBirthYearOrDate(raw: string): { year: string | null; isFullDate: boolean; display: string } {
  const trimmed = raw.trim();
  const yearMatch = trimmed.match(/^(\d{4})/);
  const year = yearMatch ? yearMatch[1] : null;
  const isFullDate = /^\d{4}-\d{2}-\d{2}/.test(trimmed);
  return { year, isFullDate, display: isFullDate ? trimmed : year || trimmed };
}

export interface GenerateTfaOptions {
  maxQuestions?: number;
  skippedFactIds?: Set<string>;
  rng?: () => number;
}

/**
 * Probabilistic check so TFA questions appear randomly, not on every single visit.
 */
export function shouldTriggerTfaPrompt(
  probability = 0.5,
  rng: () => number = Math.random
): boolean {
  return rng() < probability;
}

/**
 * Intelligent Data-Driven TFA Question Framing Engine.
 * Dynamically inspects all family persons, relationships, and verification states
 * to frame natural, context-aware verification questions tailored to the current viewer.
 *
 * Rules enforced:
 *  - Never hardcodes specific people or static questions.
 *  - Excludes facts recorded by `viewerId` (Rule c).
 *  - Excludes facts already verified (2/2) or already confirmed/disputed/skipped by `viewerId`.
 *  - Prioritizes unverified (1/2) facts & close kinship links relative to `viewerId`.
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
  const rng = options.rng ?? Math.random;

  const activePersons = allPersons.filter((p) => !p.is_archived);
  const viewer = activePersons.find((p) => p.id === viewerId);
  if (!viewer) return [];

  const personById = new Map(activePersons.map((p) => [p.id, p]));
  const viewerPronouns = getPronouns(viewer.gender);
  const candidates: TfaQuestion[] = [];

  const isFactEligible = (
    factId: string,
    record?: VerificationRecord
  ): boolean => {
    if (skippedFactIds.has(factId)) return false;
    if (record) {
      // Rule (c): Author who recorded the data must never be asked to verify it
      if (record.recorded_by && record.recorded_by === viewerId) return false;
      // Already confirmed or disputed by this viewer
      if (record.verifiers?.includes(viewerId)) return false;
      if (record.disputed_by?.includes(viewerId)) return false;
      // Already 2/2 Verified
      if (getVerificationBadgeInfo(record).isVerified) return false;
    }
    return true;
  };

  // 1. Frame Relationship Verification Questions dynamically
  const seenRelPairs = new Set<string>();
  for (const rel of allRelationships) {
    const p1 = personById.get(rel.person_id);
    const p2 = personById.get(rel.related_person_id);
    if (!p1 || !p2) continue;

    // Deduplicate symmetric spouse pairs
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

    if (rel.relationship_type === 'spouse') {
      if (p1.id === viewerId || p2.id === viewerId) {
        const partner = p1.id === viewerId ? p2 : p1;
        subject = partner;
        questionText = `Is ${getFullName(partner)} your spouse?`;
        detailHint = 'Confirming your marital connection in the family tree';
        relevance += 60;
      } else {
        const relToP1 = deriveRelationshipBetween(viewerId, p1.id, activePersons, allRelationships);
        const relToP2 = deriveRelationshipBetween(viewerId, p2.id, activePersons, allRelationships);
        const isClose = relToP1.category !== 'unrelated' || relToP2.category !== 'unrelated';
        subject = p1;
        questionText = `Are ${getFullName(p1)} and ${getFullName(p2)} married spouses?`;
        detailHint = isClose
          ? `Related to you (${relToP1.relationship !== 'Unrelated' ? relToP1.relationship : relToP2.relationship})`
          : 'Spouse relationship verification';
        relevance += isClose ? 35 : 5;
      }
    } else if (rel.relationship_type === 'parent') {
      // p2 = parent, p1 = child
      const parentLabel = p2.gender === 'female' ? 'mother' : p2.gender === 'male' ? 'father' : 'parent';
      if (p1.id === viewerId) {
        subject = p2;
        questionText = `Is ${getFullName(p2)} your ${parentLabel}?`;
        detailHint = 'Direct parent-child lineage verification';
        relevance += 75;
      } else if (p2.id === viewerId) {
        const childLabel = p1.gender === 'female' ? 'daughter' : p1.gender === 'male' ? 'son' : 'child';
        subject = p1;
        questionText = `Is ${getFullName(p1)} your ${childLabel}?`;
        detailHint = 'Direct parent-child lineage verification';
        relevance += 75;
      } else {
        const derivedFromViewer = deriveRelationshipBetween(
          viewerId,
          p2.id,
          activePersons,
          allRelationships
        );
        const childDerived = deriveRelationshipBetween(
          viewerId,
          p1.id,
          activePersons,
          allRelationships
        );
        const targetPronouns = getPronouns(p1.gender);
        subject = p2;

        if (derivedFromViewer.category !== 'unrelated' && derivedFromViewer.path.length <= 4) {
          // Viewer-centric kinship framing (e.g., "Is <Name> your Uncle?" / "Is <Name> your Nephew?")
          questionText = `Is ${getFullName(p2)} your ${derivedFromViewer.relationship.toLowerCase()}, and the ${parentLabel} of ${getFullName(p1)}?`;
          detailHint = `${getFullName(p1)} is your ${childDerived.relationship}`;
          relevance += 45;
        } else {
          questionText = `Is ${getFullName(p2)} the ${parentLabel} of ${getFullName(p1)} (${targetPronouns.possessive} ${parentLabel})?`;
          detailHint = 'Parent-child relationship record';
          relevance += 15;
        }
      }
    }

    if (!questionText) continue;

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
      category_label: 'Kinship Verification',
      question_text: questionText,
      detail_hint: detailHint,
      options: [
        { id: 'confirm', label: 'Yes, Confirmed', action: 'confirm' },
        { id: 'reject', label: 'No, Incorrect', action: 'reject' },
        { id: 'skip', label: 'Not Sure', action: 'skip' },
      ],
      relevance_score: relevance + rng() * 25,
    });
  }

  // 2. Frame Perspective Extended Kinship Questions (e.g., Nephew, Uncle, Aunt, Sibling)
  // Maps directly to an underlying relationship record for verification
  for (const other of activePersons) {
    if (other.id === viewerId) continue;
    const derived = deriveRelationshipBetween(viewerId, other.id, activePersons, allRelationships);
    if (
      derived.category === 'unrelated' ||
      derived.category === 'self' ||
      derived.category === 'parents' ||
      derived.category === 'children' ||
      derived.category === 'spouses'
    ) {
      continue;
    }

    // Find a backing relationship on the path to verify
    const backingRel = allRelationships.find(
      (r) =>
        (r.person_id === other.id || r.related_person_id === other.id) &&
        isFactEligible(buildFactId('relationship', r.id, 'relationship'), verificationMap[buildFactId('relationship', r.id, 'relationship')])
    );
    if (!backingRel) continue;

    const factId = buildFactId('relationship', backingRel.id, 'relationship');
    if (candidates.some((c) => c.fact_id === factId)) continue;

    const record = verificationMap[factId];
    const otherPronouns = getPronouns(other.gender);
    candidates.push({
      fact_id: factId,
      entity_type: 'relationship',
      entity_id: backingRel.id,
      field: 'relationship',
      recorded_by: record?.recorded_by ?? null,
      subject_person_id: other.id,
      subject_name: getFullName(other),
      subject_photo: other.profile_photo,
      subject_gender: other.gender,
      category_label: 'Family Relation Check',
      question_text: `Is ${getFullName(other)} your ${derived.relationship} (making you ${otherPronouns.possessive} ${derived.reverse_relationship})?`,
      detail_hint: `Verifying ${derived.relationship} connection`,
      options: [
        { id: 'confirm', label: `Yes, ${otherPronouns.subject === 'he' ? 'he' : otherPronouns.subject === 'she' ? 'she' : 'they'} is my ${derived.relationship}`, action: 'confirm' },
        { id: 'reject', label: 'No, Incorrect', action: 'reject' },
        { id: 'skip', label: 'Not Sure', action: 'skip' },
      ],
      relevance_score: 140 + rng() * 30,
    });
  }

  // 3. Frame Birth Date / Birth Year Questions dynamically
  for (const person of activePersons) {
    if (!person.birth_date) continue;
    const factId = buildFactId('person', person.id, 'birth_date');
    const record = verificationMap[factId];
    if (!isFactEligible(factId, record)) continue;

    const parsed = formatBirthYearOrDate(person.birth_date);
    const name = person.id === viewerId ? 'you' : getFullName(person);
    const derived =
      person.id === viewerId
        ? null
        : deriveRelationshipBetween(viewerId, person.id, activePersons, allRelationships);
    const isClose = person.id === viewerId || (derived && derived.category !== 'unrelated');

    const questionText =
      person.id === viewerId
        ? parsed.isFullDate
          ? `Is your date of birth ${parsed.display}?`
          : `Were you born in ${parsed.display}?`
        : parsed.isFullDate
        ? `Was ${name} born on ${parsed.display}?`
        : `Was ${name} born in ${parsed.display}?`;

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
      category_label: 'Date of Birth (DOB)',
      question_text: questionText,
      detail_hint: derived && derived.category !== 'unrelated'
        ? `${getFullName(person)} (${derived.relationship} to ${viewerPronouns.object === 'her' ? 'you' : 'you'})`
        : 'Birth record verification',
      options: [
        { id: 'confirm', label: `Yes, ${parsed.display}`, action: 'confirm' },
        { id: 'reject', label: 'No, Different Date', action: 'reject' },
        { id: 'skip', label: 'Not Sure', action: 'skip' },
      ],
      relevance_score: (isClose ? 130 : 85) + rng() * 30,
    });
  }

  // 4. Frame Birth Place Questions dynamically
  for (const person of activePersons) {
    if (!person.birth_place || !person.birth_place.trim()) continue;
    const factId = buildFactId('person', person.id, 'birth_place');
    const record = verificationMap[factId];
    if (!isFactEligible(factId, record)) continue;

    const place = person.birth_place.trim();
    const questionText =
      person.id === viewerId
        ? `Were you born in ${place}?`
        : `Was ${getFullName(person)} born in ${place}?`;

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
      category_label: 'Birth Place',
      question_text: questionText,
      detail_hint: 'Birthplace record verification',
      options: [
        { id: 'confirm', label: `Yes, ${place}`, action: 'confirm' },
        { id: 'reject', label: 'No, Different Place', action: 'reject' },
        { id: 'skip', label: 'Not Sure', action: 'skip' },
      ],
      relevance_score: 95 + rng() * 30,
    });
  }

  // Sort by intelligent relevance score + random jitter and return top N
  candidates.sort((a, b) => b.relevance_score - a.relevance_score);
  return candidates.slice(0, maxQuestions);
}
