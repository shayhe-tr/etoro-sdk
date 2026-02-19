import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketDataClient } from '../../src/rest/market-data.client';
import { HttpClient } from '../../src/http/http-client';
import { CandleDirection, CandleInterval } from '../../src/types/enums';
import { EToroValidationError } from '../../src/errors/validation-error';

describe('MarketDataClient', () => {
  let client: MarketDataClient;
  let mockHttp: { request: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockHttp = { request: vi.fn().mockResolvedValue({}) };
    client = new MarketDataClient(mockHttp as unknown as HttpClient);
  });

  describe('searchInstruments', () => {
    it('should call correct path and query', async () => {
      await client.searchInstruments({
        fields: 'instrumentId,displayname',
        searchText: 'AAPL',
        pageSize: 5,
      });

      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api/v1/market-data/search',
        query: {
          fields: 'instrumentId,displayname',
          searchText: 'AAPL',
          internalSymbolFull: undefined,
          pageSize: 5,
          pageNumber: undefined,
          sort: undefined,
        },
      });
    });
  });

  describe('getInstruments', () => {
    it('should pass single ID directly', async () => {
      await client.getInstruments({
        instrumentIds: [1],
        exchangeIds: [10],
      });

      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api/v1/market-data/instruments',
        query: {
          instrumentIds: '1',
          exchangeIds: '10',
          stocksIndustryIds: undefined,
          instrumentTypeIds: undefined,
        },
      });
    });

    it('should batch multiple IDs in parallel (API quirk: multi-ID returns 500)', async () => {
      mockHttp.request
        .mockResolvedValueOnce({ instrumentDisplayDatas: [{ instrumentID: 1, symbolFull: 'A' }] })
        .mockResolvedValueOnce({ instrumentDisplayDatas: [{ instrumentID: 2, symbolFull: 'B' }] })
        .mockResolvedValueOnce({ instrumentDisplayDatas: [{ instrumentID: 3, symbolFull: 'C' }] });

      const result = await client.getInstruments({
        instrumentIds: [1, 2, 3],
        exchangeIds: [10],
      });

      expect(mockHttp.request).toHaveBeenCalledTimes(3);
      expect(result.instrumentDisplayDatas).toHaveLength(3);
      expect(result.instrumentDisplayDatas.map((d: any) => d.instrumentID)).toEqual([1, 2, 3]);
    });

    it('should call without instrumentIds when none provided', async () => {
      await client.getInstruments({ exchangeIds: [10] });

      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api/v1/market-data/instruments',
        query: {
          instrumentIds: undefined,
          exchangeIds: '10',
          stocksIndustryIds: undefined,
          instrumentTypeIds: undefined,
        },
      });
    });
  });

  describe('getRates', () => {
    it('should call with single id', async () => {
      await client.getRates([100]);

      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api/v1/market-data/instruments/rates',
        query: { instrumentIds: '100' },
      });
    });

    it('should fetch all rates when no ids provided', async () => {
      await client.getRates();

      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api/v1/market-data/instruments/rates',
      });
    });

    it('should make parallel requests for multiple ids and merge results', async () => {
      mockHttp.request
        .mockResolvedValueOnce({ rates: [{ instrumentID: 100, bid: 1 }] })
        .mockResolvedValueOnce({ rates: [{ instrumentID: 200, bid: 2 }] })
        .mockResolvedValueOnce({ rates: [{ instrumentID: 300, bid: 3 }] });

      const result = await client.getRates([100, 200, 300]);

      expect(mockHttp.request).toHaveBeenCalledTimes(3);
      expect(result.rates).toHaveLength(3);
      expect(result.rates.map((r: any) => r.instrumentID)).toEqual([100, 200, 300]);
    });

    it('should reject more than 100 instruments', async () => {
      const ids = Array.from({ length: 101 }, (_, i) => i);
      await expect(client.getRates(ids)).rejects.toThrow(EToroValidationError);
    });
  });

  describe('getCandles', () => {
    it('should build correct path', async () => {
      await client.getCandles(100, CandleDirection.Desc, CandleInterval.OneDay, 50);

      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api/v1/market-data/instruments/100/history/candles/desc/OneDay/50',
      });
    });

    it('should reject more than 1000 candles', async () => {
      await expect(
        client.getCandles(100, CandleDirection.Desc, CandleInterval.OneDay, 1001),
      ).rejects.toThrow(EToroValidationError);
    });
  });

  describe('static endpoints', () => {
    it('should call getInstrumentTypes', async () => {
      await client.getInstrumentTypes();
      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api/v1/market-data/instrument-types',
      });
    });

    it('should call getExchanges', async () => {
      await client.getExchanges();
      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api/v1/market-data/exchanges',
      });
    });

    it('should call getStocksIndustries', async () => {
      await client.getStocksIndustries();
      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api/v1/market-data/instruments/industries',
      });
    });

    it('should call getClosingPrices', async () => {
      await client.getClosingPrices();
      expect(mockHttp.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api/v1/market-data/instruments/closing-prices',
      });
    });
  });
});
