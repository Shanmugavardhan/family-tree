import { request } from './apiClient';
import { ApiResponse } from '../types/api';
import { Person, CreatePersonInput, UpdatePersonInput } from '../types/person';
import { relationshipApi } from './relationshipApi';
import { deriveRelationshipBetween } from '../utils/kinshipInference';

export interface HealthCheckData {
  status: string;
  timestamp: string;
  service: string;
}

const isLocal =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');

export const LOCAL_CUSTOM_PERSONS_KEY = 'family_tree_custom_persons';

export function getLocalCustomPersons(): Person[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOM_PERSONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveLocalCustomPerson(person: Person): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getLocalCustomPersons();
    const idx = list.findIndex((p) => p.id === person.id);
    if (idx >= 0) {
      list[idx] = person;
    } else {
      list.push(person);
    }
    localStorage.setItem(LOCAL_CUSTOM_PERSONS_KEY, JSON.stringify(list));
  } catch {}
}

let cachedPersons: Person[] | null = null;
let cachedRelatives: Record<string, any> | null = null;

async function loadStaticPersons(): Promise<Person[]> {
  if (cachedPersons) return cachedPersons;
  // Node.js test environment support
  if (typeof window !== 'undefined' && !window.location.origin && typeof process !== 'undefined') {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(process.cwd(), 'public/data/persons.json');
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        cachedPersons = Array.isArray(data) ? data : (data.persons || []);
        return cachedPersons!;
      }
    } catch {}
  }
  try {
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    const res = await fetch(`${origin}/data/persons.json?v=${Date.now()}`, { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      cachedPersons = Array.isArray(data) ? data : (data.persons || []);
      return cachedPersons!;
    }
  } catch (err) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(process.cwd(), 'public/data/persons.json');
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        cachedPersons = Array.isArray(data) ? data : (data.persons || []);
        return cachedPersons!;
      }
    } catch {}
    console.error('Failed to load static persons:', err);
  }
  return [];
}

async function loadStaticRelatives(): Promise<Record<string, any>> {
  if (cachedRelatives) return cachedRelatives;
  // Node.js test environment support
  if (typeof window !== 'undefined' && !window.location.origin && typeof process !== 'undefined') {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(process.cwd(), 'public/data/relatives.json');
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        cachedRelatives = JSON.parse(raw);
        return cachedRelatives!;
      }
    } catch {}
  }
  try {
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    const res = await fetch(`${origin}/data/relatives.json?v=${Date.now()}`, { cache: 'no-cache' });
    if (res.ok) {
      cachedRelatives = await res.json();
      return cachedRelatives!;
    }
  } catch (err) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(process.cwd(), 'public/data/relatives.json');
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        cachedRelatives = JSON.parse(raw);
        return cachedRelatives!;
      }
    } catch {}
    console.error('Failed to load static relatives:', err);
  }
  return {};
}

export const personApi = {
  checkHealth: async (): Promise<ApiResponse<HealthCheckData>> => {
    if (isLocal) {
      try {
        const res = await request<HealthCheckData>('/health');
        if (res.success && res.data) return res;
      } catch {}
    }
    return {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'family-tree-static',
      },
      error: null,
    };
  },

  getAll: async (params?: { search?: string; includeArchived?: boolean }): Promise<ApiResponse<Person[]>> => {
    if (isLocal) {
      try {
        const query = new URLSearchParams();
        if (params?.search) query.set('search', params.search);
        if (params?.includeArchived) query.set('includeArchived', 'true');
        const queryString = query.toString();
        const res = await request<Person[]>(`/persons${queryString ? `?${queryString}` : ''}`);
        if (res.success && res.data) return res;
      } catch {}
    }

    const list = await loadStaticPersons();
    const localList = getLocalCustomPersons();
    const mergedMap = new Map<string, Person>();
    for (const p of list) mergedMap.set(p.id, p);
    for (const p of localList) mergedMap.set(p.id, p);
    let filtered = Array.from(mergedMap.values());

    if (!params?.includeArchived) {
      filtered = filtered.filter((p) => !p.is_archived);
    }
    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      filtered = filtered.filter((p) =>
        [p.first_name, p.middle_name, p.last_name, p.alias]
          .filter(Boolean)
          .some((val) => (val as string).toLowerCase().includes(q))
      );
    }
    return { success: true, data: filtered, error: null };
  },

  getById: async (id: string, params?: { includeArchived?: boolean }): Promise<ApiResponse<Person>> => {
    if (isLocal) {
      try {
        const query = params?.includeArchived ? '?includeArchived=true' : '';
        const res = await request<Person>(`/persons/${id}${query}`);
        if (res.success && res.data) return res;
      } catch {}
    }

    const list = await loadStaticPersons();
    const localList = getLocalCustomPersons();
    const found = localList.find((p) => p.id === id) || list.find((p) => p.id === id);
    if (!found) {
      return { success: false, data: null, error: { code: 'PERSON_NOT_FOUND', message: 'Person not found' } };
    }
    return { success: true, data: found, error: null };
  },

  create: async (data: CreatePersonInput): Promise<ApiResponse<Person>> => {
    let serverPerson: Person | null = null;
    if (isLocal) {
      try {
        const res = await request<Person>('/persons', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        if (res.success && res.data) {
          serverPerson = res.data;
        }
      } catch {}
    }

    const newPerson: Person = serverPerson || {
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
    };

    saveLocalCustomPerson(newPerson);
    if (cachedPersons) {
      const idx = cachedPersons.findIndex((p) => p.id === newPerson.id);
      if (idx >= 0) cachedPersons[idx] = newPerson;
      else cachedPersons.push(newPerson);
    }

    // Connect specified lineage relationships
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
    let serverPerson: Person | null = null;
    if (isLocal) {
      try {
        const res = await request<Person>(`/persons/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
        if (res.success && res.data) {
          serverPerson = res.data;
        }
      } catch {}
    }

    const list = await loadStaticPersons();
    const localList = getLocalCustomPersons();
    const found = localList.find((p) => p.id === id) || list.find((p) => p.id === id);
    if (!found && !serverPerson) {
      return { success: false, data: null, error: { code: 'PERSON_NOT_FOUND', message: 'Person not found' } };
    }

    const updated: Person = serverPerson || {
      ...found!,
      ...data,
      updated_at: new Date().toISOString(),
    };

    saveLocalCustomPerson(updated);

    if (cachedPersons) {
      const idx = cachedPersons.findIndex((p) => p.id === id);
      if (idx >= 0) cachedPersons[idx] = updated;
      else cachedPersons.push(updated);
    }

    return { success: true, data: updated, error: null };
  },

  archive: async (id: string): Promise<ApiResponse<Person>> => {
    let serverPerson: Person | null = null;
    if (isLocal) {
      try {
        const res = await request<Person>(`/persons/${id}/archive`, {
          method: 'POST',
        });
        if (res.success && res.data) {
          serverPerson = res.data;
        }
      } catch {}
    }

    const list = await loadStaticPersons();
    const localList = getLocalCustomPersons();
    const found = localList.find((p) => p.id === id) || list.find((p) => p.id === id);
    if (found || serverPerson) {
      const updated: Person = serverPerson || {
        ...found!,
        is_archived: true,
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      saveLocalCustomPerson(updated);
      if (cachedPersons) {
        const idx = cachedPersons.findIndex((p) => p.id === id);
        if (idx >= 0) cachedPersons[idx] = updated;
      }
      return { success: true, data: updated, error: null };
    }
    return { success: false, data: null, error: { code: 'PERSON_NOT_FOUND', message: 'Person not found' } };
  },

  restore: async (id: string): Promise<ApiResponse<Person>> => {
    let serverPerson: Person | null = null;
    if (isLocal) {
      try {
        const res = await request<Person>(`/persons/${id}/restore`, {
          method: 'POST',
        });
        if (res.success && res.data) {
          serverPerson = res.data;
        }
      } catch {}
    }

    const list = await loadStaticPersons();
    const localList = getLocalCustomPersons();
    const found = localList.find((p) => p.id === id) || list.find((p) => p.id === id);
    if (found || serverPerson) {
      const updated: Person = serverPerson || {
        ...found!,
        is_archived: false,
        archived_at: null,
        updated_at: new Date().toISOString(),
      };
      saveLocalCustomPerson(updated);
      if (cachedPersons) {
        const idx = cachedPersons.findIndex((p) => p.id === id);
        if (idx >= 0) cachedPersons[idx] = updated;
      }
      return { success: true, data: updated, error: null };
    }
    return { success: false, data: null, error: { code: 'PERSON_NOT_FOUND', message: 'Person not found' } };
  },

  getRelatives: async (
    id: string,
    params?: { type?: import('../types/relative').RelativeCategory | 'all'; includeArchived?: boolean }
  ): Promise<ApiResponse<import('../types/relative').DerivedRelativesResponse>> => {
    if (isLocal) {
      const query = new URLSearchParams();
      if (params?.type) query.set('type', params.type);
      if (params?.includeArchived) query.set('includeArchived', 'true');
      const queryString = query.toString();
      const res = await request<import('../types/relative').DerivedRelativesResponse>(
        `/persons/${id}/relatives${queryString ? `?${queryString}` : ''}`
      );
      if (res.success && res.data) return res;
    }

    const map = await loadStaticRelatives();
    if (map[id]) {
      return { success: true, data: map[id], error: null };
    }
    const list = await loadStaticPersons();
    const person = list.find((p) => p.id === id);
    return {
      success: true,
      data: {
        person_id: id,
        target_person: {
          id,
          full_name: person ? [person.first_name, person.last_name].filter(Boolean).join(' ') : 'Unknown',
          gender: person?.gender || 'other',
        },
        relatives: {
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
        },
        total_count: 0,
      },
      error: null,
    };
  },

  getRelationshipTo: async (
    id: string,
    targetId: string
  ): Promise<ApiResponse<import('../types/relative').PerspectiveRelationshipResult>> => {
    if (isLocal) {
      const res = await request<import('../types/relative').PerspectiveRelationshipResult>(
        `/persons/${id}/relationship-to/${targetId}`
      );
      if (res.success && res.data) return res;
    }

    // Check if custom persons or relationships exist in local storage
    const customPersons = getLocalCustomPersons();
    const hasCustomPerson = customPersons.some((p) => p.id === id || p.id === targetId);

    // Try static relatives map only if neither person is custom
    if (!hasCustomPerson) {
      const map = await loadStaticRelatives();
      const fromMap = map[id];
      const rel = fromMap?.all_relationships?.[targetId];
      const toMap = map[targetId];
      const revRel = toMap?.all_relationships?.[id];

      if (rel && revRel && rel.category !== 'unrelated') {
        const list = await loadStaticPersons();
        const p1 = list.find((p) => p.id === id);
        const p2 = list.find((p) => p.id === targetId);

        return {
          success: true,
          data: {
            from_person: {
              id,
              full_name: p1 ? [p1.first_name, p1.last_name].filter(Boolean).join(' ') : 'Unknown',
              gender: p1?.gender || 'other',
            },
            to_person: {
              id: targetId,
              full_name: p2 ? [p2.first_name, p2.last_name].filter(Boolean).join(' ') : 'Unknown',
              gender: p2?.gender || 'other',
            },
            relationship: rel.relationship,
            reverse_relationship: revRel.relationship,
            category: rel.category,
            path: rel.path || [],
          },
          error: null,
        };
      }
    }

    // Dynamic derivation across combined graph (static database + custom local persons/relationships)
    const personsRes = await personApi.getAll({ includeArchived: true });
    const relsRes = await relationshipApi.getAll();
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
    // 1. Sanity check: file existence & type validation
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

    // 2. Sanity check: file size limit (10MB max)
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

    if (isLocal) {
      try {
        const formData = new FormData();
        formData.append('photo', file);
        const response = await fetch(`/api/persons/${id}/photo`, {
          method: 'POST',
          body: formData,
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            saveLocalCustomPerson(data.data.person);
            return data;
          }
        }
      } catch {}
    }

    // 3. Fallback / Client-side persistence: convert to Base64 Data URL
    let photoDataUrl: string | null = null;
    if (!photoDataUrl) {
      try {
        if (typeof FileReader !== 'undefined') {
          photoDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        } else if (typeof (file as any).arrayBuffer === 'function') {
          // Node.js test environment support
          const buf = Buffer.from(await (file as any).arrayBuffer());
          const mime = file.type || 'image/png';
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
    }

    if (!photoDataUrl) {
      return {
        success: false,
        data: null,
        error: { code: 'PHOTO_CONVERSION_FAILED', message: 'Could not generate photo data URL' },
      };
    }

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
      error: updateRes.error || { code: 'UPDATE_FAILED', message: 'Failed to update person with photo' },
    };
  },

  deletePhoto: async (id: string): Promise<ApiResponse<{ deleted: boolean; person: Person }>> => {
    if (isLocal) {
      try {
        const res = await request<{ deleted: boolean; person: Person }>(`/persons/${id}/photo`, {
          method: 'DELETE',
        });
        if (res.success && res.data) {
          saveLocalCustomPerson(res.data.person);
          return res;
        }
      } catch {}
    }

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

  getPhotoUrl: (id: string, includeArchived = false): string => {
    return `/api/persons/${id}/photo${includeArchived ? '?includeArchived=true' : ''}`;
  },
};
