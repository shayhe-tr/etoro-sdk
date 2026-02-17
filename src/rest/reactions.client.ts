import { HttpClient } from '../http/http-client';
import { API_PREFIX } from '../config/constants';
import type { CreateCommentRequest, Comment } from '../types/feeds';

export class ReactionsClient {
  constructor(private readonly http: HttpClient) {}

  async createComment(params: CreateCommentRequest): Promise<Comment> {
    return this.http.request({
      method: 'POST',
      path: `${API_PREFIX}/comments`,
      body: params,
    });
  }
}
