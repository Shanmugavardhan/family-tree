import { request } from './apiClient';
import { ApiResponse } from '../types/api';
import { FamilyGraph, FamilyGraphNode, BuildGraphOptions } from '../types/graph';

export const graphApi = {
  getGraph: (options?: BuildGraphOptions): Promise<ApiResponse<FamilyGraph>> => {
    const query = new URLSearchParams();
    if (options?.includeArchived) {
      query.set('includeArchived', 'true');
    }
    const queryString = query.toString();
    return request<FamilyGraph>(`/graph${queryString ? `?${queryString}` : ''}`);
  },

  getNode: (personId: string, options?: BuildGraphOptions): Promise<ApiResponse<FamilyGraphNode>> => {
    const query = new URLSearchParams();
    if (options?.includeArchived) {
      query.set('includeArchived', 'true');
    }
    const queryString = query.toString();
    return request<FamilyGraphNode>(`/graph/nodes/${personId}${queryString ? `?${queryString}` : ''}`);
  },
};

