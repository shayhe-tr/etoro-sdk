import { TypedEventEmitter } from '../utils/event-emitter';
import { sleep } from '../utils/sleep';
import { createConfig, type EToroConfigWithLogger } from '../config/config';
import type { EToroConfigInput } from '../config/config.schema';
import type { Logger } from '../utils/logger';
import { EToroError } from '../errors/base-error';
import { EToroValidationError } from '../errors/validation-error';
import { OrderStatusId } from '../types/enums';
import { RestClient } from '../rest/rest-client';
import { WsClient } from '../ws/ws-client';
import { InstrumentResolver } from './instrument-resolver';
import type {
  OrderForOpenResponse,
  OrderForCloseResponse,
  OrderForOpenInfoResponse,
  PortfolioResponse,
  PnlResponse,
  Position,
  PendingOrder,
  TradeHistoryEntry,
} from '../types/trading';
import type { InstrumentRate, InstrumentDisplayData, CandlesResponse } from '../types/market-data';
import type { TokenResponse } from '../types/common';
import type { CandleInterval } from '../types/enums';
import { CandleDirection } from '../types/enums';
import type { WsInstrumentRate, WsPrivateEvent, WsEnvelope } from '../types/websocket';

export type TradingEvents = {
  price: (symbol: string, instrumentId: number, rate: WsInstrumentRate) => void;
  'order:update': (event: WsPrivateEvent) => void;
  connected: () => void;
  disconnected: () => void;
  error: (error: Error) => void;
  'ws:message': (envelope: WsEnvelope) => void;
};

export interface OrderOptions {
  leverage?: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStopLoss?: boolean;
}

export class EToroTrading extends TypedEventEmitter<TradingEvents> {
  public readonly rest: RestClient;
  public readonly ws: WsClient;
  public readonly resolver: InstrumentResolver;
  private readonly config: EToroConfigWithLogger;

  constructor(configOverrides?: Partial<EToroConfigInput> & { logger?: Logger }) {
    super();
    this.config = createConfig(configOverrides);
    this.rest = new RestClient(this.config);
    this.ws = new WsClient({
      apiKey: this.config.apiKey,
      userKey: this.config.userKey,
      wsUrl: this.config.wsUrl,
      logger: this.config.logger,
    });
    this.resolver = new InstrumentResolver(this.rest.marketData);

    // Wire WS events to high-level events
    this.ws.on('instrument:rate', (instrumentId, rate) => {
      const symbol = this.resolver.getSymbol(instrumentId) ?? String(instrumentId);
      this.emit('price', symbol, instrumentId, rate);
    });
    this.ws.on('private:event', (event) => {
      this.emit('order:update', event);
    });
    this.ws.on('error', (err) => this.emit('error', err));
    this.ws.on('message', (envelope) => this.emit('ws:message', envelope));
  }

  // --- Connection ---

  async connect(): Promise<void> {
    await this.ws.connect();
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    await this.ws.disconnect();
    this.emit('disconnected');
  }

  // --- Trading: Buy ---

  async buyByAmount(
    symbolOrId: string | number,
    amount: number,
    options?: OrderOptions,
  ): Promise<OrderForOpenResponse> {
    const instrumentId = await this.resolver.resolve(symbolOrId);
    return this.rest.execution.openMarketOrderByAmount({
      InstrumentID: instrumentId,
      IsBuy: true,
      Leverage: options?.leverage ?? 1,
      Amount: amount,
      StopLossRate: options?.stopLoss,
      TakeProfitRate: options?.takeProfit,
      IsTslEnabled: options?.trailingStopLoss,
    });
  }

  async buyByUnits(
    symbolOrId: string | number,
    units: number,
    options?: OrderOptions,
  ): Promise<OrderForOpenResponse> {
    const instrumentId = await this.resolver.resolve(symbolOrId);
    return this.rest.execution.openMarketOrderByUnits({
      InstrumentID: instrumentId,
      IsBuy: true,
      Leverage: options?.leverage ?? 1,
      AmountInUnits: units,
      StopLossRate: options?.stopLoss,
      TakeProfitRate: options?.takeProfit,
      IsTslEnabled: options?.trailingStopLoss,
    });
  }

  // --- Trading: Sell ---

  async sellByAmount(
    symbolOrId: string | number,
    amount: number,
    options?: OrderOptions,
  ): Promise<OrderForOpenResponse> {
    const instrumentId = await this.resolver.resolve(symbolOrId);
    return this.rest.execution.openMarketOrderByAmount({
      InstrumentID: instrumentId,
      IsBuy: false,
      Leverage: options?.leverage ?? 1,
      Amount: amount,
      StopLossRate: options?.stopLoss,
      TakeProfitRate: options?.takeProfit,
      IsTslEnabled: options?.trailingStopLoss,
    });
  }

  async sellByUnits(
    symbolOrId: string | number,
    units: number,
    options?: OrderOptions,
  ): Promise<OrderForOpenResponse> {
    const instrumentId = await this.resolver.resolve(symbolOrId);
    return this.rest.execution.openMarketOrderByUnits({
      InstrumentID: instrumentId,
      IsBuy: false,
      Leverage: options?.leverage ?? 1,
      AmountInUnits: units,
      StopLossRate: options?.stopLoss,
      TakeProfitRate: options?.takeProfit,
      IsTslEnabled: options?.trailingStopLoss,
    });
  }

  // --- Trading: Close ---

  async closePosition(positionId: number, unitsToDeduct?: number): Promise<OrderForCloseResponse> {
    // API requires InstrumentId in the close request body — look it up from portfolio
    const portfolio = await this.getPortfolio();
    const allPositions = [
      ...portfolio.clientPortfolio.positions,
      ...portfolio.clientPortfolio.mirrors.flatMap((m) => m.positions),
    ];
    const position = allPositions.find((p) => p.positionID === positionId);
    if (!position) {
      throw new EToroValidationError(`Position ${positionId} not found in portfolio`, 'positionId');
    }
    return this.rest.execution.closePosition(positionId, {
      InstrumentId: position.instrumentID,
      UnitsToDeduct: unitsToDeduct,
    });
  }

  async closeAllPositions(): Promise<OrderForCloseResponse[]> {
    const portfolio = await this.getPortfolio();
    return Promise.all(
      portfolio.clientPortfolio.positions.map((p) =>
        this.rest.execution.closePosition(p.positionID, {
          InstrumentId: p.instrumentID,
        }),
      ),
    );
  }

  // --- Trading: Limit Orders ---

  async placeLimitOrder(
    symbolOrId: string | number,
    isBuy: boolean,
    triggerRate: number,
    amount: number,
    options?: OrderOptions,
  ): Promise<TokenResponse> {
    const instrumentId = await this.resolver.resolve(symbolOrId);
    return this.rest.execution.openLimitOrder({
      InstrumentID: instrumentId,
      IsBuy: isBuy,
      Leverage: options?.leverage ?? 1,
      Amount: amount,
      Rate: triggerRate,
      StopLossRate: options?.stopLoss ?? 0,
      TakeProfitRate: options?.takeProfit ?? 0,
      IsTslEnabled: options?.trailingStopLoss,
    });
  }

  async cancelOrder(orderId: number): Promise<TokenResponse> {
    return this.rest.execution.cancelMarketOpenOrder(orderId);
  }

  async cancelLimitOrder(orderId: number): Promise<TokenResponse> {
    return this.rest.execution.cancelLimitOrder(orderId);
  }

  async cancelAllOrders(): Promise<TokenResponse[]> {
    const portfolio = await this.getPortfolio();
    const orders = portfolio.clientPortfolio.ordersForOpen;
    return Promise.all(
      orders.map((o) => this.rest.execution.cancelMarketOpenOrder(o.orderID)),
    );
  }

  async cancelAllLimitOrders(): Promise<TokenResponse[]> {
    const portfolio = await this.getPortfolio();
    const orders = portfolio.clientPortfolio.orders;
    return Promise.all(
      orders.map((o) => this.rest.execution.cancelLimitOrder(o.orderID)),
    );
  }

  // --- Portfolio ---

  async getPortfolio(): Promise<PortfolioResponse> {
    return this.rest.info.getPortfolio();
  }

  async getPositions(): Promise<Position[]> {
    const portfolio = await this.getPortfolio();
    return portfolio.clientPortfolio.positions;
  }

  async getPendingOrders(): Promise<PendingOrder[]> {
    const portfolio = await this.getPortfolio();
    return [
      ...portfolio.clientPortfolio.orders,
      ...portfolio.clientPortfolio.ordersForOpen,
    ];
  }

  async getPnl(): Promise<PnlResponse> {
    return this.rest.info.getPnl();
  }

  async getTradeHistory(
    minDate: string,
    page?: number,
    pageSize?: number,
  ): Promise<TradeHistoryEntry[]> {
    return this.rest.info.getTradeHistory({ minDate, page, pageSize });
  }

  // --- Market Data ---

  async getRates(symbolsOrIds: (string | number)[]): Promise<InstrumentRate[]> {
    const ids = await Promise.all(symbolsOrIds.map((s) => this.resolver.resolve(s)));
    const response = await this.rest.marketData.getRates(ids);
    return response.rates;
  }

  async getCandles(
    symbolOrId: string | number,
    interval: CandleInterval,
    count: number,
    direction: CandleDirection = CandleDirection.Desc,
  ): Promise<CandlesResponse> {
    const instrumentId = await this.resolver.resolve(symbolOrId);
    return this.rest.marketData.getCandles(instrumentId, direction, interval, count);
  }

  // --- Streaming ---

  async streamPrices(symbolsOrIds: (string | number)[], snapshot = true): Promise<void> {
    const ids = await Promise.all(symbolsOrIds.map((s) => this.resolver.resolve(s)));
    const topics = ids.map((id) => `instrument:${id}`);
    this.ws.subscribe(topics, snapshot);
  }

  async stopStreamingPrices(symbolsOrIds: (string | number)[]): Promise<void> {
    const topics: string[] = [];
    for (const s of symbolsOrIds) {
      const id = typeof s === 'number' ? s : this.resolver.getCachedId(s);
      if (id !== undefined) {
        topics.push(`instrument:${id}`);
      }
    }
    if (topics.length > 0) {
      this.ws.unsubscribe(topics);
    }
  }

  subscribeToPrivateEvents(): void {
    this.ws.subscribe(['private']);
  }

  unsubscribeFromPrivateEvents(): void {
    this.ws.unsubscribe(['private']);
  }

  // --- Order Monitoring ---

  /**
   * Wait for an order to reach a terminal state via WebSocket private events.
   *
   * Listens for real-time WS events matching the order ID. Resolves when the
   * order is Executed, or rejects if Failed/Cancelled. Falls back to REST
   * polling after 3 seconds if no terminal WS event arrives.
   *
   * Requires an active WebSocket connection. Automatically subscribes to
   * private events if not already subscribed.
   */
  async waitForOrder(
    orderId: number,
    timeoutMs = 30_000,
  ): Promise<WsPrivateEvent> {
    if (!this.ws.isConnected) {
      throw new EToroError('WebSocket not connected — call connect() before waitForOrder()');
    }

    // Auto-subscribe to private events if needed
    this.subscribeToPrivateEvents();

    return new Promise<WsPrivateEvent>((resolve, reject) => {
      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new EToroError(`Timeout waiting for order ${orderId} after ${timeoutMs}ms`));
      }, timeoutMs);

      // REST polling fallback — starts after 3s if WS hasn't delivered a terminal state yet
      const pollDelay = Math.min(3_000, timeoutMs / 2);
      let pollTimer: ReturnType<typeof setTimeout> | null = null;
      pollTimer = setTimeout(() => {
        if (settled) return;
        this.pollOrderStatus(orderId, timeoutMs - pollDelay)
          .then((info) => {
            if (settled) return;
            settled = true;
            cleanup();
            // Construct a WsPrivateEvent-like result from REST response
            resolve({
              OrderID: info.orderID,
              OrderType: info.orderType,
              StatusID: info.statusID,
              InstrumentID: info.instrumentID,
              CID: (info as any).CID ?? 0,
              RequestedUnits: info.units,
              ExecutedUnits: info.units,
              NetProfit: 0,
              CloseReason: '',
              OpenDateTime: info.requestOccurred,
              RequestOccurred: info.requestOccurred,
              PositionID: info.positions?.[0]?.positionID,
              Amount: info.amount,
              ErrorCode: info.errorCode ?? undefined,
              ErrorMessage: info.errorMessage ?? undefined,
            });
          })
          .catch((err) => {
            // Ignore polling errors — WS might still deliver
            if (!settled) {
              this.config.logger?.debug?.(`REST poll fallback failed: ${(err as Error).message}`);
            }
          });
      }, pollDelay);

      const handler = (event: WsPrivateEvent) => {
        if (event.OrderID !== orderId || settled) return;

        if (event.StatusID === OrderStatusId.Executed) {
          settled = true;
          cleanup();
          resolve(event);
        } else if (
          event.StatusID === OrderStatusId.Failed ||
          event.StatusID === OrderStatusId.Cancelled
        ) {
          settled = true;
          cleanup();
          reject(new EToroError(
            `Order ${orderId} ${OrderStatusId[event.StatusID]}: ${event.ErrorMessage ?? event.CloseReason ?? 'unknown reason'} (errorCode: ${event.ErrorCode ?? 'none'})`,
          ));
        }
        // StatusID 1 (Pending) or 2 (Filling) — keep waiting
      };

      const cleanup = () => {
        clearTimeout(timeout);
        if (pollTimer) clearTimeout(pollTimer);
        this.off('order:update', handler);
      };

      this.on('order:update', handler);
    });
  }

  /**
   * @deprecated Use `waitForOrder()` instead (WebSocket-based, faster).
   * Falls back to REST polling. Kept for backward compatibility.
   */
  async waitForOrderExecution(
    orderId: number,
    timeoutMs = 30_000,
    pollIntervalMs = 500,
  ): Promise<OrderForOpenInfoResponse> {
    return this.pollOrderStatus(orderId, timeoutMs, pollIntervalMs);
  }

  private async pollOrderStatus(
    orderId: number,
    timeoutMs: number,
    pollIntervalMs = 500,
  ): Promise<OrderForOpenInfoResponse> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const info = await this.rest.info.getOrder(orderId);

        if (info.statusID === OrderStatusId.Executed) {
          return info;
        }

        if (
          info.statusID === OrderStatusId.Cancelled ||
          info.statusID === OrderStatusId.Failed
        ) {
          throw new EToroError(
            `Order ${orderId} was ${OrderStatusId[info.statusID]}: ${info.errorMessage ?? 'unknown reason'}`,
          );
        }
      } catch (err) {
        // 404 can happen for very fast executions — keep polling
        if (err instanceof EToroError) throw err;
      }

      await sleep(pollIntervalMs);
    }

    throw new EToroError(`Timeout waiting for order ${orderId} execution after ${timeoutMs}ms`);
  }

  // --- Instrument Resolution Helpers ---

  async resolveInstrument(symbolOrId: string | number): Promise<number> {
    return this.resolver.resolve(symbolOrId);
  }

  async preloadInstruments(symbols: string[]): Promise<void> {
    return this.resolver.preload(symbols);
  }

  // --- Instrument Info / Display Name ---

  /**
   * Get the display name for an instrument (e.g. "Bitcoin", "Apple").
   *
   * @example
   * await etoro.getDisplayName(100000);  // "Bitcoin"
   * await etoro.getDisplayName('AAPL');  // "Apple"
   */
  async getDisplayName(symbolOrId: string | number): Promise<string> {
    return this.resolver.getDisplayName(symbolOrId);
  }

  /**
   * Get full instrument info including display name, symbol, type, exchange, image URL.
   *
   * @example
   * const info = await etoro.getInstrumentInfo('BTC');
   * console.log(`${info.displayName} (${info.symbolFull})`); // "Bitcoin (BTC)"
   */
  async getInstrumentInfo(symbolOrId: string | number) {
    return this.resolver.getInstrumentInfo(symbolOrId);
  }

  /**
   * Get instrument info for multiple instruments in parallel.
   * Accepts instrument IDs or symbols (mixed).
   *
   * @example
   * const infos = await etoro.getInstrumentInfoBatch(['BTC', 'AAPL', 'TSLA']);
   * for (const info of infos) {
   *   console.log(`${info.symbolFull}: ${info.displayName}`);
   * }
   */
  async getInstrumentInfoBatch(symbolsOrIds: (string | number)[]) {
    const ids = await Promise.all(symbolsOrIds.map((s) => this.resolver.resolve(s)));
    return this.resolver.getInstrumentInfoBatch(ids);
  }

  /**
   * Preload instrument metadata for a list of IDs (e.g. from portfolio positions).
   * After preloading, display names are available synchronously via resolver.getCachedDisplayName().
   *
   * @example
   * const portfolio = await etoro.getPortfolio();
   * const ids = portfolio.clientPortfolio.positions.map(p => p.instrumentID);
   * await etoro.preloadInstrumentMetadata(ids);
   * // Now use: etoro.resolver.getCachedDisplayName(id)
   */
  async preloadInstrumentMetadata(instrumentIds: number[]): Promise<void> {
    return this.resolver.preloadMetadata(instrumentIds);
  }
}
