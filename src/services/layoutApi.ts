import { request } from './apiClient';
import { ApiResponse } from '../types/api';
import { FamilyLayout, LayoutOptions } from '../types/layout';

export const layoutApi = {
  getLayout: async (options?: LayoutOptions): Promise<ApiResponse<FamilyLayout>> => {
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
    if (options?.lineage) {
      query.set('lineage', options.lineage);
    }

    const queryString = query.toString();
    const lineage = options?.lineage || 'konukuru';
    const apiResult = await request<FamilyLayout>(`/layout${queryString ? `?${queryString}` : ''}`);

    if (apiResult.success && apiResult.data) {
      return apiResult;
    }

    // Seamless fallback to static pre-calculated layout when running static on Firebase Hosting
    try {
      const fallbackUrl = `/data/layout-${lineage}.json`;
      const fallbackRes = await fetch(fallbackUrl);
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        return {
          success: true,
          data: fallbackData,
          error: null,
        };
      }
    } catch {
      // ignore fallback error
    }

    return apiResult;
  },
};

