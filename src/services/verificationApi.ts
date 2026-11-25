import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { getDb, isBrowserRuntime } from './firebaseDb';
import { ApiResponse } from '../types/api';
import {
  VerifiableField,
  VerificationBadgeInfo,
  VerificationRecord,
} from '../types/verification';

// In-memory store used strictly in offline Node.js test environments
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
  // Initial author/seed counts as 1/2; 2+ distinct verifiers = 2/2 Verified
  const effectiveCount = Math.max(1, Math.min(2, uniqueVerifiers.size));
  const isVerified = uniqueVerifiers.size >= 2;
  return {
    count: effectiveCount,
    isVerified,
    label: isVerified ? '2/2 Verified' : '1/2',
    disputed: (record.disputed_by || []).length > 0 && !isVerified,
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
    action: 'confirm' | 'reject' | 'skip';
  }): Promise<ApiResponse<VerificationRecord>> => {
    // Rule (c): The author who recorded the data cannot verify their own entry
    if (params.recordedBy && params.recordedBy === params.viewerId) {
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
      updated_at: now,
    };

    const verifiers = new Set(base.verifiers || []);
    const disputed = new Set(base.disputed_by || []);

    if (params.action === 'confirm') {
      verifiers.add(params.viewerId);
      disputed.delete(params.viewerId);
    } else if (params.action === 'reject') {
      disputed.add(params.viewerId);
    }

    const updated: VerificationRecord = {
      ...base,
      verifiers: Array.from(verifiers),
      disputed_by: Array.from(disputed),
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
