import { request } from './apiClient';
import { ApiResponse } from '../types/api';
import { Person, CreatePersonInput, UpdatePersonInput } from '../types/person';

export interface HealthCheckData {
  status: string;
  timestamp: string;
  service: string;
}

export const personApi = {
  checkHealth: (): Promise<ApiResponse<HealthCheckData>> => {
    return request<HealthCheckData>('/health');
  },

  getAll: (params?: { search?: string; includeArchived?: boolean }): Promise<ApiResponse<Person[]>> => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.includeArchived) query.set('includeArchived', 'true');
    const queryString = query.toString();
    return request<Person[]>(`/persons${queryString ? `?${queryString}` : ''}`);
  },

  getById: (id: string, params?: { includeArchived?: boolean }): Promise<ApiResponse<Person>> => {
    const query = params?.includeArchived ? '?includeArchived=true' : '';
    return request<Person>(`/persons/${id}${query}`);
  },

  create: (data: CreatePersonInput): Promise<ApiResponse<Person>> => {
    return request<Person>('/persons', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (id: string, data: UpdatePersonInput): Promise<ApiResponse<Person>> => {
    return request<Person>(`/persons/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  archive: (id: string): Promise<ApiResponse<Person>> => {
    return request<Person>(`/persons/${id}/archive`, {
      method: 'POST',
    });
  },

  restore: (id: string): Promise<ApiResponse<Person>> => {
    return request<Person>(`/persons/${id}/restore`, {
      method: 'POST',
    });
  },

  getRelatives: (
    id: string,
    params?: { type?: import('../types/relative').RelativeCategory | 'all'; includeArchived?: boolean }
  ): Promise<ApiResponse<import('../types/relative').DerivedRelativesResponse>> => {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.includeArchived) query.set('includeArchived', 'true');
    const queryString = query.toString();
    return request<import('../types/relative').DerivedRelativesResponse>(
      `/persons/${id}/relatives${queryString ? `?${queryString}` : ''}`
    );
  },

  getRelationshipTo: (
    id: string,
    targetId: string
  ): Promise<ApiResponse<import('../types/relative').PerspectiveRelationshipResult>> => {
    return request<import('../types/relative').PerspectiveRelationshipResult>(
      `/persons/${id}/relationship-to/${targetId}`
    );
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
