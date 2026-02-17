import { HttpClient } from '../http/http-client';
import { API_PREFIX } from '../config/constants';
import type { TradingMode } from '../types/enums';
import type {
  MarketOrderByAmountRequest,
  MarketOrderByUnitsRequest,
  LimitOrderRequest,
  ClosePositionRequest,
  OrderForOpenResponse,
  OrderForCloseResponse,
} from '../types/trading';
import type { TokenResponse } from '../types/common';

export class TradingExecutionClient {
  private readonly pathPrefix: string;

  constructor(
    private readonly http: HttpClient,
    mode: TradingMode,
  ) {
    this.pathPrefix = mode === 'demo'
      ? `${API_PREFIX}/trading/execution/demo`
      : `${API_PREFIX}/trading/execution`;
  }

  async openMarketOrderByAmount(params: MarketOrderByAmountRequest): Promise<OrderForOpenResponse> {
    return this.http.request({
      method: 'POST',
      path: `${this.pathPrefix}/market-open-orders/by-amount`,
      body: params,
    });
  }

  async openMarketOrderByUnits(params: MarketOrderByUnitsRequest): Promise<OrderForOpenResponse> {
    return this.http.request({
      method: 'POST',
      path: `${this.pathPrefix}/market-open-orders/by-units`,
      body: params,
    });
  }

  async cancelMarketOpenOrder(orderId: number): Promise<TokenResponse> {
    return this.http.request({
      method: 'DELETE',
      path: `${this.pathPrefix}/market-open-orders/${orderId}`,
    });
  }

  async openLimitOrder(params: LimitOrderRequest): Promise<TokenResponse> {
    return this.http.request({
      method: 'POST',
      path: `${this.pathPrefix}/limit-orders`,
      body: params,
    });
  }

  async cancelLimitOrder(orderId: number): Promise<TokenResponse> {
    return this.http.request({
      method: 'DELETE',
      path: `${this.pathPrefix}/limit-orders/${orderId}`,
    });
  }

  async closePosition(positionId: number, params?: ClosePositionRequest): Promise<OrderForCloseResponse> {
    return this.http.request({
      method: 'POST',
      path: `${this.pathPrefix}/market-close-orders/positions/${positionId}`,
      body: params ?? {},
    });
  }

  async cancelCloseOrder(orderId: number): Promise<TokenResponse> {
    return this.http.request({
      method: 'DELETE',
      path: `${this.pathPrefix}/market-close-orders/${orderId}`,
    });
  }
}
