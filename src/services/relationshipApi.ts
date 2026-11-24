import { request } from './apiClient';
import { ApiResponse } from '../types/api';
import { Relationship, CreateRelationshipInput, UpdateRelationshipInput } from '../types/relationship';

const isLocal =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');

let cachedRelationships: Relationship[] | null = null;

export const LOCAL_CUSTOM_RELATIONSHIPS_KEY = 'family_tree_custom_relationships';

export function getLocalCustomRelationships(): Relationship[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOM_RELATIONSHIPS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function deleteLocalCustomRelationship(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getLocalCustomRelationships();
    const filtered = list.filter((r) => r.id !== id);
    localStorage.setItem(LOCAL_CUSTOM_RELATIONSHIPS_KEY, JSON.stringify(filtered));
  } catch {}
}

export function saveLocalCustomRelationship(rel: Relationship): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getLocalCustomRelationships();
    const idx = list.findIndex((r) => r.id === rel.id);
    if (idx >= 0) {
      list[idx] = rel;
    } else {
      list.push(rel);
    }
    localStorage.setItem(LOCAL_CUSTOM_RELATIONSHIPS_KEY, JSON.stringify(list));
  } catch {}
}

async function loadStaticRelationships(): Promise<Relationship[]> {
  if (cachedRelationships) return cachedRelationships;
  // Node.js test environment support
  if (typeof window !== 'undefined' && !window.location.origin && typeof process !== 'undefined') {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(process.cwd(), 'public/data/relationships.json');
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        cachedRelationships = Array.isArray(data) ? data : (data.relationships || []);
        return cachedRelationships!;
      }
    } catch {}
  }
  try {
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    const res = await fetch(`${origin}/data/relationships.json?v=${Date.now()}`, { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      cachedRelationships = Array.isArray(data) ? data : (data.relationships || []);
      return cachedRelationships!;
    }
  } catch (err) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(process.cwd(), 'public/data/relationships.json');
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        cachedRelationships = Array.isArray(data) ? data : (data.relationships || []);
        return cachedRelationships!;
      }
    } catch {}
    console.error('Failed to load static relationships:', err);
  }
  return [];
}

export const relationshipApi = {
  getAll: async (params?: { personId?: string; relationshipType?: string }): Promise<ApiResponse<Relationship[]>> => {
    if (isLocal) {
      try {
        const query = new URLSearchParams();
        if (params?.personId) query.set('personId', params.personId);
        if (params?.relationshipType) query.set('relationshipType', params.relationshipType);
        const queryString = query.toString();
        const res = await request<Relationship[]>(`/relationships${queryString ? `?${queryString}` : ''}`);
        if (res.success && res.data) return res;
      } catch {}
    }

    const staticList = await loadStaticRelationships();
    const localList = getLocalCustomRelationships();
    const map = new Map<string, Relationship>();
    for (const r of staticList) map.set(r.id, r);
    for (const r of localList) map.set(r.id, r);
    let list = Array.from(map.values());

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
      try {
        const res = await request<Relationship>(`/relationships/${id}`);
        if (res.success && res.data) return res;
      } catch {}
    }

    const staticList = await loadStaticRelationships();
    const localList = getLocalCustomRelationships();
    const found = localList.find((r) => r.id === id) || staticList.find((r) => r.id === id);
    if (!found) {
      return { success: false, data: null, error: { code: 'RELATIONSHIP_NOT_FOUND', message: 'Relationship not found' } };
    }
    return { success: true, data: found, error: null };
  },

  create: async (data: CreateRelationshipInput): Promise<ApiResponse<Relationship>> => {
    let serverRel: Relationship | null = null;
    if (isLocal) {
      try {
        const res = await request<Relationship>('/relationships', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        if (res.success && res.data) {
          serverRel = res.data;
        }
      } catch {}
    }

    const newRel: Relationship = serverRel || {
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

    saveLocalCustomRelationship(newRel);
    if (cachedRelationships) {
      const idx = cachedRelationships.findIndex((r) => r.id === newRel.id);
      if (idx >= 0) cachedRelationships[idx] = newRel;
      else cachedRelationships.push(newRel);
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
      try {
        const res = await request<{ deleted: true; id: string }>(`/relationships/${id}`, {
          method: 'DELETE',
        });
        if (res.success && res.data) return res;
      } catch {}
    }

    deleteLocalCustomRelationship(id);
    if (cachedRelationships) {
      cachedRelationships = cachedRelationships.filter((r) => r.id !== id);
    }
    return { success: true, data: { deleted: true, id }, error: null };
  },
};

