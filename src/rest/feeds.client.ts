import { HttpClient } from '../http/http-client';
import { API_PREFIX } from '../config/constants';
import type {
  CreatePostRequest,
  FeedResponse,
  GetFeedParams,
} from '../types/feeds';

export class FeedsClient {
  constructor(private readonly http: HttpClient) {}

  async createPost(params: CreatePostRequest): Promise<unknown> {
    return this.http.request({
      method: 'POST',
      path: `${API_PREFIX}/feeds/posts`,
      body: params,
    });
  }

  async getInstrumentFeed(instrumentId: number, params?: GetFeedParams): Promise<FeedResponse> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/feeds/instruments/${instrumentId}`,
      query: {
        page: params?.page,
        pageSize: params?.pageSize,
      },
    });
  }

  async getUserFeed(userId: number, params?: GetFeedParams): Promise<FeedResponse> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/feeds/users/${userId}`,
      query: {
        page: params?.page,
        pageSize: params?.pageSize,
      },
    });
  }
}
