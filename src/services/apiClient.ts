import { ApiResponse } from '../types/api';

const API_BASE = '/api';

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    const data = await response.json();
    return data as ApiResponse<T>;
  } catch (err: any) {
    return {
      success: false,
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: err.message || 'Failed to connect to the backend server'
      }
    };
  }
}

