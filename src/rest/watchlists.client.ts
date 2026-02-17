import { HttpClient } from '../http/http-client';
import { API_PREFIX } from '../config/constants';

export interface Watchlist {
  watchlistId: number;
  name: string;
  isDefault: boolean;
  items: WatchlistItem[];
  [key: string]: unknown;
}

export interface WatchlistItem {
  instrumentId: number;
  rank?: number;
  [key: string]: unknown;
}

export interface CreateWatchlistRequest {
  name: string;
  items?: number[];
}

export interface UpdateWatchlistItemsRequest {
  items: number[];
}

export class WatchlistsClient {
  constructor(private readonly http: HttpClient) {}

  async getUserWatchlists(): Promise<Watchlist[]> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/watchlists`,
    });
  }

  async getWatchlist(watchlistId: number): Promise<Watchlist> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/watchlists/${watchlistId}`,
    });
  }

  async getDefaultWatchlistItems(): Promise<WatchlistItem[]> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/watchlists/default/items`,
    });
  }

  async createWatchlist(params: CreateWatchlistRequest): Promise<Watchlist> {
    return this.http.request({
      method: 'POST',
      path: `${API_PREFIX}/watchlists`,
      body: params,
    });
  }

  async createDefaultWatchlist(params: CreateWatchlistRequest): Promise<Watchlist> {
    return this.http.request({
      method: 'POST',
      path: `${API_PREFIX}/watchlists/default`,
      body: params,
    });
  }

  async deleteWatchlist(watchlistId: number): Promise<void> {
    return this.http.request({
      method: 'DELETE',
      path: `${API_PREFIX}/watchlists/${watchlistId}`,
    });
  }

  async renameWatchlist(watchlistId: number, name: string): Promise<void> {
    return this.http.request({
      method: 'PUT',
      path: `${API_PREFIX}/watchlists/${watchlistId}/name`,
      body: { name },
    });
  }

  async setDefaultWatchlist(watchlistId: number): Promise<void> {
    return this.http.request({
      method: 'PUT',
      path: `${API_PREFIX}/watchlists/${watchlistId}/default`,
    });
  }

  async addItems(watchlistId: number, instrumentIds: number[]): Promise<void> {
    return this.http.request({
      method: 'POST',
      path: `${API_PREFIX}/watchlists/${watchlistId}/items`,
      body: { items: instrumentIds },
    });
  }

  async removeItems(watchlistId: number, instrumentIds: number[]): Promise<void> {
    return this.http.request({
      method: 'DELETE',
      path: `${API_PREFIX}/watchlists/${watchlistId}/items`,
      body: { items: instrumentIds },
    });
  }

  async updateItems(watchlistId: number, instrumentIds: number[]): Promise<void> {
    return this.http.request({
      method: 'PUT',
      path: `${API_PREFIX}/watchlists/${watchlistId}/items`,
      body: { items: instrumentIds },
    });
  }

  async changeRank(watchlistId: number, rank: number): Promise<void> {
    return this.http.request({
      method: 'PUT',
      path: `${API_PREFIX}/watchlists/${watchlistId}/rank`,
      body: { rank },
    });
  }

  async getPublicWatchlists(userId: number): Promise<Watchlist[]> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/watchlists/users/${userId}/public`,
    });
  }

  async getPublicWatchlist(watchlistId: number): Promise<Watchlist> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/watchlists/public/${watchlistId}`,
    });
  }
}
