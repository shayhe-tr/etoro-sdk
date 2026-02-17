import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EToroTrading } from '../../src/trading/trading-client';
import { OrderStatusId } from '../../src/types/enums';
import type { PortfolioResponse, OrderForOpenResponse, OrderForCloseResponse } from '../../src/types/trading';
import type { WsPrivateEvent } from '../../src/types/websocket';
import type { TokenResponse } from '../../src/types/common';

// Mock portfolio response factory
function makePortfolio(overrides?: Partial<PortfolioResponse>): PortfolioResponse {
  return {
    clientPortfolio: {
      credit: 1000,
      positions: [
        {
          positionID: 101,
          CID: 1,
          openDateTime: '2024-01-01T00:00:00Z',
          openRate: 150,
          instrumentID: 1001,
          isBuy: true,
          leverage: 1,
          takeProfitRate: 200,
          stopLossRate: 100,
          mirrorID: 0,
          parentPositionID: 0,
          amount: 500,
          orderID: 201,
          orderType: 1,
          units: 3.33,
          totalFees: 0,
          initialAmountInDollars: 500,
          isTslEnabled: false,
          stopLossVersion: 0,
          isSettled: true,
          redeemStatusID: 0,
          initialUnits: 3.33,
          isPartiallyAltered: false,
          unitsBaseValueDollars: 500,
          isDiscounted: false,
          openPositionActionType: 0,
          settlementTypeID: 1,
          isDetached: false,
          openConversionRate: 1,
          pnlVersion: 0,
          totalExternalFees: 0,
          totalExternalTaxes: 0,
          isNoTakeProfit: false,
          isNoStopLoss: false,
          lotCount: 0,
        },
        {
          positionID: 102,
          CID: 1,
          openDateTime: '2024-02-01T00:00:00Z',
          openRate: 68000,
          instrumentID: 100000,
          isBuy: true,
          leverage: 1,
          takeProfitRate: 0,
          stopLossRate: 0,
          mirrorID: 0,
          parentPositionID: 0,
          amount: 100,
          orderID: 202,
          orderType: 1,
          units: 0.00147,
          totalFees: 0,
          initialAmountInDollars: 100,
          isTslEnabled: false,
          stopLossVersion: 0,
          isSettled: true,
          redeemStatusID: 0,
          initialUnits: 0.00147,
          isPartiallyAltered: false,
          unitsBaseValueDollars: 100,
          isDiscounted: false,
          openPositionActionType: 0,
          settlementTypeID: 3,
          isDetached: false,
          openConversionRate: 1,
          pnlVersion: 0,
          totalExternalFees: 0,
          totalExternalTaxes: 0,
          isNoTakeProfit: true,
          isNoStopLoss: true,
          lotCount: 0,
        },
      ],
      mirrors: [
        {
          mirrorID: 301,
          CID: 1,
          parentCID: 2,
          stopLossPercentage: 40,
          isPaused: false,
          copyExistingPositions: true,
          availableAmount: 100,
          stopLossAmount: 200,
          initialInvestment: 500,
          depositSummary: 500,
          withdrawalSummary: 0,
          positions: [
            {
              positionID: 401,
              CID: 2,
              openDateTime: '2024-03-01T00:00:00Z',
              openRate: 200,
              instrumentID: 2002,
              isBuy: true,
              leverage: 1,
              takeProfitRate: 0,
              stopLossRate: 0,
              mirrorID: 301,
              parentPositionID: 0,
              amount: 50,
              orderID: 501,
              orderType: 1,
              units: 0.25,
              totalFees: 0,
              initialAmountInDollars: 50,
              isTslEnabled: false,
              stopLossVersion: 0,
              isSettled: true,
              redeemStatusID: 0,
              initialUnits: 0.25,
              isPartiallyAltered: false,
              unitsBaseValueDollars: 50,
              isDiscounted: false,
              openPositionActionType: 0,
              settlementTypeID: 1,
              isDetached: false,
              openConversionRate: 1,
              pnlVersion: 0,
              totalExternalFees: 0,
              totalExternalTaxes: 0,
              isNoTakeProfit: true,
              isNoStopLoss: true,
              lotCount: 0,
            },
          ],
          parentUsername: 'TestTrader',
          closedPositionsNetProfit: 0,
          startedCopyDate: '2024-01-01',
          pendingForClosure: false,
          mirrorStatusID: 0,
          ordersForOpen: [],
          ordersForClose: [],
          ordersForCloseMultiple: [],
        },
      ],
      orders: [
        {
          orderID: 601,
          CID: 1,
          openDateTime: '2024-04-01T00:00:00Z',
          instrumentID: 1001,
          isBuy: true,
          takeProfitRate: 200,
          stopLossRate: 100,
          rate: 140,
          amount: 200,
          leverage: 1,
          units: 1.43,
          isTslEnabled: false,
          executionType: 2,
        },
        {
          orderID: 602,
          CID: 1,
          openDateTime: '2024-04-02T00:00:00Z',
          instrumentID: 100000,
          isBuy: true,
          takeProfitRate: 0,
          stopLossRate: 0,
          rate: 60000,
          amount: 50,
          leverage: 1,
          units: 0.00083,
          isTslEnabled: false,
          executionType: 2,
        },
      ],
      ordersForOpen: [
        {
          orderID: 701,
          CID: 1,
          openDateTime: '2024-04-03T00:00:00Z',
          instrumentID: 2002,
          isBuy: false,
          takeProfitRate: 150,
          stopLossRate: 250,
          rate: 0,
          amount: 100,
          leverage: 2,
          units: 0.5,
          isTslEnabled: false,
          executionType: 1,
        },
      ],
      ordersForClose: [],
      ordersForCloseMultiple: [],
      bonusCredit: 0,
      ...overrides?.clientPortfolio,
    },
  };
}

describe('EToroTrading', () => {
  let etoro: EToroTrading;
  let mockPortfolio: PortfolioResponse;

  beforeEach(() => {
    etoro = new EToroTrading({
      apiKey: 'test-key',
      userKey: 'test-user',
      mode: 'demo',
    });
    mockPortfolio = makePortfolio();
  });

  // --- closePosition ---

  describe('closePosition', () => {
    it('should close a direct position with correct instrumentId', async () => {
      vi.spyOn(etoro.rest.info, 'getPortfolio').mockResolvedValue(mockPortfolio);
      vi.spyOn(etoro.rest.execution, 'closePosition').mockResolvedValue({ token: 'close-token' });

      const result = await etoro.closePosition(101);

      expect(etoro.rest.execution.closePosition).toHaveBeenCalledWith(101, {
        InstrumentId: 1001,
        UnitsToDeduct: undefined,
      });
      expect(result.token).toBe('close-token');
    });

    it('should close with partial units when unitsToDeduct is specified', async () => {
      vi.spyOn(etoro.rest.info, 'getPortfolio').mockResolvedValue(mockPortfolio);
      vi.spyOn(etoro.rest.execution, 'closePosition').mockResolvedValue({ token: 'partial-token' });

      await etoro.closePosition(102, 0.0005);

      expect(etoro.rest.execution.closePosition).toHaveBeenCalledWith(102, {
        InstrumentId: 100000,
        UnitsToDeduct: 0.0005,
      });
    });

    it('should find position in mirrors when not in direct positions', async () => {
      vi.spyOn(etoro.rest.info, 'getPortfolio').mockResolvedValue(mockPortfolio);
      vi.spyOn(etoro.rest.execution, 'closePosition').mockResolvedValue({ token: 'mirror-token' });

      await etoro.closePosition(401);

      expect(etoro.rest.execution.closePosition).toHaveBeenCalledWith(401, {
        InstrumentId: 2002,
        UnitsToDeduct: undefined,
      });
    });

    it('should throw EToroValidationError if position not found', async () => {
      vi.spyOn(etoro.rest.info, 'getPortfolio').mockResolvedValue(mockPortfolio);

      await expect(etoro.closePosition(999)).rejects.toThrow('Position 999 not found in portfolio');
    });
  });

  // --- closeAllPositions ---

  describe('closeAllPositions', () => {
    it('should close all direct positions', async () => {
      vi.spyOn(etoro.rest.info, 'getPortfolio').mockResolvedValue(mockPortfolio);
      vi.spyOn(etoro.rest.execution, 'closePosition').mockResolvedValue({ token: 'ok' });

      const results = await etoro.closeAllPositions();

      expect(results).toHaveLength(2);
      expect(etoro.rest.execution.closePosition).toHaveBeenCalledTimes(2);
      expect(etoro.rest.execution.closePosition).toHaveBeenCalledWith(101, { InstrumentId: 1001 });
      expect(etoro.rest.execution.closePosition).toHaveBeenCalledWith(102, { InstrumentId: 100000 });
    });

    it('should return empty array when no positions', async () => {
      const emptyPortfolio = makePortfolio();
      emptyPortfolio.clientPortfolio.positions = [];
      vi.spyOn(etoro.rest.info, 'getPortfolio').mockResolvedValue(emptyPortfolio);

      const results = await etoro.closeAllPositions();
      expect(results).toHaveLength(0);
    });
  });

  // --- getPositions ---

  describe('getPositions', () => {
    it('should return direct positions from portfolio', async () => {
      vi.spyOn(etoro.rest.info, 'getPortfolio').mockResolvedValue(mockPortfolio);

      const positions = await etoro.getPositions();

      expect(positions).toHaveLength(2);
      expect(positions[0].positionID).toBe(101);
      expect(positions[1].positionID).toBe(102);
    });
  });

  // --- getPendingOrders ---

  describe('getPendingOrders', () => {
    it('should return combined limit orders and market open orders', async () => {
      vi.spyOn(etoro.rest.info, 'getPortfolio').mockResolvedValue(mockPortfolio);

      const orders = await etoro.getPendingOrders();

      // 2 limit orders + 1 market open order = 3 total
      expect(orders).toHaveLength(3);
      expect(orders.map((o) => o.orderID)).toEqual([601, 602, 701]);
    });

    it('should return empty array when no pending orders', async () => {
      const emptyPortfolio = makePortfolio();
      emptyPortfolio.clientPortfolio.orders = [];
      emptyPortfolio.clientPortfolio.ordersForOpen = [];
      vi.spyOn(etoro.rest.info, 'getPortfolio').mockResolvedValue(emptyPortfolio);

      const orders = await etoro.getPendingOrders();
      expect(orders).toHaveLength(0);
    });
  });

  // --- cancelAllOrders ---

  describe('cancelAllOrders', () => {
    it('should cancel all pending market open orders', async () => {
      vi.spyOn(etoro.rest.info, 'getPortfolio').mockResolvedValue(mockPortfolio);
      vi.spyOn(etoro.rest.execution, 'cancelMarketOpenOrder').mockResolvedValue({ token: 'cancelled' });

      const results = await etoro.cancelAllOrders();

      // Only 1 ordersForOpen entry (701)
      expect(results).toHaveLength(1);
      expect(etoro.rest.execution.cancelMarketOpenOrder).toHaveBeenCalledWith(701);
    });

    it('should return empty array when no market open orders', async () => {
      const emptyPortfolio = makePortfolio();
      emptyPortfolio.clientPortfolio.ordersForOpen = [];
      vi.spyOn(etoro.rest.info, 'getPortfolio').mockResolvedValue(emptyPortfolio);

      const results = await etoro.cancelAllOrders();
      expect(results).toHaveLength(0);
    });
  });

  // --- cancelAllLimitOrders ---

  describe('cancelAllLimitOrders', () => {
    it('should cancel all pending limit orders', async () => {
      vi.spyOn(etoro.rest.info, 'getPortfolio').mockResolvedValue(mockPortfolio);
      vi.spyOn(etoro.rest.execution, 'cancelLimitOrder').mockResolvedValue({ token: 'cancelled' });

      const results = await etoro.cancelAllLimitOrders();

      // 2 limit orders (601, 602)
      expect(results).toHaveLength(2);
      expect(etoro.rest.execution.cancelLimitOrder).toHaveBeenCalledWith(601);
      expect(etoro.rest.execution.cancelLimitOrder).toHaveBeenCalledWith(602);
    });
  });

  // --- waitForOrder (WS-based) ---

  describe('waitForOrder', () => {
    it('should throw if WebSocket is not connected', async () => {
      await expect(etoro.waitForOrder(123)).rejects.toThrow(
        'WebSocket not connected',
      );
    });

    it('should resolve on Executed event from WS', async () => {
      // Fake the WS as connected
      Object.defineProperty(etoro.ws, 'isConnected', { get: () => true });
      vi.spyOn(etoro.ws, 'subscribe').mockImplementation(() => {});

      const executedEvent: WsPrivateEvent = {
        OrderID: 999,
        OrderType: 1,
        StatusID: OrderStatusId.Executed,
        InstrumentID: 100000,
        CID: 1,
        RequestedUnits: 0.001,
        ExecutedUnits: 0.001,
        NetProfit: 0,
        CloseReason: '',
        OpenDateTime: '2024-01-01T00:00:00Z',
        RequestOccurred: '2024-01-01T00:00:00Z',
        PositionID: 12345,
        Amount: 50,
      };

      // Simulate WS delivering an executed event shortly after call
      const promise = etoro.waitForOrder(999, 5000);

      // Emit the event on next tick
      setTimeout(() => {
        etoro.emit('order:update', executedEvent);
      }, 10);

      const result = await promise;
      expect(result.OrderID).toBe(999);
      expect(result.StatusID).toBe(OrderStatusId.Executed);
      expect(result.PositionID).toBe(12345);
    });

    it('should reject on Failed event from WS', async () => {
      Object.defineProperty(etoro.ws, 'isConnected', { get: () => true });
      vi.spyOn(etoro.ws, 'subscribe').mockImplementation(() => {});

      const failedEvent: WsPrivateEvent = {
        OrderID: 888,
        OrderType: 1,
        StatusID: OrderStatusId.Failed,
        InstrumentID: 100000,
        CID: 1,
        RequestedUnits: 0.001,
        ExecutedUnits: 0,
        NetProfit: 0,
        CloseReason: '',
        OpenDateTime: '2024-01-01T00:00:00Z',
        RequestOccurred: '2024-01-01T00:00:00Z',
        ErrorCode: 1001,
        ErrorMessage: 'Insufficient funds',
      };

      const promise = etoro.waitForOrder(888, 5000);

      setTimeout(() => {
        etoro.emit('order:update', failedEvent);
      }, 10);

      await expect(promise).rejects.toThrow('Insufficient funds');
    });

    it('should reject on Cancelled event from WS', async () => {
      Object.defineProperty(etoro.ws, 'isConnected', { get: () => true });
      vi.spyOn(etoro.ws, 'subscribe').mockImplementation(() => {});

      const cancelledEvent: WsPrivateEvent = {
        OrderID: 777,
        OrderType: 1,
        StatusID: OrderStatusId.Cancelled,
        InstrumentID: 100000,
        CID: 1,
        RequestedUnits: 0.001,
        ExecutedUnits: 0,
        NetProfit: 0,
        CloseReason: 'User cancelled',
        OpenDateTime: '2024-01-01T00:00:00Z',
        RequestOccurred: '2024-01-01T00:00:00Z',
      };

      const promise = etoro.waitForOrder(777, 5000);

      setTimeout(() => {
        etoro.emit('order:update', cancelledEvent);
      }, 10);

      await expect(promise).rejects.toThrow('Cancelled');
    });

    it('should ignore events for other order IDs', async () => {
      Object.defineProperty(etoro.ws, 'isConnected', { get: () => true });
      vi.spyOn(etoro.ws, 'subscribe').mockImplementation(() => {});

      const otherEvent: WsPrivateEvent = {
        OrderID: 555,
        OrderType: 1,
        StatusID: OrderStatusId.Executed,
        InstrumentID: 100000,
        CID: 1,
        RequestedUnits: 0.001,
        ExecutedUnits: 0.001,
        NetProfit: 0,
        CloseReason: '',
        OpenDateTime: '2024-01-01T00:00:00Z',
        RequestOccurred: '2024-01-01T00:00:00Z',
      };

      const targetEvent: WsPrivateEvent = {
        ...otherEvent,
        OrderID: 666,
        PositionID: 999,
      };

      const promise = etoro.waitForOrder(666, 5000);

      setTimeout(() => {
        etoro.emit('order:update', otherEvent); // should be ignored
        etoro.emit('order:update', targetEvent); // should resolve
      }, 10);

      const result = await promise;
      expect(result.OrderID).toBe(666);
    });

    it('should timeout if no terminal event arrives', async () => {
      Object.defineProperty(etoro.ws, 'isConnected', { get: () => true });
      vi.spyOn(etoro.ws, 'subscribe').mockImplementation(() => {});

      // Also mock the REST fallback to fail
      vi.spyOn(etoro.rest.info, 'getOrder').mockRejectedValue(new Error('Not found'));

      await expect(etoro.waitForOrder(444, 200)).rejects.toThrow(
        'Timeout waiting for order 444',
      );
    }, 10_000);

    it('should skip Pending/Filling events and keep waiting', async () => {
      Object.defineProperty(etoro.ws, 'isConnected', { get: () => true });
      vi.spyOn(etoro.ws, 'subscribe').mockImplementation(() => {});

      const pendingEvent: WsPrivateEvent = {
        OrderID: 333,
        OrderType: 1,
        StatusID: OrderStatusId.Pending,
        InstrumentID: 100000,
        CID: 1,
        RequestedUnits: 0.001,
        ExecutedUnits: 0,
        NetProfit: 0,
        CloseReason: '',
        OpenDateTime: '2024-01-01T00:00:00Z',
        RequestOccurred: '2024-01-01T00:00:00Z',
      };

      const fillingEvent: WsPrivateEvent = {
        ...pendingEvent,
        StatusID: OrderStatusId.Filling,
      };

      const executedEvent: WsPrivateEvent = {
        ...pendingEvent,
        StatusID: OrderStatusId.Executed,
        ExecutedUnits: 0.001,
        PositionID: 7777,
      };

      const promise = etoro.waitForOrder(333, 5000);

      setTimeout(() => {
        etoro.emit('order:update', pendingEvent);
        etoro.emit('order:update', fillingEvent);
      }, 10);

      setTimeout(() => {
        etoro.emit('order:update', executedEvent);
      }, 50);

      const result = await promise;
      expect(result.StatusID).toBe(OrderStatusId.Executed);
      expect(result.PositionID).toBe(7777);
    });
  });

  // --- buyByAmount / sellByAmount ---

  describe('buyByAmount', () => {
    it('should resolve symbol and call openMarketOrderByAmount', async () => {
      vi.spyOn(etoro.resolver, 'resolve').mockResolvedValue(1001);
      vi.spyOn(etoro.rest.execution, 'openMarketOrderByAmount').mockResolvedValue({
        orderForOpen: {
          orderID: 123,
          instrumentID: 1001,
          amount: 500,
          isBuy: true,
          leverage: 1,
          stopLossRate: 0,
          takeProfitRate: 0,
          isTslEnabled: false,
          mirrorID: 0,
          totalExternalCosts: 0,
          orderType: 1,
          statusID: 1,
          CID: 1,
          openDateTime: '',
          lastUpdate: '',
        },
        token: 'buy-token',
      });

      const result = await etoro.buyByAmount('AAPL', 500);

      expect(etoro.resolver.resolve).toHaveBeenCalledWith('AAPL');
      expect(etoro.rest.execution.openMarketOrderByAmount).toHaveBeenCalledWith({
        InstrumentID: 1001,
        IsBuy: true,
        Leverage: 1,
        Amount: 500,
        StopLossRate: undefined,
        TakeProfitRate: undefined,
        IsTslEnabled: undefined,
      });
      expect(result.token).toBe('buy-token');
    });

    it('should pass options (leverage, stopLoss, takeProfit)', async () => {
      vi.spyOn(etoro.resolver, 'resolve').mockResolvedValue(100000);
      vi.spyOn(etoro.rest.execution, 'openMarketOrderByAmount').mockResolvedValue({
        orderForOpen: {} as any,
        token: 'options-token',
      });

      await etoro.buyByAmount('BTC', 1000, {
        leverage: 2,
        stopLoss: 95000,
        takeProfit: 110000,
        trailingStopLoss: true,
      });

      expect(etoro.rest.execution.openMarketOrderByAmount).toHaveBeenCalledWith({
        InstrumentID: 100000,
        IsBuy: true,
        Leverage: 2,
        Amount: 1000,
        StopLossRate: 95000,
        TakeProfitRate: 110000,
        IsTslEnabled: true,
      });
    });
  });

  describe('sellByAmount', () => {
    it('should set IsBuy to false', async () => {
      vi.spyOn(etoro.resolver, 'resolve').mockResolvedValue(1001);
      vi.spyOn(etoro.rest.execution, 'openMarketOrderByAmount').mockResolvedValue({
        orderForOpen: {} as any,
        token: 'sell-token',
      });

      await etoro.sellByAmount('AAPL', 200);

      expect(etoro.rest.execution.openMarketOrderByAmount).toHaveBeenCalledWith(
        expect.objectContaining({ IsBuy: false, Amount: 200 }),
      );
    });
  });

  // --- buyByUnits / sellByUnits ---

  describe('buyByUnits', () => {
    it('should resolve symbol and call openMarketOrderByUnits', async () => {
      vi.spyOn(etoro.resolver, 'resolve').mockResolvedValue(1001);
      vi.spyOn(etoro.rest.execution, 'openMarketOrderByUnits').mockResolvedValue({
        orderForOpen: {} as any,
        token: 'units-token',
      });

      await etoro.buyByUnits('AAPL', 10);

      expect(etoro.rest.execution.openMarketOrderByUnits).toHaveBeenCalledWith({
        InstrumentID: 1001,
        IsBuy: true,
        Leverage: 1,
        AmountInUnits: 10,
        StopLossRate: undefined,
        TakeProfitRate: undefined,
        IsTslEnabled: undefined,
      });
    });
  });

  describe('sellByUnits', () => {
    it('should set IsBuy to false for sell by units', async () => {
      vi.spyOn(etoro.resolver, 'resolve').mockResolvedValue(1001);
      vi.spyOn(etoro.rest.execution, 'openMarketOrderByUnits').mockResolvedValue({
        orderForOpen: {} as any,
        token: 'sell-units-token',
      });

      await etoro.sellByUnits('AAPL', 5);

      expect(etoro.rest.execution.openMarketOrderByUnits).toHaveBeenCalledWith(
        expect.objectContaining({ IsBuy: false, AmountInUnits: 5 }),
      );
    });
  });

  // --- placeLimitOrder ---

  describe('placeLimitOrder', () => {
    it('should resolve symbol and create limit order', async () => {
      vi.spyOn(etoro.resolver, 'resolve').mockResolvedValue(1001);
      vi.spyOn(etoro.rest.execution, 'openLimitOrder').mockResolvedValue({ token: 'limit-token' });

      const result = await etoro.placeLimitOrder('AAPL', true, 180, 500, {
        stopLoss: 170,
        takeProfit: 200,
      });

      expect(etoro.rest.execution.openLimitOrder).toHaveBeenCalledWith({
        InstrumentID: 1001,
        IsBuy: true,
        Leverage: 1,
        Amount: 500,
        Rate: 180,
        StopLossRate: 170,
        TakeProfitRate: 200,
        IsTslEnabled: undefined,
      });
      expect(result.token).toBe('limit-token');
    });

    it('should default stopLoss and takeProfit to 0 when not specified', async () => {
      vi.spyOn(etoro.resolver, 'resolve').mockResolvedValue(1001);
      vi.spyOn(etoro.rest.execution, 'openLimitOrder').mockResolvedValue({ token: 'tok' });

      await etoro.placeLimitOrder('AAPL', false, 160, 300);

      expect(etoro.rest.execution.openLimitOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          StopLossRate: 0,
          TakeProfitRate: 0,
        }),
      );
    });
  });

  // --- cancelOrder / cancelLimitOrder ---

  describe('cancelOrder', () => {
    it('should cancel a market open order by ID', async () => {
      vi.spyOn(etoro.rest.execution, 'cancelMarketOpenOrder').mockResolvedValue({ token: 'cancel-tok' });

      const result = await etoro.cancelOrder(701);

      expect(etoro.rest.execution.cancelMarketOpenOrder).toHaveBeenCalledWith(701);
      expect(result.token).toBe('cancel-tok');
    });
  });

  describe('cancelLimitOrder', () => {
    it('should cancel a limit order by ID', async () => {
      vi.spyOn(etoro.rest.execution, 'cancelLimitOrder').mockResolvedValue({ token: 'limit-cancel-tok' });

      const result = await etoro.cancelLimitOrder(601);

      expect(etoro.rest.execution.cancelLimitOrder).toHaveBeenCalledWith(601);
      expect(result.token).toBe('limit-cancel-tok');
    });
  });

  // --- getPortfolio / getPnl / getTradeHistory ---

  describe('getPortfolio', () => {
    it('should delegate to rest.info.getPortfolio', async () => {
      vi.spyOn(etoro.rest.info, 'getPortfolio').mockResolvedValue(mockPortfolio);

      const result = await etoro.getPortfolio();
      expect(result.clientPortfolio.credit).toBe(1000);
      expect(result.clientPortfolio.positions).toHaveLength(2);
    });
  });

  describe('getPnl', () => {
    it('should delegate to rest.info.getPnl', async () => {
      vi.spyOn(etoro.rest.info, 'getPnl').mockResolvedValue(mockPortfolio);

      const result = await etoro.getPnl();
      expect(result).toBe(mockPortfolio);
    });
  });

  describe('getTradeHistory', () => {
    it('should delegate to rest.info.getTradeHistory', async () => {
      const mockHistory = [{ netProfit: 10, positionId: 1 }];
      vi.spyOn(etoro.rest.info, 'getTradeHistory').mockResolvedValue(mockHistory as any);

      const result = await etoro.getTradeHistory('2024-01-01', 1, 50);
      expect(etoro.rest.info.getTradeHistory).toHaveBeenCalledWith({
        minDate: '2024-01-01',
        page: 1,
        pageSize: 50,
      });
      expect(result).toHaveLength(1);
    });
  });

  // --- resolveInstrument / preloadInstruments ---

  describe('resolveInstrument', () => {
    it('should delegate to resolver.resolve', async () => {
      vi.spyOn(etoro.resolver, 'resolve').mockResolvedValue(1001);

      const id = await etoro.resolveInstrument('AAPL');
      expect(id).toBe(1001);
    });
  });

  describe('preloadInstruments', () => {
    it('should delegate to resolver.preload', async () => {
      vi.spyOn(etoro.resolver, 'preload').mockResolvedValue();

      await etoro.preloadInstruments(['AAPL', 'BTC', 'TSLA']);
      expect(etoro.resolver.preload).toHaveBeenCalledWith(['AAPL', 'BTC', 'TSLA']);
    });
  });
});
