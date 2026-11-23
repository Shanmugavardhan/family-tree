import { request } from './apiClient';
import { ApiResponse } from '../types/api';
import { FamilyLayout, LayoutOptions } from '../types/layout';

const isLocal =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');

export const layoutApi = {
  getLayout: async (options?: LayoutOptions): Promise<ApiResponse<FamilyLayout>> => {
    const lineage = options?.lineage || 'konukuru';

    // 1. If running locally with local backend server, try backend API first
    if (isLocal) {
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
        // Fallback to static layout
      }
    }

    // 2. In production / static hosting CDN (or local fallback): load pre-rendered static layout directly
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

