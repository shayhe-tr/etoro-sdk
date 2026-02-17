import { HttpClient } from '../http/http-client';
import { API_PREFIX } from '../config/constants';
import type { CopierInfo } from '../types/feeds';

export class PiDataClient {
  constructor(private readonly http: HttpClient) {}

  async getCopiersPublicInfo(userId: number): Promise<CopierInfo> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/pi-data/copiers/${userId}`,
    });
  }
}
