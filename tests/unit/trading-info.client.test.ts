import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TradingInfoClient } from '../../src/rest/trading-info.client';
import { HttpClient } from '../../src/http/http-client';

describe('TradingInfoClient', () => {
  let mockHttp: { request: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockHttp = { request: vi.fn().mockResolvedValue({}) };
  });

  describe('real mode', () => {
    let client: TradingInfoClient;

    beforeEach(() => {
      client = new TradingInfoClient(mockHttp as unknown as HttpClient, 'real');
    });

    it('should use /trading/info/portfolio for real portfolio', async () => {
      await client.getPortfolio();
      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api/v1/trading/info/portfolio',
      });
    });

    it('should use real path for PnL', async () => {
      await client.getPnl();
      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api/v1/trading/info/real/pnl',
      });
    });

    it('should use real path for order info', async () => {
      await client.getOrder(12345);
      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api/v1/trading/info/real/orders/12345',
      });
    });
  });

  describe('demo mode', () => {
    let client: TradingInfoClient;

    beforeEach(() => {
      client = new TradingInfoClient(mockHttp as unknown as HttpClient, 'demo');
    });

    it('should use demo path for portfolio', async () => {
      await client.getPortfolio();
      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api/v1/trading/info/demo/portfolio',
      });
    });

    it('should use demo path for PnL', async () => {
      await client.getPnl();
      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api/v1/trading/info/demo/pnl',
      });
    });
  });

  describe('trade history', () => {
    it('should pass query params for trade history', async () => {
      const client = new TradingInfoClient(mockHttp as unknown as HttpClient, 'real');
      await client.getTradeHistory({ minDate: '2024-01-01', page: 1, pageSize: 50 });
      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api/v1/trading/info/trade/history',
        query: { minDate: '2024-01-01', page: 1, pageSize: 50 },
      });
    });
  });
});
