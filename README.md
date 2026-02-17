# etoro-sdk

TypeScript SDK for the [eToro Public API](https://api-portal.etoro.com/) — market data, real-time WebSocket streaming, order execution, and portfolio management. Built for algo trading.

## Features

- **Market Data** — search instruments, live rates, historical candles, exchanges, instrument types
- **Real-time Streaming** — WebSocket price feeds with auto-reconnect and typed events
- **Order Execution** — market orders (by amount or units), limit orders, close positions (full & partial)
- **Order Monitoring** — real-time WebSocket-based order lifecycle tracking with REST polling fallback
- **Portfolio** — positions, pending orders, mirrors (copy trading), P&L, trade history
- **Bulk Operations** — close all positions, cancel all orders, cancel all limit orders
- **Instrument Resolver** — automatic symbol-to-ID resolution with CSV bulk loading
- **Rate Limiting** — built-in token-bucket rate limiter with 429 back-pressure handling
- **Resilient Connections** — auto-retry with exponential backoff + jitter, WS heartbeat ping/pong
- **Dual Mode** — demo and real account support via config
- **Dual Build** — ESM + CommonJS with full TypeScript declarations
- **Typed Everything** — complete TypeScript types for all API responses and WebSocket events

## Quick Start

### Install

```bash
npm install etoro-sdk
```

### Configure

Set your API keys as environment variables (or pass them to the constructor):

```bash
export ETORO_API_KEY="your-api-key"
export ETORO_USER_KEY="your-user-key"
export ETORO_MODE="demo"    # or "real"
```

Or create a `.env` file:

```env
ETORO_API_KEY=your-api-key
ETORO_USER_KEY=your-user-key
ETORO_MODE=demo
```

### Get API Keys

Sign up at the [eToro API Portal](https://api-portal.etoro.com/) to get your `apiKey` and `userKey`.

## Usage

### Market Data

```typescript
import { EToroTrading, CandleInterval } from 'etoro-sdk';

const etoro = new EToroTrading();

// Get live rates (fetches in parallel for multiple instruments)
const rates = await etoro.getRates(['AAPL', 'TSLA', 'BTC']);
for (const rate of rates) {
  console.log(`${rate.instrumentID}: bid=${rate.bid} ask=${rate.ask}`);
}

// Historical candles
const candles = await etoro.getCandles('AAPL', CandleInterval.OneDay, 30);

// Search instruments
const results = await etoro.rest.marketData.searchInstruments({
  fields: 'instrumentId',
  internalSymbolFull: 'AAPL',    // exact match
  pageSize: 5,
});

// Exchanges & instrument types
const exchanges = await etoro.rest.marketData.getExchanges();
const types = await etoro.rest.marketData.getInstrumentTypes();
```

### WebSocket Streaming

```typescript
const etoro = new EToroTrading();

// Connect (authenticates automatically)
await etoro.connect();

// Subscribe to live price feeds
await etoro.streamPrices(['BTC', 'ETH', 'AAPL'], true);

// Handle real-time price updates
etoro.on('price', (symbol, instrumentId, rate) => {
  console.log(`${symbol}: bid=${rate.Bid} ask=${rate.Ask}`);
});

// Subscribe to private events (order fills, etc.)
etoro.subscribeToPrivateEvents();
etoro.on('order:update', (event) => {
  console.log(`Order ${event.OrderID}: status=${event.StatusID}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await etoro.disconnect();
  process.exit(0);
});
```

### Trading

```typescript
const etoro = new EToroTrading({ mode: 'real' });

// Buy $100 of Bitcoin
const order = await etoro.buyByAmount('BTC', 100);
console.log(`Order ID: ${order.orderForOpen.orderID}`);

// Buy with stop-loss and take-profit
const order2 = await etoro.buyByAmount('AAPL', 500, {
  stopLoss: 240.00,
  takeProfit: 280.00,
  leverage: 2,
});

// Sell (short)
await etoro.sellByAmount('TSLA', 200);
await etoro.sellByUnits('AAPL', 5);

// Close a position (auto-resolves instrument ID)
await etoro.closePosition(positionID);

// Partial close — close specific units from a position
await etoro.closePosition(positionID, 0.0005);

// Close all positions
await etoro.closeAllPositions();

// Place limit order
await etoro.placeLimitOrder('TSLA', true, 400.00, 200);

// Cancel orders
await etoro.cancelOrder(orderId);           // cancel a market open order
await etoro.cancelLimitOrder(orderId);      // cancel a limit order
await etoro.cancelAllOrders();              // cancel all market open orders
await etoro.cancelAllLimitOrders();         // cancel all limit orders
```

### Order Monitoring

Track order lifecycle in real-time via WebSocket, with automatic REST polling fallback:

```typescript
const etoro = new EToroTrading({ mode: 'real' });
await etoro.connect(); // WebSocket required for real-time monitoring

// Place an order
const order = await etoro.buyByAmount('BTC', 50);
const orderId = order.orderForOpen.orderID;

// Wait for execution (WS-based, ~3s typical)
const result = await etoro.waitForOrder(orderId, 15_000);
console.log(`Executed! Position: ${result.PositionID}, Units: ${result.ExecutedUnits}`);

// Status flow: Pending (1) → Filling (2) → Executed (3)
// Rejects on: Failed (4) or Cancelled (5)

await etoro.disconnect();
```

### Portfolio

```typescript
const etoro = new EToroTrading();

// Get full portfolio (positions, mirrors, pending orders, credit)
const portfolio = await etoro.getPortfolio();
console.log(`Credit: $${portfolio.clientPortfolio.credit}`);

for (const pos of portfolio.clientPortfolio.positions) {
  console.log(`#${pos.positionID}: ${pos.instrumentID} ${pos.isBuy ? 'LONG' : 'SHORT'} $${pos.amount}`);
}

// Direct position helpers
const positions = await etoro.getPositions();
const pendingOrders = await etoro.getPendingOrders(); // limit + market open orders

// P&L
const pnl = await etoro.getPnl();

// Trade history
const history = await etoro.getTradeHistory('2024-01-01');
```

### Instrument Resolution

The SDK resolves symbols to eToro instrument IDs automatically. For best performance, load the instrument CSV:

```typescript
import { readFileSync } from 'fs';

const etoro = new EToroTrading();

// Option 1: Load from CSV (5,200+ instruments, instant lookup)
const csv = readFileSync('instruments.csv', 'utf-8');
etoro.resolver.loadFromCsv(csv);

// Option 2: Register individual mappings
etoro.resolver.register('BTC', 100000);
etoro.resolver.register('ETH', 100001);

// Option 3: Auto-resolve via API (slower, makes HTTP request)
const id = await etoro.resolveInstrument('AAPL'); // => 1001
```

### Low-Level REST Clients

Every API endpoint is also available via direct REST clients:

```typescript
const etoro = new EToroTrading();

// Market data
etoro.rest.marketData.searchInstruments(params);
etoro.rest.marketData.getInstruments(params);
etoro.rest.marketData.getRates([1001, 1111]);
etoro.rest.marketData.getCandles(1001, 'desc', 'OneDay', 30);
etoro.rest.marketData.getExchanges();
etoro.rest.marketData.getInstrumentTypes();

// Trading execution
etoro.rest.execution.openMarketOrderByAmount(params);
etoro.rest.execution.openMarketOrderByUnits(params);
etoro.rest.execution.openLimitOrder(params);
etoro.rest.execution.closePosition(positionId, params);
etoro.rest.execution.cancelMarketOpenOrder(orderId);
etoro.rest.execution.cancelLimitOrder(orderId);

// Trading info
etoro.rest.info.getPortfolio();
etoro.rest.info.getPnl();
etoro.rest.info.getOrder(orderId);
etoro.rest.info.getTradeHistory(params);

// Watchlists (16 endpoints)
etoro.rest.watchlists.getWatchlists();
etoro.rest.watchlists.createWatchlist(params);
// ... full CRUD

// Social / Discovery
etoro.rest.feeds.getInstrumentFeed(instrumentId);
etoro.rest.discovery.getCuratedLists();
etoro.rest.discovery.getMarketRecommendations();
etoro.rest.usersInfo.searchUsers(params);
```

## Configuration

```typescript
const etoro = new EToroTrading({
  apiKey: 'your-api-key',         // or ETORO_API_KEY env var
  userKey: 'your-user-key',       // or ETORO_USER_KEY env var
  mode: 'demo',                   // 'demo' | 'real' (or ETORO_MODE)
  baseUrl: 'https://...',         // custom base URL
  wsUrl: 'wss://...',             // custom WebSocket URL
  timeout: 30000,                 // HTTP request timeout (ms)
  retryAttempts: 3,               // retry failed requests
  retryDelay: 1000,               // initial retry delay (ms)
  logger: console,                // custom logger (or noopLogger)
});
```

## Architecture

```
EToroTrading (high-level)
  |
  +-- RestClient (facade)
  |     +-- MarketDataClient       8 endpoints
  |     +-- TradingExecutionClient 7 endpoints (demo/real routing)
  |     +-- TradingInfoClient      4 endpoints (demo/real routing)
  |     +-- WatchlistsClient      16 endpoints
  |     +-- FeedsClient            3 endpoints
  |     +-- ReactionsClient        1 endpoint
  |     +-- DiscoveryClient        2 endpoints
  |     +-- PiDataClient           1 endpoint
  |     +-- UsersInfoClient        6 endpoints
  |
  +-- HttpClient (transport)
  |     +-- Auth headers (x-api-key, x-user-key, x-request-id)
  |     +-- Retry with exponential backoff + jitter
  |     +-- Token-bucket rate limiter (429 back-pressure)
  |
  +-- WsClient (WebSocket)
  |     +-- Auto-auth, auto-reconnect
  |     +-- Heartbeat ping/pong (dead connection detection)
  |     +-- Typed event emission
  |     +-- Subscription tracking
  |
  +-- InstrumentResolver
        +-- CSV bulk loading (5,200+ instruments)
        +-- API fallback search
        +-- Symbol <-> ID cache
```

## Examples

| Example | Description | Run |
|---------|-------------|-----|
| `examples/basic-usage.ts` | Rates, candles, portfolio, buy/close | `npx tsx examples/basic-usage.ts` |
| `examples/stream-prices.ts` | WebSocket price streaming | `npx tsx examples/stream-prices.ts` |
| `examples/algo-bot-skeleton.ts` | SMA crossover trading bot | `npx tsx examples/algo-bot-skeleton.ts` |
| `examples/live-chart.ts` | Real-time terminal price chart | `npx tsx examples/live-chart.ts` |

## API Quirks

These are undocumented behaviors discovered through live testing:

| Quirk | Details |
|-------|---------|
| Rates: single ID only | Comma-separated `instrumentIds` returns 500. SDK auto-batches in parallel. |
| Search: limited fields | `fields` param is ignored; only `instrumentId` is returned. Use `internalSymbolFull` for exact symbol match. |
| BTC instrument ID | BTC = `100000` (tradeable crypto). ID `315` (BTC.Fut) is internal-only. |
| Capital ID suffixes | All entity IDs use PascalCase: `positionID`, `instrumentID`, `orderID`, `CID`. |
| Close requires InstrumentId | The close position body must include `InstrumentId`. SDK handles this automatically. |
| Order status values | 1=Pending, 2=Filling, 3=Executed, 4=Failed, 5=Cancelled |
| WS order events | Filling (2) delivered instantly via WS; Executed (3) confirmed via REST fallback. `waitForOrder()` handles both. |
| Endpoint paths differ | Exchanges: `/market-data/exchanges` (not `/instruments/exchanges`). Types: `/market-data/instrument-types`. |
| MIT orders | Market-if-touched orders use the same `/limit-orders` endpoint as limit orders. |

## Project Structure

```
src/
  config/          Config schema (zod), constants, env var loading
  data/            instruments.csv (5,200+ instrument mappings)
  errors/          Typed error classes (API, Auth, RateLimit, WS, Validation)
  http/            HTTP client with retry, rate limiter, auth headers, error mapping
  rest/            REST endpoint clients (9 sub-clients, 42+ endpoints)
  trading/         High-level trading client + instrument resolver
  types/           Full TypeScript types for all API shapes
  utils/           Event emitter, logger, UUID, sleep
  ws/              WebSocket client with heartbeat, message parser, subscription tracker
tests/
  unit/            130 unit tests (vitest) across 12 test files
  integration/     Live API integration tests (real account verified)
examples/          4 runnable examples
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type check
npm run typecheck

# Build (ESM + CJS)
npm run build

# Run an example
npx tsx examples/live-chart.ts
```

## Requirements

- Node.js >= 18.0.0
- eToro API key and user key from [api-portal.etoro.com](https://api-portal.etoro.com/)

## License

MIT
