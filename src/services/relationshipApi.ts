import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { getDb, isBrowserRuntime } from './firebaseDb';
import { ApiResponse } from '../types/api';
import {
  Relationship,
  CreateRelationshipInput,
  UpdateRelationshipInput,
} from '../types/relationship';

// In-memory store used strictly in offline Node.js test environments (never in browser)
let testRelationshipsStore: Relationship[] | null = null;

async function getTestRelationshipsStore(): Promise<Relationship[]> {
  if (testRelationshipsStore) return testRelationshipsStore;
  try {
    const fs = await import('fs');
    const path = await import('path');
    const dataPath = path.resolve(process.cwd(), 'data/relationships.json');
    const publicPath = path.resolve(process.cwd(), 'public/data/relationships.json');
    const targetPath = fs.existsSync(dataPath) ? dataPath : publicPath;
    if (fs.existsSync(targetPath)) {
      const raw = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
      testRelationshipsStore = Array.isArray(raw) ? [...raw] : [...(raw.relationships || [])];
      return testRelationshipsStore;
    }
  } catch {}
  testRelationshipsStore = [];
  return testRelationshipsStore;
}

export function resetTestRelationshipsStore(): void {
  testRelationshipsStore = null;
}

export const relationshipApi = {
  getAll: async (params?: {
    personId?: string;
    relationshipType?: string;
  }): Promise<ApiResponse<Relationship[]>> => {
    let list: Relationship[];

    if (isBrowserRuntime()) {
      const db = getDb();
      const snapshot = await getDocs(collection(db, 'relationships'));
      list = snapshot.docs.map((d) => d.data() as Relationship);
    } else {
      list = [...(await getTestRelationshipsStore())];
    }

    if (params?.personId) {
      list = list.filter(
        (r) => r.person_id === params.personId || r.related_person_id === params.personId
      );
    }
    if (params?.relationshipType) {
      list = list.filter((r) => r.relationship_type === params.relationshipType);
    }

    return { success: true, data: list, error: null };
  },

  getById: async (id: string): Promise<ApiResponse<Relationship>> => {
    if (isBrowserRuntime()) {
      const db = getDb();
      const snap = await getDoc(doc(db, 'relationships', id));
      if (!snap.exists()) {
        return {
          success: false,
          data: null,
          error: { code: 'RELATIONSHIP_NOT_FOUND', message: 'Relationship not found' },
        };
      }
      return { success: true, data: snap.data() as Relationship, error: null };
    }

    const list = await getTestRelationshipsStore();
    const found = list.find((r) => r.id === id);
    if (!found) {
      return {
        success: false,
        data: null,
        error: { code: 'RELATIONSHIP_NOT_FOUND', message: 'Relationship not found' },
      };
    }
    return { success: true, data: found, error: null };
  },

  create: async (data: CreateRelationshipInput): Promise<ApiResponse<Relationship>> => {
    const newRel: Relationship = {
      id: crypto.randomUUID(),
      person_id: data.person_id,
      related_person_id: data.related_person_id,
      relationship_type: data.relationship_type,
      parent_type: data.parent_type || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      notes: data.notes || null,
      created_at: new Date().toISOString(),
    };

    if (isBrowserRuntime()) {
      const db = getDb();
      await setDoc(doc(db, 'relationships', newRel.id), newRel);
    } else {
      const list = await getTestRelationshipsStore();
      list.push(newRel);
    }

    return { success: true, data: newRel, error: null };
  },

  update: async (
    id: string,
    data: UpdateRelationshipInput
  ): Promise<ApiResponse<Relationship>> => {
    if (isBrowserRuntime()) {
      const db = getDb();
      const ref = doc(db, 'relationships', id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        return {
          success: false,
          data: null,
          error: { code: 'RELATIONSHIP_NOT_FOUND', message: 'Relationship not found' },
        };
      }
      await updateDoc(ref, data as Record<string, any>);
      const updated = { ...(snap.data() as Relationship), ...data };
      return { success: true, data: updated, error: null };
    }

    const list = await getTestRelationshipsStore();
    const found = list.find((r) => r.id === id);
    if (!found) {
      return {
        success: false,
        data: null,
        error: { code: 'RELATIONSHIP_NOT_FOUND', message: 'Relationship not found' },
      };
    }
    Object.assign(found, data);
    return { success: true, data: found, error: null };
  },

  delete: async (id: string): Promise<ApiResponse<{ deleted: true; id: string }>> => {
    if (isBrowserRuntime()) {
      const db = getDb();
      await deleteDoc(doc(db, 'relationships', id));
    } else {
      const list = await getTestRelationshipsStore();
      testRelationshipsStore = list.filter((r) => r.id !== id);
    }

    return { success: true, data: { deleted: true, id }, error: null };
  },
};
