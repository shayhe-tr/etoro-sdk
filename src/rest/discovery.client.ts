import { HttpClient } from '../http/http-client';
import { API_PREFIX } from '../config/constants';
import type { CuratedList, MarketRecommendation } from '../types/feeds';

export class DiscoveryClient {
  constructor(private readonly http: HttpClient) {}

  async getCuratedLists(): Promise<CuratedList[]> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/watchlists/curated`,
    });
  }

  async getMarketRecommendations(): Promise<MarketRecommendation[]> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/watchlists/recommendations`,
    });
  }
}
