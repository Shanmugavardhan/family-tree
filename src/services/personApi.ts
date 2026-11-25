import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { getDb, isBrowserRuntime } from './firebaseDb';
import { ApiResponse } from '../types/api';
import { Person, CreatePersonInput, UpdatePersonInput } from '../types/person';
import {
  DerivedRelativesResponse,
  PerspectiveRelationshipResult,
  RelativeCategory,
  RelativeItem,
} from '../types/relative';
import { relationshipApi } from './relationshipApi';
import { deriveRelationshipBetween } from '../utils/kinshipInference';

export interface HealthCheckData {
  status: string;
  timestamp: string;
  service: string;
}

// In-memory store used strictly in offline Node.js test environments (never in browser)
let testPersonsStore: Person[] | null = null;

async function getTestPersonsStore(): Promise<Person[]> {
  if (testPersonsStore) return testPersonsStore;
  try {
    const fs = await import('fs');
    const path = await import('path');
    const dataPath = path.resolve(process.cwd(), 'data/persons.json');
    const publicPath = path.resolve(process.cwd(), 'public/data/persons.json');
    const targetPath = fs.existsSync(dataPath) ? dataPath : publicPath;
    if (fs.existsSync(targetPath)) {
      const raw = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
      testPersonsStore = Array.isArray(raw) ? [...raw] : [...(raw.persons || [])];
      return testPersonsStore;
    }
  } catch {}
  testPersonsStore = [];
  return testPersonsStore;
}

export function resetTestPersonsStore(): void {
  testPersonsStore = null;
}

function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as Partial<T>;
}

export const personApi = {
  checkHealth: async (): Promise<ApiResponse<HealthCheckData>> => {
    return {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'family-tree-firestore',
      },
      error: null,
    };
  },

  getAll: async (params?: {
    search?: string;
    includeArchived?: boolean;
  }): Promise<ApiResponse<Person[]>> => {
    let list: Person[];

    if (isBrowserRuntime()) {
      const db = getDb();
      const snapshot = await getDocs(collection(db, 'persons'));
      list = snapshot.docs.map((d) => d.data() as Person);
    } else {
      list = [...(await getTestPersonsStore())];
    }

    if (!params?.includeArchived) {
      list = list.filter((p) => !p.is_archived);
    }
    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      list = list.filter((p) =>
        [p.first_name, p.middle_name, p.last_name, p.alias]
          .filter(Boolean)
          .some((val) => (val as string).toLowerCase().includes(q))
      );
    }

    return { success: true, data: list, error: null };
  },

  getById: async (
    id: string,
    params?: { includeArchived?: boolean }
  ): Promise<ApiResponse<Person>> => {
    let found: Person | null = null;

    if (isBrowserRuntime()) {
      const db = getDb();
      const snap = await getDoc(doc(db, 'persons', id));
      if (snap.exists()) {
        found = snap.data() as Person;
      }
    } else {
      const list = await getTestPersonsStore();
      found = list.find((p) => p.id === id) || null;
    }

    if (!found || (!params?.includeArchived && found.is_archived)) {
      return {
        success: false,
        data: null,
        error: { code: 'PERSON_NOT_FOUND', message: 'Person not found' },
      };
    }

    return { success: true, data: found, error: null };
  },

  create: async (data: CreatePersonInput): Promise<ApiResponse<Person>> => {
    const now = new Date().toISOString();
    const newPerson: Person = {
      id: crypto.randomUUID(),
      first_name: data.first_name,
      middle_name: data.middle_name || null,
      last_name: data.last_name || null,
      alias: data.alias || null,
      gender: data.gender,
      birth_date: data.birth_date || null,
      death_date: data.death_date || null,
      birth_place: data.birth_place || null,
      death_place: data.death_place || null,
      profile_photo: data.profile_photo || null,
      biography: data.biography || '',
      is_living: data.is_living ?? true,
      is_archived: false,
      created_at: now,
      updated_at: now,
      archived_at: null,
    };

    if (isBrowserRuntime()) {
      const db = getDb();
      await setDoc(doc(db, 'persons', newPerson.id), newPerson);
    } else {
      const list = await getTestPersonsStore();
      list.push(newPerson);
    }

    // Connect specified lineage relationships in DB
    if (data.father_id) {
      await relationshipApi.create({
        person_id: newPerson.id,
        related_person_id: data.father_id,
        relationship_type: 'parent',
        parent_type: 'biological',
      });
    }
    if (data.mother_id) {
      await relationshipApi.create({
        person_id: newPerson.id,
        related_person_id: data.mother_id,
        relationship_type: 'parent',
        parent_type: 'biological',
      });
    }
    if (data.spouse_id) {
      await relationshipApi.create({
        person_id: newPerson.id,
        related_person_id: data.spouse_id,
        relationship_type: 'spouse',
      });
    }
    if (data.child_id) {
      await relationshipApi.create({
        person_id: data.child_id,
        related_person_id: newPerson.id,
        relationship_type: 'parent',
        parent_type: 'biological',
      });
    }

    return { success: true, data: newPerson, error: null };
  },

  update: async (id: string, data: UpdatePersonInput): Promise<ApiResponse<Person>> => {
    const cleanPatch = stripUndefined({
      ...data,
      updated_at: new Date().toISOString(),
    });

    if (isBrowserRuntime()) {
      const db = getDb();
      const ref = doc(db, 'persons', id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        return {
          success: false,
          data: null,
          error: { code: 'PERSON_NOT_FOUND', message: 'Person not found' },
        };
      }
      await updateDoc(ref, cleanPatch as Record<string, any>);
      const updated: Person = { ...(snap.data() as Person), ...cleanPatch };
      return { success: true, data: updated, error: null };
    }

    const list = await getTestPersonsStore();
    const idx = list.findIndex((p) => p.id === id);
    if (idx < 0) {
      return {
        success: false,
        data: null,
        error: { code: 'PERSON_NOT_FOUND', message: 'Person not found' },
      };
    }
    const updated: Person = { ...list[idx], ...cleanPatch };
    list[idx] = updated;
    return { success: true, data: updated, error: null };
  },

  archive: async (id: string): Promise<ApiResponse<Person>> => {
    const now = new Date().toISOString();
    return personApi.update(id, {
      is_archived: true,
      archived_at: now,
    } as any);
  },

  restore: async (id: string): Promise<ApiResponse<Person>> => {
    return personApi.update(id, {
      is_archived: false,
      archived_at: null,
    } as any);
  },

  getRelatives: async (
    id: string,
    params?: { type?: RelativeCategory | 'all'; includeArchived?: boolean }
  ): Promise<ApiResponse<DerivedRelativesResponse>> => {
    const [personsRes, relsRes] = await Promise.all([
      personApi.getAll({ includeArchived: true }),
      relationshipApi.getAll(),
    ]);

    const allPersons = personsRes.data || [];
    const allRels = relsRes.data || [];
    const target = allPersons.find((p) => p.id === id);

    const relativesBuckets: DerivedRelativesResponse['relatives'] = {
      parents: [],
      children: [],
      spouses: [],
      siblings: [],
      grandparents: [],
      grandchildren: [],
      great_grandparents: [],
      uncles_aunts: [],
      nephews_nieces: [],
      cousins: [],
      first_cousins_once_removed: [],
      in_laws: [],
    };

    if (!target) {
      return {
        success: true,
        data: {
          person_id: id,
          target_person: { id, full_name: 'Unknown', gender: 'other' },
          relatives: relativesBuckets,
          total_count: 0,
        },
        error: null,
      };
    }

    let totalCount = 0;
    for (const other of allPersons) {
      if (other.id === id) continue;
      if (!params?.includeArchived && other.is_archived) continue;

      const derived = deriveRelationshipBetween(id, other.id, allPersons, allRels);
      if (
        derived.category === 'self' ||
        derived.category === 'unrelated' ||
        !relativesBuckets[derived.category]
      ) {
        continue;
      }

      if (params?.type && params.type !== 'all' && derived.category !== params.type) {
        continue;
      }

      const item: RelativeItem = {
        person_id: other.id,
        full_name: [other.first_name, other.middle_name, other.last_name]
          .filter(Boolean)
          .join(' '),
        relationship: derived.relationship,
        category: derived.category,
        gender: other.gender,
        is_living: other.is_living,
        is_archived: other.is_archived,
        profile_photo: other.profile_photo,
        lineage_type: derived.category === 'spouses' ? 'spouse' : 'biological',
        relationship_paths: derived.path || [],
      };
      relativesBuckets[derived.category].push(item);
      totalCount++;
    }

    return {
      success: true,
      data: {
        person_id: id,
        target_person: {
          id,
          full_name: [target.first_name, target.middle_name, target.last_name]
            .filter(Boolean)
            .join(' '),
          gender: target.gender,
        },
        relatives: relativesBuckets,
        total_count: totalCount,
      },
      error: null,
    };
  },

  getRelationshipTo: async (
    id: string,
    targetId: string
  ): Promise<ApiResponse<PerspectiveRelationshipResult>> => {
    const [personsRes, relsRes] = await Promise.all([
      personApi.getAll({ includeArchived: true }),
      relationshipApi.getAll(),
    ]);
    const allPersons = personsRes.data || [];
    const allRels = relsRes.data || [];

    const derived = deriveRelationshipBetween(id, targetId, allPersons, allRels);
    return {
      success: true,
      data: derived,
      error: null,
    };
  },

  uploadPhoto: async (
    id: string,
    file: File
  ): Promise<ApiResponse<{ profile_photo: string; person: Person }>> => {
    if (!file) {
      return {
        success: false,
        data: null,
        error: { code: 'INVALID_FILE', message: 'No file provided' },
      };
    }

    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const hasValidMime = file.type ? validMimes.includes(file.type.toLowerCase()) : false;
    const hasValidExt = file.name ? /\.(jpe?g|png|webp|gif)$/i.test(file.name) : false;

    if (!hasValidMime && !hasValidExt) {
      return {
        success: false,
        data: null,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'Only image files (JPEG, PNG, WebP) are allowed.',
        },
      };
    }

    const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_PHOTO_BYTES) {
      return {
        success: false,
        data: null,
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'Photo size cannot exceed 10MB.',
        },
      };
    }

    let photoDataUrl: string | null = null;
    try {
      if (typeof FileReader !== 'undefined') {
        photoDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else if (typeof (file as any).arrayBuffer === 'function') {
        const buf = Buffer.from(await (file as any).arrayBuffer());
        const mime = file.type || 'image/jpeg';
        photoDataUrl = `data:${mime};base64,${buf.toString('base64')}`;
      }
    } catch (err: any) {
      return {
        success: false,
        data: null,
        error: {
          code: 'PHOTO_READ_ERROR',
          message: err.message || 'Failed to read photo data',
        },
      };
    }

    if (!photoDataUrl) {
      return {
        success: false,
        data: null,
        error: {
          code: 'PHOTO_CONVERSION_FAILED',
          message: 'Could not generate photo data URL',
        },
      };
    }

    // Store directly in Cloud Firestore DB
    const updateRes = await personApi.update(id, { profile_photo: photoDataUrl });
    if (updateRes.success && updateRes.data) {
      return {
        success: true,
        data: {
          profile_photo: photoDataUrl,
          person: updateRes.data,
        },
        error: null,
      };
    }

    return {
      success: false,
      data: null,
      error: updateRes.error || {
        code: 'UPDATE_FAILED',
        message: 'Failed to update person with photo',
      },
    };
  },

  deletePhoto: async (
    id: string
  ): Promise<ApiResponse<{ deleted: boolean; person: Person }>> => {
    const updateRes = await personApi.update(id, { profile_photo: null });
    if (updateRes.success && updateRes.data) {
      return {
        success: true,
        data: {
          deleted: true,
          person: updateRes.data,
        },
        error: null,
      };
    }
    return {
      success: false,
      data: null,
      error: { code: 'PERSON_NOT_FOUND', message: 'Person not found' },
    };
  },

  getPhotoUrl: (id: string, _includeArchived = false): string => {
    return `/api/persons/${id}/photo`;
  },
};
