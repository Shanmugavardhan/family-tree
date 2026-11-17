import { request } from './apiClient';
import { ApiResponse } from '../types/api';
import { FamilyLayout, LayoutOptions } from '../types/layout';

export const layoutApi = {
  getLayout: (options?: LayoutOptions): Promise<ApiResponse<FamilyLayout>> => {
    const query = new URLSearchParams();
    if (options?.includeArchived) {
      query.set('includeArchived', 'true');
    }
    if (options?.compactLanes) {
      query.set('compactLanes', 'true');
    }
    if (options?.inferGenerations !== undefined) {
      query.set('inferGenerations', options.inferGenerations.toString());
    } else {
      // Default to true for family tree UI exploration
      query.set('inferGenerations', 'true');
    }
    if (options?.nodeWidth) {
      query.set('nodeWidth', options.nodeWidth.toString());
    }
    if (options?.nodeHeight) {
      query.set('nodeHeight', options.nodeHeight.toString());
    }
    if (options?.horizontalSpacing) {
      query.set('horizontalSpacing', options.horizontalSpacing.toString());
    }

    const queryString = query.toString();
    return request<FamilyLayout>(`/layout${queryString ? `?${queryString}` : ''}`);
  },
};

