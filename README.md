# eToro SDK

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

**eToro SDK** is a TypeScript client for the [eToro Public API](https://api-portal.etoro.com/) (REST v1 + WebSocket). It is the shared integration layer used by internal sibling apps (algo tools, portfolio services, terminals, etc.): typed requests, retries, rate limiting, streaming, and a high-level trading facade.

## Installation

This package is consumed as a **local file dependency** from repos next to it on disk:

```json
{
  "dependencies": {
    "etoro-sdk": "file:../etoro-sdk"
  }
}
```

Then install from the consuming project root (adjust the relative path if your layout differs):

```bash
npm install
```

Build the SDK before consumers typecheck or bundle against it:

```bash
cd ../etoro-sdk && npm install && npm run build
```

Published artifact: **ESM** (`dist/esm/`) and **CJS** (`dist/cjs/`), with declarations (`package.json` `exports` → `.`).

Optional: add `import 'dotenv/config'` in your app entrypoint so `ETORO_*` variables load from `.env` (the SDK reads `process.env` but does not call `dotenv` itself).

## API coverage

All paths are under `https://public-api.etoro.com/api/v1` unless overridden with `baseUrl`.

| Area | REST resources (wrapped) | Notes |
|------|---------------------------|--------|
| **Market data** | `GET /market-data/search`, `.../instruments`, `.../instruments/rates`, `.../instruments/{id}/history/candles/...`, `.../instrument-types`, `.../instruments/closing-prices`, `.../instruments/industries`, `.../exchanges` | Rates: SDK batches multi-ID requests (API quirk). |
| **Trading — execution** | `POST/DELETE .../trading/execution[/demo]/market-open-orders/...`, `.../limit-orders`, `.../market-close-orders/...` | `demo` vs `real` from `mode`. |
| **Trading — info** | `GET .../trading/info[/demo|real]/portfolio`, `.../pnl`, `.../orders/{id}`; `GET .../trading/info/trade/history` | Portfolio/PnL/order paths switch with `mode`; trade history uses shared path. |
| **Watchlists** | `GET/POST/PUT/DELETE /watchlists` and sub-routes (default, items, rank, public) | Full CRUD + public watchlists. |
| **Feeds** | `POST /feeds/posts`, `GET /feeds/instruments/{id}`, `GET /feeds/users/{id}` | |
| **Comments** | `POST /comments` | Via `ReactionsClient`. |
| **Discovery** | `GET /watchlists/curated`, `GET /watchlists/recommendations` | Curated lists & recommendations. |
| **PI data** | `GET /pi-data/copiers/{userId}` | |
| **Users info** | `GET /users-info/search`, `GET /users-info/{id}/profile|portfolio|trade-info|performance|...` | |

**WebSocket** (`wss://ws.etoro.com/ws` by default): authenticate with API credentials, subscribe to `instrument:{id}` for rates and `private` for order lifecycle events (see usage below).

## Usage

### Authentication and config

REST calls send `x-api-key`, `x-user-key`, and `x-request-id`. Obtain keys from the [eToro API Portal](https://api-portal.etoro.com/).

```bash
export ETORO_API_KEY="your-api-key"
export ETORO_USER_KEY="your-user-key"
export ETORO_MODE="demo"   # or "real"
# optional overrides:
# ETORO_BASE_URL  (default https://public-api.etoro.com)
# ETORO_WS_URL    (default wss://ws.etoro.com/ws)
```

```typescript
import { EToroTrading, createConfig } from 'etoro-sdk';

// Typical: env-backed
const etoro = new EToroTrading({ mode: 'demo' });

// Or explicit (e.g. tests)
const etoroReal = new EToroTrading({
  apiKey: process.env.ETORO_API_KEY!,
  userKey: process.env.ETORO_USER_KEY!,
  mode: 'real',
});

// Low-level config object (e.g. custom RestClient / HttpClient)
const config = createConfig({ mode: 'demo', logger: console });
```

### Instruments and market data

```typescript
import { EToroTrading, CandleInterval, CandleDirection } from 'etoro-sdk';

const etoro = new EToroTrading();

// Search / metadata (REST)
const search = await etoro.rest.marketData.searchInstruments({
  internalSymbolFull: 'AAPL',
  pageSize: 5,
});

const meta = await etoro.rest.marketData.getInstruments({
  instrumentIds: [100000],
});

// High-level: rates and candles (symbol → ID via InstrumentResolver)
const rates = await etoro.getRates(['AAPL', 'BTC']);
const candles = await etoro.getCandles('AAPL', CandleInterval.OneDay, 30, CandleDirection.Desc);

// CSV bulk load (see `src/data/instruments.csv`)
import { readFileSync } from 'node:fs';
etoro.resolver.loadFromCsv(readFileSync('path/to/instruments.csv', 'utf8'));
```

### Portfolio and trades

```typescript
const etoro = new EToroTrading({ mode: 'demo' });

const portfolio = await etoro.getPortfolio();
const positions = await etoro.getPositions();
const pending = await etoro.getPendingOrders();
const pnl = await etoro.getPnl();
const history = await etoro.getTradeHistory('2024-01-01', 1, 50);
```

### Orders and streaming

```typescript
import { EToroTrading } from 'etoro-sdk';

const etoro = new EToroTrading({ mode: 'demo' });

await etoro.connect();

await etoro.streamPrices(['BTC', 'AAPL'], true);
etoro.on('price', (symbol, instrumentId, rate) => {
  console.log(symbol, rate.Bid, rate.Ask);
});

etoro.subscribeToPrivateEvents();
etoro.on('order:update', (e) => console.log(e.OrderID, e.StatusID));

const order = await etoro.buyByAmount('BTC', 50);
const done = await etoro.waitForOrder(order.orderForOpen.orderID, 30_000);

await etoro.disconnect();
```

Low-level execution (same auth as `RestClient`):

```typescript
await etoro.rest.execution.openMarketOrderByAmount({
  InstrumentID: 100000,
  IsBuy: true,
  Leverage: 1,
  Amount: 100,
});
```

### Low-level REST facade

```typescript
const etoro = new EToroTrading();

// After build, prefer typed methods on:
// etoro.rest.marketData | execution | info | watchlists | feeds | reactions | discovery | piData | usersInfo

await etoro.rest.watchlists.getUserWatchlists();
await etoro.rest.discovery.getCuratedLists();
await etoro.rest.usersInfo.getUserProfile(12345);
```

`MarketDataClient.getCandles` argument order: `instrumentId`, `direction`, `interval`, `count` — use enums:

```typescript
import { CandleDirection, CandleInterval } from 'etoro-sdk';
await etoro.rest.marketData.getCandles(1001, CandleDirection.Desc, CandleInterval.OneDay, 30);
```

## Type exports

The package re-exports TypeScript types from `etoro-sdk` (see `src/types/`):

| Module | Purpose |
|--------|---------|
| `common` | Pagination, `TokenResponse`, etc. |
| `enums` | `CandleInterval`, `CandleDirection`, `OrderStatusId`, `OrderType`, `TradingMode`, … |
| `market-data` | Search, instruments, rates, candles, exchanges, industries, … |
| `trading` | Orders, positions, portfolio, PnL, trade history |
| `websocket` | WS envelopes, instrument rates, private order events |
| `feeds` | Posts, feeds, comments, user/social shapes |

Config types: `EToroConfig`, `EToroConfigInput`, `EToroConfigWithLogger`. Errors: `EToroError`, `EToroApiError`, `EToroAuthError`, `EToroRateLimitError`, `EToroWebSocketError`, `EToroValidationError`.

## Configuration reference

| Input | Env var | Default |
|-------|---------|---------|
| API key | `ETORO_API_KEY` | — (required) |
| User key | `ETORO_USER_KEY` | — (required) |
| Mode | `ETORO_MODE` | `demo` |
| REST base URL | `ETORO_BASE_URL` | `https://public-api.etoro.com` |
| WebSocket URL | `ETORO_WS_URL` | `wss://ws.etoro.com/ws` |
| HTTP timeout (ms) | — | `30000` |
| Retry attempts | — | `3` |
| Retry delay (ms) | — | `1000` |

Optional `logger` on `EToroTrading` / `createConfig` matches the SDK `Logger` interface (`debug` / `info` / `warn` — use `consoleLogger` or `noopLogger` from the package).

## Architecture

- **`EToroTrading`**: Facade over `RestClient`, `WsClient`, and `InstrumentResolver`; convenience methods for rates, candles, portfolio, orders, and WS subscriptions.
- **`RestClient`**: Composes domain clients (`MarketDataClient`, `TradingExecutionClient`, `TradingInfoClient`, watchlists, feeds, discovery, PI data, users, reactions).
- **`HttpClient`**: `fetch`, auth headers, timeouts, retries with jitter, optional token-bucket rate limiter, maps 401/403/429/5xx to typed errors.
- **`WsClient`**: `ws` package, auth, subscribe/unsubscribe tracking, heartbeat, reconnect, parsed events.
- **`InstrumentResolver`**: Symbol cache, CSV load, REST search fallback.

## Project structure

```
src/
  config/       Zod schema, createConfig, constants (API prefix v1, limits)
  data/         instruments.csv (optional bulk symbol map)
  errors/       Typed errors
  http/         HttpClient, retry, rate limiter
  rest/         One client class per API area
  trading/      EToroTrading, InstrumentResolver
  types/        Request/response and WS types
  utils/        Logger, UUID, event emitter, sleep
  ws/           WsClient, parser, subscription tracker
tests/
  unit/         Vitest
  integration/  Live API scripts (use dotenv + real keys)
examples/       Runnable demos (basic usage, streaming, charts, bot skeleton)
```

## Scripts

```bash
npm install
npm test
npm run typecheck
npm run build    # tsup → dist/esm + dist/cjs
```

## Requirements

- Node.js **>= 18**
- Valid eToro **API key** and **user key**

## API quirks (live API)

| Topic | Behavior |
|-------|----------|
| Rates query | Comma-separated `instrumentIds` can 500; SDK requests one ID per call and merges. |
| Search `fields` | Prefer `internalSymbolFull` for exact symbol match; returned fields can be limited vs docs. |
| Close position | Body must include `InstrumentId`; `EToroTrading.closePosition` resolves it from portfolio. |
| Order `StatusID` | 1 Pending, 2 Filling, 3 Executed, 4 Failed, 5 Cancelled. |
| `waitForOrder` | Uses private WS events; starts REST poll fallback after ~3s if no terminal state. |
| Path names | e.g. exchanges under `/market-data/exchanges`, types under `/market-data/instrument-types`. |

## License

MIT

## Reference

- [eToro API Portal](https://api-portal.etoro.com/)
