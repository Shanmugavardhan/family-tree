import { request } from './apiClient';
import { ApiResponse } from '../types/api';
import { Relationship, CreateRelationshipInput, UpdateRelationshipInput } from '../types/relationship';

export const relationshipApi = {
  getAll: (params?: { personId?: string; relationshipType?: string }): Promise<ApiResponse<Relationship[]>> => {
    const query = new URLSearchParams();
    if (params?.personId) query.set('personId', params.personId);
    if (params?.relationshipType) query.set('relationshipType', params.relationshipType);
    const queryString = query.toString();
    return request<Relationship[]>(`/relationships${queryString ? `?${queryString}` : ''}`);
  },

  getById: (id: string): Promise<ApiResponse<Relationship>> => {
    return request<Relationship>(`/relationships/${id}`);
  },

  create: (data: CreateRelationshipInput): Promise<ApiResponse<Relationship>> => {
    return request<Relationship>('/relationships', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (id: string, data: UpdateRelationshipInput): Promise<ApiResponse<Relationship>> => {
    return request<Relationship>(`/relationships/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: (id: string): Promise<ApiResponse<{ deleted: true; id: string }>> => {
    return request<{ deleted: true; id: string }>(`/relationships/${id}`, {
      method: 'DELETE',
    });
  },
};

