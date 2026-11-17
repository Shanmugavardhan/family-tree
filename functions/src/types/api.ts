export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  error: null;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  data: null;
  error: ApiErrorDetail;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

