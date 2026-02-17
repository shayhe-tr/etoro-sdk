import { HttpClient } from '../http/http-client';
import { API_PREFIX } from '../config/constants';
import type { TradingMode } from '../types/enums';
import type {
  PortfolioResponse,
  PnlResponse,
  OrderForOpenInfoResponse,
  TradeHistoryParams,
  TradeHistoryEntry,
} from '../types/trading';

export class TradingInfoClient {
  private readonly infoPrefix: string;
  private readonly portfolioPath: string;

  constructor(
    private readonly http: HttpClient,
    mode: TradingMode,
  ) {
    if (mode === 'demo') {
      this.infoPrefix = `${API_PREFIX}/trading/info/demo`;
      this.portfolioPath = `${API_PREFIX}/trading/info/demo/portfolio`;
    } else {
      this.infoPrefix = `${API_PREFIX}/trading/info/real`;
      this.portfolioPath = `${API_PREFIX}/trading/info/portfolio`;
    }
  }

  async getPortfolio(): Promise<PortfolioResponse> {
    return this.http.request({
      method: 'GET',
      path: this.portfolioPath,
    });
  }

  async getPnl(): Promise<PnlResponse> {
    return this.http.request({
      method: 'GET',
      path: `${this.infoPrefix}/pnl`,
    });
  }

  async getOrder(orderId: number): Promise<OrderForOpenInfoResponse> {
    return this.http.request({
      method: 'GET',
      path: `${this.infoPrefix}/orders/${orderId}`,
    });
  }

  async getTradeHistory(params: TradeHistoryParams): Promise<TradeHistoryEntry[]> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/trading/info/trade/history`,
      query: {
        minDate: params.minDate,
        page: params.page,
        pageSize: params.pageSize,
      },
    });
  }
}
