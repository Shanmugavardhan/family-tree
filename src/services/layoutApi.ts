import { request } from './apiClient';
import { ApiResponse } from '../types/api';
import { FamilyLayout, LayoutOptions } from '../types/layout';

export const layoutApi = {
  getLayout: async (options?: LayoutOptions): Promise<ApiResponse<FamilyLayout>> => {
    const lineage = options?.lineage || 'konukuru';

    // 1. Try querying backend API first (works locally on port 5001 and in production with Cloud Functions)
    try {
      const query = new URLSearchParams();
      if (options?.includeArchived) query.set('includeArchived', 'true');
      if (options?.compactLanes) query.set('compactLanes', 'true');
      query.set('inferGenerations', (options?.inferGenerations ?? true).toString());
      if (options?.nodeWidth) query.set('nodeWidth', options.nodeWidth.toString());
      if (options?.nodeHeight) query.set('nodeHeight', options.nodeHeight.toString());
      if (options?.horizontalSpacing) query.set('horizontalSpacing', options.horizontalSpacing.toString());
      if (options?.lineage) query.set('lineage', options.lineage);

      const queryString = query.toString();
      const apiResult = await request<FamilyLayout>(`/layout${queryString ? `?${queryString}` : ''}`);
      if (apiResult.success && apiResult.data) {
        return apiResult;
      }
    } catch {
      // Ignore backend fetch error, fallback to static layout
    }

    // 2. Fallback: load pre-rendered static layout directly from CDN / public data
    try {
      const staticUrl = `/data/layout-${lineage}.json?v=${Date.now()}`;
      const staticRes = await fetch(staticUrl, { cache: 'no-cache' });
      if (staticRes.ok) {
        const fallbackData = await staticRes.json();
        return {
          success: true,
          data: fallbackData,
          error: null,
        };
      }
    } catch {
      // ignore fallback error
    }

    return {
      success: false,
      data: null,
      error: {
        code: 'LAYOUT_FETCH_FAILED',
        message: 'Failed to load family tree layout',
      },
    };
  },
};

