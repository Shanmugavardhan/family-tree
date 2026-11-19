import { request } from './apiClient';
import { ApiResponse } from '../types/api';
import { Person, CreatePersonInput, UpdatePersonInput } from '../types/person';

export interface HealthCheckData {
  status: string;
  timestamp: string;
  service: string;
}

const isLocal =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');

let cachedPersons: Person[] | null = null;
let cachedRelatives: Record<string, any> | null = null;

async function loadStaticPersons(): Promise<Person[]> {
  if (cachedPersons) return cachedPersons;
  try {
    const res = await fetch('/data/persons.json');
    if (res.ok) {
      const data = await res.json();
      cachedPersons = Array.isArray(data) ? data : (data.persons || []);
      return cachedPersons!;
    }
  } catch (err) {
    console.error('Failed to load static persons:', err);
  }
  return [];
}

async function loadStaticRelatives(): Promise<Record<string, any>> {
  if (cachedRelatives) return cachedRelatives;
  try {
    const res = await fetch('/data/relatives.json');
    if (res.ok) {
      cachedRelatives = await res.json();
      return cachedRelatives!;
    }
  } catch (err) {
    console.error('Failed to load static relatives:', err);
  }
  return {};
}

export const personApi = {
  checkHealth: async (): Promise<ApiResponse<HealthCheckData>> => {
    if (isLocal) {
      return request<HealthCheckData>('/health');
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
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      if (params?.includeArchived) query.set('includeArchived', 'true');
      const queryString = query.toString();
      const res = await request<Person[]>(`/persons${queryString ? `?${queryString}` : ''}`);
      if (res.success && res.data) return res;
    }

    const list = await loadStaticPersons();
    let filtered = list;
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
      const query = params?.includeArchived ? '?includeArchived=true' : '';
      const res = await request<Person>(`/persons/${id}${query}`);
      if (res.success && res.data) return res;
    }

    const list = await loadStaticPersons();
    const found = list.find((p) => p.id === id);
    if (!found) {
      return { success: false, data: null, error: { code: 'PERSON_NOT_FOUND', message: 'Person not found' } };
    }
    return { success: true, data: found, error: null };
  },

  create: async (data: CreatePersonInput): Promise<ApiResponse<Person>> => {
    if (isLocal) {
      return request<Person>('/persons', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }

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
      profile_photo: null,
      biography: data.biography || '',
      is_living: data.is_living ?? true,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
    };
    if (cachedPersons) {
      cachedPersons.push(newPerson);
    }
    return { success: true, data: newPerson, error: null };
  },

  update: async (id: string, data: UpdatePersonInput): Promise<ApiResponse<Person>> => {
    if (isLocal) {
      return request<Person>(`/persons/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    }

    const list = await loadStaticPersons();
    const found = list.find((p) => p.id === id);
    if (!found) {
      return { success: false, data: null, error: { code: 'PERSON_NOT_FOUND', message: 'Person not found' } };
    }
    Object.assign(found, data, { updated_at: new Date().toISOString() });
    return { success: true, data: found, error: null };
  },

  archive: async (id: string): Promise<ApiResponse<Person>> => {
    if (isLocal) {
      return request<Person>(`/persons/${id}/archive`, {
        method: 'POST',
      });
    }
    const list = await loadStaticPersons();
    const found = list.find((p) => p.id === id);
    if (found) {
      found.is_archived = true;
      found.archived_at = new Date().toISOString();
      return { success: true, data: found, error: null };
    }
    return { success: false, data: null, error: { code: 'PERSON_NOT_FOUND', message: 'Person not found' } };
  },

  restore: async (id: string): Promise<ApiResponse<Person>> => {
    if (isLocal) {
      return request<Person>(`/persons/${id}/restore`, {
        method: 'POST',
      });
    }
    const list = await loadStaticPersons();
    const found = list.find((p) => p.id === id);
    if (found) {
      found.is_archived = false;
      found.archived_at = null;
      return { success: true, data: found, error: null };
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

    const map = await loadStaticRelatives();
    const fromMap = map[id];
    const rel = fromMap?.all_relationships?.[targetId];
    const toMap = map[targetId];
    const revRel = toMap?.all_relationships?.[id];

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
        relationship: rel?.relationship || 'Unrelated',
        reverse_relationship: revRel?.relationship || 'Unrelated',
        category: rel?.category || 'unrelated',
        path: rel?.path || [],
      },
      error: null,
    };
  },

  uploadPhoto: async (
    id: string,
    file: File
  ): Promise<ApiResponse<{ profile_photo: string; person: Person }>> => {
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const response = await fetch(`/api/persons/${id}/photo`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        data: null,
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Failed to upload photo',
        },
      };
    }
  },

  deletePhoto: (id: string): Promise<ApiResponse<{ deleted: boolean; person: Person }>> => {
    return request<{ deleted: boolean; person: Person }>(`/persons/${id}/photo`, {
      method: 'DELETE',
    });
  },

  getPhotoUrl: (id: string, includeArchived = false): string => {
    return `/api/persons/${id}/photo${includeArchived ? '?includeArchived=true' : ''}`;
  },
};
