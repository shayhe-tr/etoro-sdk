import { HttpClient } from '../http/http-client';
import { API_PREFIX } from '../config/constants';
import type {
  UserSearchParams,
  UserProfile,
  UserPerformance,
  UserPortfolio,
} from '../types/feeds';

export class UsersInfoClient {
  constructor(private readonly http: HttpClient) {}

  async searchUsers(params?: UserSearchParams): Promise<unknown> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/users-info/search`,
      query: {
        searchText: params?.searchText,
        page: params?.page,
        pageSize: params?.pageSize,
      },
    });
  }

  async getUserProfile(userId: number): Promise<UserProfile> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/users-info/${userId}/profile`,
    });
  }

  async getUserPortfolio(userId: number): Promise<UserPortfolio> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/users-info/${userId}/portfolio`,
    });
  }

  async getUserTradeInfo(userId: number): Promise<unknown> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/users-info/${userId}/trade-info`,
    });
  }

  async getUserPerformance(userId: number): Promise<UserPerformance> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/users-info/${userId}/performance`,
    });
  }

  async getUserPerformanceByPeriod(userId: number, period: string): Promise<unknown> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/users-info/${userId}/performance/${period}`,
    });
  }
}
