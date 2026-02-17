import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InstrumentResolver } from '../../src/trading/instrument-resolver';
import { MarketDataClient } from '../../src/rest/market-data.client';
import { EToroValidationError } from '../../src/errors/validation-error';

describe('InstrumentResolver', () => {
  let resolver: InstrumentResolver;
  let mockMarketData: {
    searchInstruments: ReturnType<typeof vi.fn>;
    getInstruments: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockMarketData = {
      searchInstruments: vi.fn().mockResolvedValue({
        items: [{ instrumentId: 1001 }],
      }),
      getInstruments: vi.fn().mockResolvedValue({
        instrumentDisplayDatas: [
          { instrumentID: 1001, instrumentDisplayName: 'Apple', symbolFull: 'AAPL' },
        ],
      }),
    };
    resolver = new InstrumentResolver(mockMarketData as unknown as MarketDataClient);
  });

  it('should return numeric IDs as-is', async () => {
    const id = await resolver.resolve(1001);
    expect(id).toBe(1001);
    expect(mockMarketData.searchInstruments).not.toHaveBeenCalled();
  });

  it('should resolve symbol via internalSymbolFull search', async () => {
    const id = await resolver.resolve('AAPL');
    expect(id).toBe(1001);
    expect(mockMarketData.searchInstruments).toHaveBeenCalledWith({
      fields: 'instrumentId',
      internalSymbolFull: 'AAPL',
      pageSize: 5,
    });
  });

  it('should cache resolved symbols', async () => {
    await resolver.resolve('AAPL');
    await resolver.resolve('AAPL');
    expect(mockMarketData.searchInstruments).toHaveBeenCalledTimes(1);
  });

  it('should be case-insensitive', async () => {
    await resolver.resolve('aapl');
    const id = await resolver.resolve('AAPL');
    expect(id).toBe(1001);
    expect(mockMarketData.searchInstruments).toHaveBeenCalledTimes(1);
  });

  it('should fallback to text search when internalSymbolFull returns no valid results', async () => {
    mockMarketData.searchInstruments
      .mockResolvedValueOnce({ items: [{ instrumentId: -100000 }] }) // internalSymbolFull: filtered out
      .mockResolvedValueOnce({ items: [{ instrumentId: 2001 }] }); // text search: valid

    const id = await resolver.resolve('UNKNOWN_SYMBOL');
    expect(id).toBe(2001);
    expect(mockMarketData.searchInstruments).toHaveBeenCalledTimes(2);
  });

  it('should throw when no instruments found at all', async () => {
    mockMarketData.searchInstruments
      .mockResolvedValueOnce({ items: [] }) // internalSymbolFull: empty
      .mockResolvedValueOnce({ items: [] }); // text search: empty

    await expect(resolver.resolve('NONEXISTENT')).rejects.toThrow(EToroValidationError);
  });

  it('should filter out negative instrument IDs', async () => {
    mockMarketData.searchInstruments.mockResolvedValue({
      items: [{ instrumentId: -100000 }, { instrumentId: 1001 }],
    });

    const id = await resolver.resolve('AAPL');
    expect(id).toBe(1001);
  });

  it('should return symbol from getSymbol', async () => {
    await resolver.resolve('AAPL');
    expect(resolver.getSymbol(1001)).toBe('AAPL');
  });

  it('should return undefined for unknown instrumentId in getSymbol', () => {
    expect(resolver.getSymbol(9999)).toBeUndefined();
  });

  it('should return cached ID from getCachedId', async () => {
    await resolver.resolve('AAPL');
    expect(resolver.getCachedId('AAPL')).toBe(1001);
  });

  it('should preload multiple symbols', async () => {
    mockMarketData.searchInstruments.mockImplementation((params: any) => {
      if (params.internalSymbolFull === 'AAPL') {
        return Promise.resolve({ items: [{ instrumentId: 1001 }] });
      }
      if (params.internalSymbolFull === 'BTC') {
        return Promise.resolve({ items: [{ instrumentId: 2001 }] });
      }
      return Promise.resolve({ items: [] });
    });

    mockMarketData.getInstruments.mockImplementation((params: any) => {
      const id = params?.instrumentIds?.[0];
      if (id === 1001) {
        return Promise.resolve({
          instrumentDisplayDatas: [{ instrumentID: 1001, symbolFull: 'AAPL' }],
        });
      }
      if (id === 2001) {
        return Promise.resolve({
          instrumentDisplayDatas: [{ instrumentID: 2001, symbolFull: 'BTC' }],
        });
      }
      return Promise.resolve({ instrumentDisplayDatas: [] });
    });

    await resolver.preload(['AAPL', 'BTC']);
    expect(mockMarketData.searchInstruments).toHaveBeenCalledTimes(2);
    expect(resolver.getCachedId('AAPL')).toBe(1001);
    expect(resolver.getCachedId('BTC')).toBe(2001);
  });

  it('should clear cache', async () => {
    await resolver.resolve('AAPL');
    resolver.clearCache();
    expect(resolver.getCachedId('AAPL')).toBeUndefined();
    expect(resolver.getSymbol(1001)).toBeUndefined();
  });
});
