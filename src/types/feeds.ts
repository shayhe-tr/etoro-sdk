// --- Feeds ---

export interface CreatePostRequest {
  content: string;
  instrumentId?: number;
}

export interface FeedPost {
  postId: string;
  userId: number;
  username: string;
  content: string;
  createdAt: string;
  instrumentId?: number;
  likesCount: number;
  commentsCount: number;
  [key: string]: unknown;
}

export interface FeedResponse {
  posts: FeedPost[];
}

export interface GetFeedParams {
  page?: number;
  pageSize?: number;
}

// --- Comments ---

export interface CreateCommentRequest {
  postId: string;
  content: string;
}

export interface Comment {
  commentId: string;
  postId: string;
  userId: number;
  username: string;
  content: string;
  createdAt: string;
  [key: string]: unknown;
}

// --- Users Info ---

export interface UserSearchParams {
  searchText?: string;
  page?: number;
  pageSize?: number;
}

export interface UserProfile {
  userId: number;
  username: string;
  displayName: string;
  [key: string]: unknown;
}

export interface UserPerformance {
  userId: number;
  [key: string]: unknown;
}

export interface UserPortfolio {
  userId: number;
  positions: unknown[];
  [key: string]: unknown;
}

// --- PI Data ---

export interface CopierInfo {
  userId: number;
  copiersCount: number;
  [key: string]: unknown;
}

// --- Discovery ---

export interface CuratedList {
  listId: number;
  name: string;
  items: unknown[];
  [key: string]: unknown;
}

export interface MarketRecommendation {
  instrumentId: number;
  [key: string]: unknown;
}
