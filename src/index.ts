// High-level trading client
export { EToroTrading, type TradingEvents, type OrderOptions } from './trading/trading-client';
export { InstrumentResolver } from './trading/instrument-resolver';

// Low-level clients
export { RestClient } from './rest/rest-client';
export { HttpClient, type RequestOptions, type HttpClientOptions } from './http/http-client';
export { RateLimiter, type RateLimiterOptions } from './http/rate-limiter';
export { MarketDataClient } from './rest/market-data.client';
export { TradingExecutionClient } from './rest/trading-execution.client';
export { TradingInfoClient } from './rest/trading-info.client';
export { FeedsClient } from './rest/feeds.client';
export { ReactionsClient } from './rest/reactions.client';
export { DiscoveryClient } from './rest/discovery.client';
export { PiDataClient } from './rest/pi-data.client';
export { WatchlistsClient } from './rest/watchlists.client';
export { UsersInfoClient } from './rest/users-info.client';

// WebSocket
export { WsClient, type WsClientOptions, type WsClientEvents } from './ws/ws-client';

// Configuration
export { createConfig, type EToroConfigWithLogger } from './config/config';
export type { EToroConfig, EToroConfigInput } from './config/config.schema';

// Types
export * from './types';

// Errors
export * from './errors';

// Utils
export { type Logger, consoleLogger, noopLogger } from './utils/logger';
