import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InstrumentResolver } from '../../src/trading/instrument-resolver';
import { MarketDataClient } from '../../src/rest/market-data.client';
import { EToroValidationError } from '../../src/errors/validation-error';

function makeMetadataResponse(overrides: Record<number, any> = {}) {
  const defaults: Record<number, any> = {
    1001: {
      instrumentID: 1001,
      instrumentDisplayName: 'Apple',
      symbolFull: 'AAPL',
      instrumentTypeID: 5,
      exchangeID: 1,
      instrumentTypeSubCategoryID: 101,
      priceSource: 'NASDAQ',
      hasExpirationDate: false,
      isInternalInstrument: false,
      images: [
        { instrumentID: 1001, width: 50, height: 50, uri: 'https://cdn/aapl/50x50.png' },
        { instrumentID: 1001, width: 150, height: 150, uri: 'https://cdn/aapl/150x150.png' },
      ],
    },
    100000: {
      instrumentID: 100000,
      instrumentDisplayName: 'Bitcoin',
      symbolFull: 'BTC',
      instrumentTypeID: 10,
      exchangeID: 8,
      instrumentTypeSubCategoryID: 1001,
      priceSource: 'eToro',
      hasExpirationDate: false,
      isInternalInstrument: false,
      images: [
        { instrumentID: 100000, width: 50, height: 50, uri: 'https://cdn/btc/50x50.png' },
        { instrumentID: 100000, width: 150, height: 150, uri: 'https://cdn/btc/150x150.png' },
      ],
    },
    1002: {
      instrumentID: 1002,
      instrumentDisplayName: 'Tesla',
      symbolFull: 'TSLA',
      instrumentTypeID: 5,
      exchangeID: 1,
      priceSource: 'NASDAQ',
      hasExpirationDate: false,
      isInternalInstrument: false,
      images: [],
    },
    ...overrides,
  };
  return defaults;
}

describe('InstrumentResolver', () => {
  let resolver: InstrumentResolver;
  let mockMarketData: {
    searchInstruments: ReturnType<typeof vi.fn>;
    getInstruments: ReturnType<typeof vi.fn>;
  };
  let metadataDb: Record<number, any>;

  beforeEach(() => {
    metadataDb = makeMetadataResponse();

    mockMarketData = {
      searchInstruments: vi.fn().mockResolvedValue({
        items: [{ instrumentId: 1001 }],
      }),
      getInstruments: vi.fn().mockImplementation((params: any) => {
        const ids: number[] = params?.instrumentIds ?? [];
        const results = ids
          .map((id: number) => metadataDb[id])
          .filter(Boolean);
        return Promise.resolve({ instrumentDisplayDatas: results });
      }),
    };
    resolver = new InstrumentResolver(mockMarketData as unknown as MarketDataClient);
  });

  // --- Symbol Resolution (existing tests) ---

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
      .mockResolvedValueOnce({ items: [{ instrumentId: -100000 }] })
      .mockResolvedValueOnce({ items: [{ instrumentId: 2001 }] });

    const id = await resolver.resolve('UNKNOWN_SYMBOL');
    expect(id).toBe(2001);
    expect(mockMarketData.searchInstruments).toHaveBeenCalledTimes(2);
  });

  it('should throw when no instruments found at all', async () => {
    mockMarketData.searchInstruments
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] });

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
        return Promise.resolve({ items: [{ instrumentId: 100000 }] });
      }
      return Promise.resolve({ items: [] });
    });

    await resolver.preload(['AAPL', 'BTC']);
    expect(mockMarketData.searchInstruments).toHaveBeenCalledTimes(2);
    expect(resolver.getCachedId('AAPL')).toBe(1001);
    expect(resolver.getCachedId('BTC')).toBe(100000);
  });

  it('should clear cache', async () => {
    await resolver.resolve('AAPL');
    resolver.clearCache();
    expect(resolver.getCachedId('AAPL')).toBeUndefined();
    expect(resolver.getSymbol(1001)).toBeUndefined();
  });

  // --- Display Name / Metadata ---

  describe('getDisplayName', () => {
    it('should fetch display name by instrument ID', async () => {
      const name = await resolver.getDisplayName(1001);
      expect(name).toBe('Apple');
      expect(mockMarketData.getInstruments).toHaveBeenCalledWith({
        instrumentIds: [1001],
      });
    });

    it('should fetch display name by symbol', async () => {
      // First resolve the symbol, then get display name
      const name = await resolver.getDisplayName('AAPL');
      expect(name).toBe('Apple');
    });

    it('should cache metadata and not re-fetch', async () => {
      await resolver.getDisplayName(1001);
      await resolver.getDisplayName(1001);
      // getInstruments called once for metadata fetch (enrichFromMetadata is fire-and-forget, so just the explicit call)
      const metaCalls = mockMarketData.getInstruments.mock.calls.filter(
        (call: any[]) => call[0]?.instrumentIds?.includes(1001),
      );
      expect(metaCalls.length).toBe(1);
    });

    it('should return "Bitcoin" for BTC', async () => {
      const name = await resolver.getDisplayName(100000);
      expect(name).toBe('Bitcoin');
    });
  });

  describe('getInstrumentInfo', () => {
    it('should return full instrument info by ID', async () => {
      const info = await resolver.getInstrumentInfo(1001);
      expect(info.instrumentId).toBe(1001);
      expect(info.displayName).toBe('Apple');
      expect(info.symbolFull).toBe('AAPL');
      expect(info.instrumentTypeID).toBe(5);
      expect(info.exchangeID).toBe(1);
      expect(info.priceSource).toBe('NASDAQ');
      expect(info.imageUrl).toBe('https://cdn/aapl/150x150.png');
    });

    it('should return full instrument info by symbol', async () => {
      const info = await resolver.getInstrumentInfo('AAPL');
      expect(info.displayName).toBe('Apple');
      expect(info.symbolFull).toBe('AAPL');
    });

    it('should prefer 150px image, fallback to 50px', async () => {
      const info = await resolver.getInstrumentInfo(100000);
      expect(info.imageUrl).toBe('https://cdn/btc/150x150.png');
    });

    it('should handle instruments with no images', async () => {
      const info = await resolver.getInstrumentInfo(1002);
      expect(info.displayName).toBe('Tesla');
      expect(info.imageUrl).toBeUndefined();
    });

    it('should throw for unknown instrument ID', async () => {
      await expect(resolver.getInstrumentInfo(999999)).rejects.toThrow(
        'Instrument metadata not found for ID: 999999',
      );
    });
  });

  describe('getInstrumentInfoBatch', () => {
    it('should fetch metadata for multiple IDs in parallel', async () => {
      const infos = await resolver.getInstrumentInfoBatch([1001, 100000, 1002]);
      expect(infos).toHaveLength(3);
      expect(infos[0].displayName).toBe('Apple');
      expect(infos[1].displayName).toBe('Bitcoin');
      expect(infos[2].displayName).toBe('Tesla');
    });

    it('should only fetch uncached IDs', async () => {
      // Pre-fetch one
      await resolver.getInstrumentInfo(1001);
      mockMarketData.getInstruments.mockClear();

      // Batch fetch including the pre-fetched one
      const infos = await resolver.getInstrumentInfoBatch([1001, 100000]);
      expect(infos).toHaveLength(2);

      // Should only fetch 100000 (1001 was cached)
      expect(mockMarketData.getInstruments).toHaveBeenCalledTimes(1);
      const calledIds = mockMarketData.getInstruments.mock.calls[0][0].instrumentIds;
      expect(calledIds).toEqual([100000]);
    });

    it('should skip IDs that return no metadata', async () => {
      const infos = await resolver.getInstrumentInfoBatch([1001, 999999]);
      expect(infos).toHaveLength(1);
      expect(infos[0].instrumentId).toBe(1001);
    });
  });

  describe('getSymbolFull', () => {
    it('should return symbolFull from metadata', async () => {
      const symbol = await resolver.getSymbolFull(1001);
      expect(symbol).toBe('AAPL');
    });

    it('should accept symbol input and return symbolFull', async () => {
      const symbol = await resolver.getSymbolFull('AAPL');
      expect(symbol).toBe('AAPL');
    });
  });

  describe('getCachedDisplayName', () => {
    it('should return undefined when not cached', () => {
      expect(resolver.getCachedDisplayName(1001)).toBeUndefined();
    });

    it('should return display name after fetching', async () => {
      await resolver.getInstrumentInfo(1001);
      expect(resolver.getCachedDisplayName(1001)).toBe('Apple');
    });
  });

  describe('getCachedInfo', () => {
    it('should return undefined when not cached', () => {
      expect(resolver.getCachedInfo(1001)).toBeUndefined();
    });

    it('should return full info after fetching', async () => {
      await resolver.getInstrumentInfo(100000);
      const info = resolver.getCachedInfo(100000);
      expect(info).toBeDefined();
      expect(info!.displayName).toBe('Bitcoin');
      expect(info!.instrumentTypeSubCategoryID).toBe(1001);
    });
  });

  describe('preloadMetadata', () => {
    it('should preload metadata for multiple IDs', async () => {
      await resolver.preloadMetadata([1001, 100000]);
      expect(resolver.getCachedDisplayName(1001)).toBe('Apple');
      expect(resolver.getCachedDisplayName(100000)).toBe('Bitcoin');
    });

    it('should skip already cached IDs', async () => {
      await resolver.getInstrumentInfo(1001);
      mockMarketData.getInstruments.mockClear();

      await resolver.preloadMetadata([1001, 100000]);

      // Should only fetch 100000
      expect(mockMarketData.getInstruments).toHaveBeenCalledTimes(1);
      const calledIds = mockMarketData.getInstruments.mock.calls[0][0].instrumentIds;
      expect(calledIds).toEqual([100000]);
    });

    it('should be a no-op when all IDs are cached', async () => {
      await resolver.preloadMetadata([1001, 100000]);
      mockMarketData.getInstruments.mockClear();

      await resolver.preloadMetadata([1001, 100000]);
      expect(mockMarketData.getInstruments).not.toHaveBeenCalled();
    });
  });

  describe('metadataSize', () => {
    it('should track metadata cache size', async () => {
      expect(resolver.metadataSize).toBe(0);
      await resolver.getInstrumentInfo(1001);
      expect(resolver.metadataSize).toBe(1);
      await resolver.getInstrumentInfo(100000);
      expect(resolver.metadataSize).toBe(2);
    });

    it('should clear metadata on clearCache', async () => {
      await resolver.getInstrumentInfo(1001);
      expect(resolver.metadataSize).toBe(1);
      resolver.clearCache();
      expect(resolver.metadataSize).toBe(0);
    });
  });

  describe('metadata updates symbol mappings', () => {
    it('should update idToSymbol from metadata symbolFull', async () => {
      // Register with a different symbol name
      resolver.register('APPLE', 1001);
      expect(resolver.getSymbol(1001)).toBe('APPLE');

      // Fetch metadata — should update to the authoritative symbolFull
      await resolver.getInstrumentInfo(1001);
      expect(resolver.getSymbol(1001)).toBe('AAPL');
    });
  });
});
