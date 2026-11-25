import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { getDb, isBrowserRuntime } from './firebaseDb';
import { personApi } from './personApi';
import { ApiResponse } from '../types/api';
import { Person } from '../types/person';
import { Relationship } from '../types/relationship';
import {
  LineageTrustScore,
  VerifiableField,
  VerificationBadgeInfo,
  VerificationRecord,
} from '../types/verification';

let testVerificationStore: Map<string, VerificationRecord> | null = null;

function getTestStore(): Map<string, VerificationRecord> {
  if (!testVerificationStore) {
    testVerificationStore = new Map();
  }
  return testVerificationStore;
}

export function resetTestVerificationStore(): void {
  testVerificationStore = null;
}

export function buildFactId(
  entityType: 'person' | 'relationship',
  entityId: string,
  field: VerifiableField
): string {
  return `${entityType}__${entityId}__${field}`;
}

export function getVerificationBadgeInfo(
  record?: VerificationRecord | null
): VerificationBadgeInfo {
  if (!record) {
    return {
      count: 1,
      isVerified: false,
      label: '1/2',
      disputed: false,
    };
  }
  const uniqueVerifiers = new Set(record.verifiers || []);
  const effectiveCount = Math.max(1, Math.min(2, uniqueVerifiers.size));
  const isVerified = uniqueVerifiers.size >= 2;
  return {
    count: effectiveCount,
    isVerified,
    label: isVerified ? '2/2 Verified' : '1/2',
    disputed: (record.disputed_by || []).length > 0 && !isVerified,
  };
}

/**
 * Upgrade 6: Computes overall Lineage Trust Score (% of recorded facts that are 2/2 Verified).
 */
export function computeLineageTrustScore(
  allPersons: Person[],
  allRelationships: Relationship[],
  verificationMap: Record<string, VerificationRecord>
): LineageTrustScore {
  const activePersons = allPersons.filter((p) => !p.is_archived);
  const factIds: string[] = [];

  for (const p of activePersons) {
    if (p.birth_date) factIds.push(buildFactId('person', p.id, 'birth_date'));
    if (p.birth_place) factIds.push(buildFactId('person', p.id, 'birth_place'));
    if (p.alias) factIds.push(buildFactId('person', p.id, 'alias'));
    if (!p.is_living || p.death_date) factIds.push(buildFactId('person', p.id, 'is_living'));
  }

  const seenRel = new Set<string>();
  for (const r of allRelationships) {
    if (r.relationship_type === 'spouse') {
      const k = `sp:${[r.person_id, r.related_person_id].sort().join('<->')}`;
      if (seenRel.has(k)) continue;
      seenRel.add(k);
    }
    factIds.push(buildFactId('relationship', r.id, 'relationship'));
  }

  if (factIds.length === 0) {
    return { verifiedCount: 0, totalFacts: 0, percentage: 100 };
  }

  let verifiedCount = 0;
  for (const fid of factIds) {
    if (getVerificationBadgeInfo(verificationMap[fid]).isVerified) {
      verifiedCount++;
    }
  }

  return {
    verifiedCount,
    totalFacts: factIds.length,
    percentage: Math.round((verifiedCount / factIds.length) * 100),
  };
}

export const verificationApi = {
  getAllMap: async (): Promise<ApiResponse<Record<string, VerificationRecord>>> => {
    const map: Record<string, VerificationRecord> = {};

    if (isBrowserRuntime()) {
      const db = getDb();
      const snapshot = await getDocs(collection(db, 'verifications'));
      for (const d of snapshot.docs) {
        const rec = d.data() as VerificationRecord;
        map[rec.fact_id || d.id] = rec;
      }
    } else {
      for (const [k, v] of getTestStore().entries()) {
        map[k] = v;
      }
    }

    return { success: true, data: map, error: null };
  },

  recordAuthorEntry: async (params: {
    entityType: 'person' | 'relationship';
    entityId: string;
    field: VerifiableField;
    authorId: string | null;
  }): Promise<ApiResponse<VerificationRecord>> => {
    const factId = buildFactId(params.entityType, params.entityId, params.field);
    const now = new Date().toISOString();
    const record: VerificationRecord = {
      fact_id: factId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      field: params.field,
      recorded_by: params.authorId || null,
      verifiers: params.authorId ? [params.authorId] : ['initial_seed'],
      disputed_by: [],
      suggested_corrections: [],
      updated_at: now,
    };

    if (isBrowserRuntime()) {
      const db = getDb();
      await setDoc(doc(db, 'verifications', factId), record);
    } else {
      getTestStore().set(factId, record);
    }

    return { success: true, data: record, error: null };
  },

  submitAnswer: async (params: {
    factId: string;
    entityType: 'person' | 'relationship';
    entityId: string;
    field: VerifiableField;
    recordedBy: string | null;
    viewerId: string;
    action: 'confirm' | 'reject' | 'skip' | 'fill';
    suggestedValue?: string;
  }): Promise<ApiResponse<VerificationRecord>> => {
    // Rule (c): The author who recorded the data cannot verify their own entry
    if (params.action === 'confirm' && params.recordedBy && params.recordedBy === params.viewerId) {
      return {
        success: false,
        data: null,
        error: {
          code: 'SELF_VERIFICATION_FORBIDDEN',
          message: 'The member who recorded this information cannot verify it themselves.',
        },
      };
    }

    const now = new Date().toISOString();

    // Upgrade 3: Fill-in-the-blank submission for missing DOB or Birth Place
    if (params.action === 'fill' && params.suggestedValue?.trim() && params.entityType === 'person') {
      const val = params.suggestedValue.trim();
      if (params.field === 'birth_date' || params.field === 'birth_place' || params.field === 'alias') {
        await personApi.update(params.entityId, { [params.field]: val } as any);
      }
      return verificationApi.recordAuthorEntry({
        entityType: 'person',
        entityId: params.entityId,
        field: params.field,
        authorId: params.viewerId,
      });
    }

    let existing: VerificationRecord | null = null;
    if (isBrowserRuntime()) {
      const db = getDb();
      const snap = await getDoc(doc(db, 'verifications', params.factId));
      if (snap.exists()) {
        existing = snap.data() as VerificationRecord;
      }
    } else {
      existing = getTestStore().get(params.factId) || null;
    }

    const base: VerificationRecord = existing || {
      fact_id: params.factId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      field: params.field,
      recorded_by: params.recordedBy || null,
      verifiers: params.recordedBy ? [params.recordedBy] : ['initial_seed'],
      disputed_by: [],
      suggested_corrections: [],
      updated_at: now,
    };

    const verifiers = new Set(base.verifiers || []);
    const disputed = new Set(base.disputed_by || []);
    const suggestions = [...(base.suggested_corrections || [])];

    if (params.action === 'confirm') {
      verifiers.add(params.viewerId);
      disputed.delete(params.viewerId);
    } else if (params.action === 'reject') {
      disputed.add(params.viewerId);
      if (params.suggestedValue && params.suggestedValue.trim()) {
        suggestions.push({
          by: params.viewerId,
          value: params.suggestedValue.trim(),
          at: now,
        });
      }
    }

    const updated: VerificationRecord = {
      ...base,
      verifiers: Array.from(verifiers),
      disputed_by: Array.from(disputed),
      suggested_corrections: suggestions,
      updated_at: now,
    };

    if (isBrowserRuntime()) {
      const db = getDb();
      await setDoc(doc(db, 'verifications', params.factId), updated);
    } else {
      getTestStore().set(params.factId, updated);
    }

    return { success: true, data: updated, error: null };
  },
};
