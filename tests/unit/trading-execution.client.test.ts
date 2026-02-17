import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TradingExecutionClient } from '../../src/rest/trading-execution.client';
import { HttpClient } from '../../src/http/http-client';

describe('TradingExecutionClient', () => {
  let mockHttp: { request: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockHttp = { request: vi.fn().mockResolvedValue({}) };
  });

  describe('real mode paths', () => {
    let client: TradingExecutionClient;

    beforeEach(() => {
      client = new TradingExecutionClient(mockHttp as unknown as HttpClient, 'real');
    });

    it('should use real path for openMarketOrderByAmount', async () => {
      await client.openMarketOrderByAmount({
        InstrumentID: 100,
        IsBuy: true,
        Leverage: 1,
        Amount: 500,
      });

      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/api/v1/trading/execution/market-open-orders/by-amount',
        body: {
          InstrumentID: 100,
          IsBuy: true,
          Leverage: 1,
          Amount: 500,
        },
      });
    });

    it('should use real path for closePosition', async () => {
      await client.closePosition(12345, { UnitsToDeduct: 5 });

      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/api/v1/trading/execution/market-close-orders/positions/12345',
        body: { UnitsToDeduct: 5 },
      });
    });

    it('should use real path for limit orders', async () => {
      await client.openLimitOrder({
        InstrumentID: 100,
        IsBuy: true,
        Leverage: 1,
        Amount: 500,
        Rate: 150,
        StopLossRate: 140,
        TakeProfitRate: 170,
      });

      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/api/v1/trading/execution/limit-orders',
        body: expect.objectContaining({ InstrumentID: 100, Rate: 150 }),
      });
    });

    it('should cancel market open order', async () => {
      await client.cancelMarketOpenOrder(99);
      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'DELETE',
        path: '/api/v1/trading/execution/market-open-orders/99',
      });
    });

    it('should cancel limit order', async () => {
      await client.cancelLimitOrder(88);
      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'DELETE',
        path: '/api/v1/trading/execution/limit-orders/88',
      });
    });

    it('should cancel close order', async () => {
      await client.cancelCloseOrder(77);
      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'DELETE',
        path: '/api/v1/trading/execution/market-close-orders/77',
      });
    });
  });

  describe('demo mode paths', () => {
    let client: TradingExecutionClient;

    beforeEach(() => {
      client = new TradingExecutionClient(mockHttp as unknown as HttpClient, 'demo');
    });

    it('should use demo path for openMarketOrderByAmount', async () => {
      await client.openMarketOrderByAmount({
        InstrumentID: 100,
        IsBuy: true,
        Leverage: 1,
        Amount: 500,
      });

      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/api/v1/trading/execution/demo/market-open-orders/by-amount',
        body: expect.objectContaining({ InstrumentID: 100 }),
      });
    });

    it('should use demo path for closePosition', async () => {
      await client.closePosition(12345);

      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/api/v1/trading/execution/demo/market-close-orders/positions/12345',
        body: {},
      });
    });

    it('should use demo path for limit orders', async () => {
      await client.openLimitOrder({
        InstrumentID: 100,
        IsBuy: false,
        Leverage: 2,
        Amount: 200,
        Rate: 160,
        StopLossRate: 170,
        TakeProfitRate: 140,
      });

      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/api/v1/trading/execution/demo/limit-orders',
        body: expect.objectContaining({ InstrumentID: 100 }),
      });
    });
  });
});
