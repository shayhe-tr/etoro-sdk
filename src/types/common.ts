export interface PaginatedRequest {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse {
  page: number;
  pageSize: number;
  totalItems: number;
}

export interface TokenResponse {
  token: string;
}
