# eToro SDK — TypeScript SDK for the eToro Public API

> Full-featured TypeScript SDK for algo trading, market data, social features, and WebSocket streaming on eToro.
> Dual ESM/CJS • Zero external HTTP deps • Rate limiting • Auto-retry • Type-safe

**npm:** `etoro-sdk` · **License:** MIT · **Node:** ≥18.0.0

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Client Reference](#client-reference)
- [High-Level Trading Client](#high-level-trading-client)
- [REST Clients](#rest-clients)
- [WebSocket Client](#websocket-client)
- [Instrument Resolution](#instrument-resolution)
- [Configuration](#configuration)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)
- [Type System](#type-system)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Building](#building)
- [Used By](#used-by)

---

## Overview

The eToro SDK is a production-grade TypeScript library that wraps the eToro Public API. It provides both high-level trading abstractions (buy/sell by ticker, portfolio management) and low-level REST/WebSocket clients for full API access. The SDK is the shared data and trading layer used by all MoneyClawX applications.

**Key features:**
- **Dual module format** — ESM + CJS builds via tsup
- **9 REST clients** — Market data, trading, social, discovery, PI data, watchlists, reactions, feeds, users
- **WebSocket streaming** — Real-time price updates with auto-reconnect
- **Instrument resolution** — Ticker → eToro instrumentId mapping with caching
- **Built-in rate limiter** — Configurable per-endpoint rate limiting
- **Auto-retry** — Exponential backoff on transient failures
- **Full type safety** — 100+ TypeScript interfaces for all API responses
- **Error hierarchy** — Typed errors (ApiError, AuthError, RateLimitError, ValidationError, WebSocketError)

---

## Features

### Trading
- Open positions by amount or units
- Close positions (full or partial)
- Place limit/stop orders
- Cancel pending orders
- Get portfolio positions and P&L
- Demo and real account support

### Market Data
- Real-time bid/ask quotes
- Historical OHLCV candles
- Instrument search by name/ticker
- Full instrument catalog (273 instruments)
- Exchange rate queries

### Social & Discovery
- PI (Popular Investor) data and rankings
- User info and profiles
- Social feed and reactions
- Watchlist management
- Discovery/search

### WebSocket Streaming
- Real-time price updates (1-second resolution)
- Instrument subscription management
- Auto-reconnect with exponential backoff
- Event-based API with typed events

---

## Installation

```bash
npm install etoro-sdk
```

Or link locally (used by AgentX, TerminalX, PICentral, etc.):
```json
{
  "dependencies": {
    "etoro-sdk": "file:../etoro-sdk"
  }
}
```

---

## Quick Start

```typescript
import { EToroTrading } from 'etoro-sdk';

const trading = new EToroTrading({
  apiKey: process.env.ETORO_API_KEY!,
  userKey: process.env.ETORO_USER_KEY!,
  mode: 'demo'
});

// Buy $100 of Apple stock
const order = await trading.buy('AAPL', { amount: 100 });
console.log(`Opened position: ${order.positionId}`);

// Stream live prices
trading.on('price', (price) => {
  console.log(`${price.instrumentId}: ${price.bid}/${price.ask}`);
});
await trading.streamPrices([1001, 1002, 1003]);

// Get portfolio
const portfolio = await trading.getPortfolio();
console.log(`Total equity: $${portfolio.totalEquity}`);
```

---

## Architecture

```
etoro-sdk/
├── High-Level Layer
│   ├── EToroTrading          # Buy/sell by ticker, portfolio, streaming
│   └── InstrumentResolver    # Ticker → instrumentId with cache
│
├── REST Layer (9 clients)
│   ├── RestClient            # Unified facade for all REST clients
│   ├── MarketDataClient      # Prices, candles, rates, instruments
│   ├── TradingExecutionClient # Open/close/modify positions
│   ├── TradingInfoClient     # Portfolio, orders, history
│   ├── FeedsClient           # Social feed
│   ├── ReactionsClient       # Social reactions
│   ├── DiscoveryClient       # Search/discovery
│   ├── PiDataClient          # Popular Investor data
│   ├── WatchlistsClient      # Watchlist CRUD
│   └── UsersInfoClient       # User profiles
│
├── WebSocket Layer
│   ├── WsClient              # WebSocket connection manager
│   ├── WsMessageParser       # Binary/JSON message parser
│   └── WsSubscription        # Subscription management
│
├── HTTP Layer
│   ├── HttpClient            # Base HTTP with auth headers
│   ├── RateLimiter           # Per-endpoint rate limiting
│   └── Retry                 # Exponential backoff retry
│
├── Configuration
│   ├── Config                # Runtime config builder
│   └── ConfigSchema          # Zod validation schema
│
├── Error Hierarchy
│   ├── BaseError
│   ├── ApiError              # HTTP 4xx/5xx
│   ├── AuthError             # 401/403
│   ├── RateLimitError        # 429
│   ├── ValidationError       # Input validation
│   └── WebSocketError        # WS connection issues
│
└── Types (100+ interfaces)
    ├── Common                # Shared types
    ├── Enums                 # Status codes, directions
    ├── MarketData            # Prices, candles, instruments
    ├── Trading               # Orders, positions, portfolio
    ├── Feeds                 # Social data
    └── WebSocket             # WS message types
```

---

## Client Reference

### High-Level: `EToroTrading`

The main entry point for most use cases.

```typescript
const trading = new EToroTrading(config);

// Trading
await trading.buy(ticker, options);           // Buy by ticker
await trading.sell(ticker, options);           // Sell by ticker
await trading.close(positionId);              // Close position
await trading.closePartial(positionId, pct);  // Partial close

// Portfolio
await trading.getPortfolio();                 // All positions
await trading.getPosition(positionId);        // Single position
await trading.getPnL();                       // Total P&L

// Market Data
await trading.getPrice(ticker);               // Current price
await trading.getCandles(ticker, period);     // OHLCV history

// Streaming
await trading.streamPrices(instrumentIds);    // Start price stream
trading.on('price', callback);                // Price updates
trading.on('error', callback);                // Error events

// Instrument Resolution
await trading.resolve(ticker);                // Ticker → instrumentId
```

### `OrderOptions`
```typescript
interface OrderOptions {
  amount?: number;        // Dollar amount to invest
  units?: number;         // Number of units
  leverage?: number;      // Leverage multiplier
  stopLoss?: number;      // Stop loss price
  takeProfit?: number;    // Take profit price
  trailingStop?: boolean; // Enable trailing stop
  isBuy?: boolean;        // Direction override
}
```

---

## REST Clients

### `MarketDataClient`
```typescript
client.getLiveRates(instrumentIds)        // Real-time bid/ask
client.getCandles(instrumentId, opts)     // OHLCV candles
client.getInstruments()                   // Full instrument list
client.getExchangeRates()                // FX rates
client.searchInstruments(query)           // Search by name/ticker
```

### `TradingExecutionClient`
```typescript
client.openPosition(params)               // Open new position
client.closePosition(positionId)          // Close position
client.editPosition(positionId, params)   // Modify SL/TP
client.cancelOrder(orderId)               // Cancel pending order
```

### `TradingInfoClient`
```typescript
client.getPortfolio()                     // Current positions
client.getOrders()                        // Pending orders
client.getHistory()                       // Trade history
client.getPosition(positionId)            // Position details
```

### `PiDataClient`
```typescript
client.getPiRanking(period)               // PI leaderboard
client.getPiStats(userId)                 // PI statistics
client.getCopiers(userId)                 // Copier list
client.getPerformance(userId, period)     // Performance history
```

### `FeedsClient`
```typescript
client.getFeed(instrumentId)              // Social feed
client.getPopularFeed()                   // Trending posts
```

### `DiscoveryClient`
```typescript
client.search(query)                      // Universal search
client.getTopMovers()                     // Market movers
```

### `WatchlistsClient`
```typescript
client.getWatchlists()                    // User watchlists
client.createWatchlist(name, instruments) // Create new
client.addToWatchlist(id, instruments)    // Add instruments
```

### `UsersInfoClient`
```typescript
client.getUserInfo(userId)                // User profile
client.getUsers(userIds)                  // Batch user lookup
```

### `ReactionsClient`
```typescript
client.getReactions(postId)               // Post reactions
client.addReaction(postId, type)          // React to post
```

---

## WebSocket Client

```typescript
import { WsClient } from 'etoro-sdk';

const ws = new WsClient({
  url: 'wss://ws.etoro.com/ws',
  apiKey: process.env.ETORO_API_KEY!,
  userKey: process.env.ETORO_USER_KEY!,
});

ws.on('connected', () => console.log('Connected'));
ws.on('price', (data) => {
  console.log(`${data.instrumentId}: bid=${data.bid} ask=${data.ask}`);
});
ws.on('error', (err) => console.error(err));
ws.on('disconnected', () => console.log('Disconnected'));

await ws.connect();
ws.subscribe([1001, 1002, 1003]); // Subscribe to instruments
```

### Auto-Reconnect
- Exponential backoff: 1s → 2s → 4s → 8s → max 30s
- Automatic resubscription on reconnect
- Configurable max reconnect attempts

---

## Instrument Resolution

The SDK uses eToro numeric `instrumentId` values internally. The `InstrumentResolver` handles ticker → ID mapping.

```typescript
import { InstrumentResolver } from 'etoro-sdk';

const resolver = new InstrumentResolver(httpClient);
const id = await resolver.resolve('AAPL');  // → 1001
const id2 = await resolver.resolve('BTC');  // → 100001

// Cached after first lookup
// 273 instruments pre-loaded from src/data/instruments.csv
```

### Instrument CSV
`src/data/instruments.csv` contains pre-cached mappings for 273 eToro instruments.

---

## Configuration

```typescript
import { createConfig } from 'etoro-sdk';

const config = createConfig({
  apiKey: 'your-api-key',
  userKey: 'your-user-key',
  mode: 'demo',                    // 'demo' | 'real'
  baseUrl: 'https://public-api.etoro.com',  // optional
  wsUrl: 'wss://ws.etoro.com/ws',          // optional
  logger: consoleLogger,                    // optional
});
```

### Config Schema (Zod-validated)
```typescript
interface EToroConfig {
  apiKey: string;         // Required: x-api-key header
  userKey: string;        // Required: x-user-key header
  mode: 'demo' | 'real';
  baseUrl?: string;       // Default: https://public-api.etoro.com
  wsUrl?: string;         // Default: wss://ws.etoro.com/ws
  logger?: Logger;        // Default: noopLogger
}
```

**Important:** Every request requires `x-request-id` (UUID) header — the SDK generates this automatically.

---

## Error Handling

```typescript
import { ApiError, AuthError, RateLimitError } from 'etoro-sdk';

try {
  await trading.buy('AAPL', { amount: 100 });
} catch (err) {
  if (err instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${err.retryAfter}ms`);
  } else if (err instanceof AuthError) {
    console.log('Authentication failed. Check API keys.');
  } else if (err instanceof ApiError) {
    console.log(`API error ${err.statusCode}: ${err.message}`);
  }
}
```

### Error Hierarchy
```
BaseError
├── ApiError (HTTP 4xx/5xx)
│   ├── statusCode: number
│   ├── responseBody: any
│   └── requestId: string
├── AuthError (401/403)
├── RateLimitError (429)
│   └── retryAfter: number
├── ValidationError (input validation)
└── WebSocketError (connection issues)
```

---

## Rate Limiting

Built-in rate limiter prevents hitting eToro's 100 req/min limit.

```typescript
import { RateLimiter } from 'etoro-sdk';

const limiter = new RateLimiter({
  maxRequests: 100,      // Max requests per window
  windowMs: 60000,       // Window size (1 minute)
  retryAfterMs: 1000,    // Wait time when limited
});
```

The `HttpClient` uses the rate limiter automatically. Requests exceeding the limit are queued.

---

## Examples

### Basic Usage (`examples/basic-usage.ts`)
```typescript
import { RestClient, createConfig } from 'etoro-sdk';

const config = createConfig({ apiKey: '...', userKey: '...', mode: 'demo' });
const client = new RestClient(config);

const rates = await client.marketData.getLiveRates([1001, 1002]);
const portfolio = await client.tradingInfo.getPortfolio();
```

### Live Price Chart (`examples/live-chart.ts`)
ASCII-art live price chart using WebSocket streaming.

### Algo Bot Skeleton (`examples/algo-bot-skeleton.ts`)
Template for building algorithmic trading bots.

### Stream Prices (`examples/stream-prices.ts`)
WebSocket price streaming with event handling.

---

## Type System

100+ TypeScript interfaces covering all API responses:

### Key Types
```typescript
// Market Data
interface Instrument { instrumentId: number; symbolFull: string; ... }
interface PriceUpdate { instrumentId: number; bid: number; ask: number; ... }
interface Candle { date: string; open: number; high: number; low: number; close: number; volume: number; }

// Trading
interface Position { positionId: number; instrumentId: number; amount: number; ... }
interface Order { orderId: number; instrumentId: number; type: string; ... }
interface Portfolio { positions: Position[]; totalEquity: number; ... }

// Enums
type TradingMode = 'demo' | 'real';
type OrderType = 'market' | 'limit' | 'stop';
type PositionDirection = 'buy' | 'sell';
```

---

## Project Structure

```
etoro-sdk/
├── src/
│   ├── index.ts                         # Public API exports
│   ├── config/
│   │   ├── config.ts                    # Runtime config builder
│   │   ├── config.schema.ts             # Zod validation schema
│   │   └── constants.ts                 # API URLs, defaults
│   ├── http/
│   │   ├── http-client.ts              # Base HTTP client with auth
│   │   ├── rate-limiter.ts             # Per-endpoint rate limiting
│   │   └── retry.ts                    # Exponential backoff
│   ├── rest/
│   │   ├── rest-client.ts             # Unified REST facade
│   │   ├── market-data.client.ts      # Prices, candles, instruments
│   │   ├── trading-execution.client.ts # Open/close/modify
│   │   ├── trading-info.client.ts     # Portfolio, orders, history
│   │   ├── feeds.client.ts           # Social feed
│   │   ├── reactions.client.ts       # Social reactions
│   │   ├── discovery.client.ts       # Search/discovery
│   │   ├── pi-data.client.ts         # Popular Investor data
│   │   ├── watchlists.client.ts      # Watchlist CRUD
│   │   ├── users-info.client.ts      # User profiles
│   │   └── index.ts                  # REST exports
│   ├── ws/
│   │   ├── ws-client.ts              # WebSocket connection manager
│   │   ├── ws-message-parser.ts      # Message parser
│   │   └── ws-subscription.ts        # Subscription management
│   ├── trading/
│   │   ├── trading-client.ts         # High-level EToroTrading
│   │   └── instrument-resolver.ts    # Ticker → instrumentId
│   ├── types/
│   │   ├── common.ts                 # Shared types
│   │   ├── enums.ts                  # Enums and constants
│   │   ├── market-data.ts            # Market data types
│   │   ├── trading.ts                # Trading types
│   │   ├── feeds.ts                  # Social types
│   │   ├── websocket.ts             # WebSocket types
│   │   └── index.ts                 # Type exports
│   ├── errors/
│   │   ├── base-error.ts
│   │   ├── api-error.ts
│   │   ├── auth-error.ts
│   │   ├── rate-limit-error.ts
│   │   ├── validation-error.ts
│   │   ├── websocket-error.ts
│   │   └── index.ts
│   ├── utils/
│   │   ├── event-emitter.ts         # Typed event emitter
│   │   ├── logger.ts                # Logger interface
│   │   ├── sleep.ts                 # Async sleep
│   │   └── uuid.ts                  # UUID generator
│   └── data/
│       └── instruments.csv           # 273 pre-cached instruments
├── examples/
│   ├── basic-usage.ts
│   ├── live-chart.ts
│   ├── algo-bot-skeleton.ts
│   └── stream-prices.ts
├── tests/
│   ├── unit/
│   │   ├── config.test.ts
│   │   ├── http-client.test.ts
│   │   ├── rate-limiter.test.ts
│   │   ├── retry.test.ts
│   │   ├── instrument-resolver.test.ts
│   │   ├── market-data.client.test.ts
│   │   ├── trading-client.test.ts
│   │   ├── trading-execution.client.test.ts
│   │   ├── trading-info.client.test.ts
│   │   ├── ws-client.test.ts
│   │   ├── ws-message-parser.test.ts
│   │   └── event-emitter.test.ts
│   └── integration/
│       ├── live-test.ts
│       ├── btc-buy-100.ts
│       ├── btc-stream-and-buy.ts
│       ├── check-portfolio.ts
│       └── debug-*.ts
├── .env.example
├── tsup.config.ts                    # Dual ESM/CJS build
├── vitest.config.ts
├── tsconfig.json
├── package.json
└── .prettierrc
```

---

## Environment Variables

```bash
# Required
ETORO_API_KEY=your_api_key_here      # x-api-key header
ETORO_USER_KEY=your_user_key_here    # x-user-key header
ETORO_MODE=demo                       # demo | real

# Optional
ETORO_BASE_URL=https://public-api.etoro.com
ETORO_WS_URL=wss://ws.etoro.com/ws
```

---

## Testing

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Type checking
npm run typecheck

# Integration tests (requires API keys)
npx tsx tests/integration/live-test.ts
```

### Unit Test Coverage
- Config validation and defaults
- HTTP client request/response handling
- Rate limiter queuing behavior
- Retry logic with exponential backoff
- Instrument resolution and caching
- Market data client methods
- Trading client buy/sell/close flows
- Trading execution API calls
- WebSocket connection and reconnection
- Message parser (binary + JSON)
- Event emitter typed events

---

## Building

```bash
# Build ESM + CJS
npm run build

# Watch mode (development)
npm run dev

# Output: dist/esm/ and dist/cjs/
```

Build config (`tsup.config.ts`):
- Entry: `src/index.ts`
- Formats: ESM (`.js`) + CJS (`.cjs`)
- Declaration files: `.d.ts` + `.d.cts`
- Tree-shakeable ESM output

---

## Used By

| Application | Usage |
|-------------|-------|
| **AgentX** | Signal generation, portfolio, demo trading, instrument search |
| **TerminalX** | Live prices, candles, portfolio, WebSocket bridge |
| **PICentral** | 14 API functions, PI data, copier stats, trading |
| **Portfolio Rebalancer** | Portfolio positions, trade execution |
| **VIP Signals** | Price ingestion, trade execution, instrument universe |

The SDK is linked as a local dependency (`file:../etoro-sdk`) across all applications.

---

**eToro API rate limit:** 100 requests/minute. The SDK handles this automatically.

**Important notes:**
- eToro uses numeric `instrumentId`, not tickers — always resolve first
- Every request needs `x-request-id` (UUID) — auto-generated by SDK
- Bearer token auth ≠ API key auth — don't mix authentication methods
- JWT tokens are ~6KB — use server-side sessions, not cookies
