import { request } from './apiClient';
import { ApiResponse } from '../types/api';
import { Relationship, CreateRelationshipInput, UpdateRelationshipInput } from '../types/relationship';

const isLocal =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');

let cachedRelationships: Relationship[] | null = null;

async function loadStaticRelationships(): Promise<Relationship[]> {
  if (cachedRelationships) return cachedRelationships;
  try {
    const res = await fetch('/data/relationships.json');
    if (res.ok) {
      const data = await res.json();
      cachedRelationships = Array.isArray(data) ? data : (data.relationships || []);
      return cachedRelationships!;
    }
  } catch (err) {
    console.error('Failed to load static relationships:', err);
  }
  return [];
}

export const relationshipApi = {
  getAll: async (params?: { personId?: string; relationshipType?: string }): Promise<ApiResponse<Relationship[]>> => {
    if (isLocal) {
      const query = new URLSearchParams();
      if (params?.personId) query.set('personId', params.personId);
      if (params?.relationshipType) query.set('relationshipType', params.relationshipType);
      const queryString = query.toString();
      const res = await request<Relationship[]>(`/relationships${queryString ? `?${queryString}` : ''}`);
      if (res.success && res.data) return res;
    }

    let list = await loadStaticRelationships();
    if (params?.personId) {
      list = list.filter((r) => r.person_id === params.personId || r.related_person_id === params.personId);
    }
    if (params?.relationshipType) {
      list = list.filter((r) => r.relationship_type === params.relationshipType);
    }
    return { success: true, data: list, error: null };
  },

  getById: async (id: string): Promise<ApiResponse<Relationship>> => {
    if (isLocal) {
      const res = await request<Relationship>(`/relationships/${id}`);
      if (res.success && res.data) return res;
    }

    const list = await loadStaticRelationships();
    const found = list.find((r) => r.id === id);
    if (!found) {
      return { success: false, data: null, error: { code: 'RELATIONSHIP_NOT_FOUND', message: 'Relationship not found' } };
    }
    return { success: true, data: found, error: null };
  },

  create: async (data: CreateRelationshipInput): Promise<ApiResponse<Relationship>> => {
    if (isLocal) {
      return request<Relationship>('/relationships', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }

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
    if (cachedRelationships) {
      cachedRelationships.push(newRel);
    }
    return { success: true, data: newRel, error: null };
  },

  update: async (id: string, data: UpdateRelationshipInput): Promise<ApiResponse<Relationship>> => {
    if (isLocal) {
      return request<Relationship>(`/relationships/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    }

    const list = await loadStaticRelationships();
    const found = list.find((r) => r.id === id);
    if (!found) {
      return { success: false, data: null, error: { code: 'RELATIONSHIP_NOT_FOUND', message: 'Relationship not found' } };
    }
    Object.assign(found, data);
    return { success: true, data: found, error: null };
  },

  delete: async (id: string): Promise<ApiResponse<{ deleted: true; id: string }>> => {
    if (isLocal) {
      return request<{ deleted: true; id: string }>(`/relationships/${id}`, {
        method: 'DELETE',
      });
    }

    if (cachedRelationships) {
      cachedRelationships = cachedRelationships.filter((r) => r.id !== id);
    }
    return { success: true, data: { deleted: true, id }, error: null };
  },
};

