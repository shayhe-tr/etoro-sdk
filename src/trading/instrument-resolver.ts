import { MarketDataClient } from '../rest/market-data.client';
import { EToroValidationError } from '../errors/validation-error';
import type { InstrumentDisplayData } from '../types/market-data';

/**
 * Lightweight instrument info derived from the metadata API.
 * Available after calling `getInstrumentInfo()` or `getInstrumentInfoBatch()`.
 */
export interface InstrumentInfo {
  instrumentId: number;
  displayName: string;
  symbolFull: string;
  instrumentTypeID: number;
  exchangeID: number;
  instrumentTypeSubCategoryID?: number;
  priceSource: string;
  hasExpirationDate: boolean;
  isInternalInstrument: boolean;
  imageUrl?: string;
}

export class InstrumentResolver {
  private symbolToId = new Map<string, number>();
  private idToSymbol = new Map<number, string>();
  private idToInfo = new Map<number, InstrumentInfo>();

  constructor(private readonly marketData: MarketDataClient) {}

  /**
   * Register a static symbol→ID mapping (e.g. from CSV or known values).
   * These take priority over API search results.
   */
  register(symbol: string, instrumentId: number): void {
    const upper = symbol.toUpperCase();
    this.symbolToId.set(upper, instrumentId);
    this.idToSymbol.set(instrumentId, upper);
  }

  /**
   * Bulk-register symbol→ID mappings.
   * Accepts an array of [symbol, instrumentId] tuples or an object.
   */
  registerMany(entries: Iterable<[string, number]>): void {
    for (const [symbol, id] of entries) {
      this.register(symbol, id);
    }
  }

  /**
   * Load instrument mappings from CSV content (InstrumentID,ISINCode,SymbolFull).
   * Skips the header row and any rows with empty/invalid data.
   */
  loadFromCsv(csvContent: string): number {
    const lines = csvContent.split('\n');
    let loaded = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(',');
      const id = parseInt(parts[0], 10);
      const symbol = (parts[2] ?? '').trim();
      if (id > 0 && symbol) {
        this.register(symbol, id);
        loaded++;
      }
    }
    return loaded;
  }

  async resolve(symbolOrId: string | number): Promise<number> {
    if (typeof symbolOrId === 'number') {
      return symbolOrId;
    }

    const upper = symbolOrId.toUpperCase();
    const cached = this.symbolToId.get(upper);
    if (cached !== undefined) return cached;

    // Step 1: Search by exact symbol using internalSymbolFull
    const result = await this.marketData.searchInstruments({
      fields: 'instrumentId',
      internalSymbolFull: upper,
      pageSize: 5,
    });

    // Filter out negative/special instrument IDs
    const valid = (result.items ?? []).filter((item) => item.instrumentId > 0);

    if (valid.length > 0) {
      const instrumentId = valid[0].instrumentId;
      this.symbolToId.set(upper, instrumentId);
      this.idToSymbol.set(instrumentId, upper);
      this.enrichFromMetadata(instrumentId).catch(() => {});
      return instrumentId;
    }

    // Step 2: Fallback to text search
    const textResult = await this.marketData.searchInstruments({
      fields: 'instrumentId',
      searchText: symbolOrId,
      pageSize: 10,
    });

    const validText = (textResult.items ?? []).filter((item) => item.instrumentId > 0);
    if (validText.length === 0) {
      throw new EToroValidationError(`Instrument not found: ${symbolOrId}`);
    }

    const instrumentId = validText[0].instrumentId;
    this.symbolToId.set(upper, instrumentId);
    this.idToSymbol.set(instrumentId, upper);
    this.enrichFromMetadata(instrumentId).catch(() => {});
    return instrumentId;
  }

  // --- Metadata / Display Name Lookups ---

  /**
   * Get full instrument info (display name, symbol, type, exchange, etc.) by ID or symbol.
   * Fetches from the metadata API if not already cached.
   *
   * @example
   * const info = await resolver.getInstrumentInfo(100000);
   * console.log(info.displayName); // "Bitcoin"
   * console.log(info.symbolFull);  // "BTC"
   *
   * const info2 = await resolver.getInstrumentInfo('AAPL');
   * console.log(info2.displayName); // "Apple"
   */
  async getInstrumentInfo(symbolOrId: string | number): Promise<InstrumentInfo> {
    const instrumentId = typeof symbolOrId === 'number'
      ? symbolOrId
      : await this.resolve(symbolOrId);

    const cached = this.idToInfo.get(instrumentId);
    if (cached) return cached;

    await this.fetchAndCacheMetadata([instrumentId]);

    const info = this.idToInfo.get(instrumentId);
    if (!info) {
      throw new EToroValidationError(
        `Instrument metadata not found for ID: ${instrumentId}`,
        'instrumentId',
      );
    }
    return info;
  }

  /**
   * Get instrument info for multiple instruments in parallel.
   * Only fetches metadata for IDs not already cached.
   *
   * @example
   * const infos = await resolver.getInstrumentInfoBatch([100000, 1001, 1002]);
   * for (const info of infos) {
   *   console.log(`${info.symbolFull}: ${info.displayName}`);
   * }
   */
  async getInstrumentInfoBatch(instrumentIds: number[]): Promise<InstrumentInfo[]> {
    const uncached = instrumentIds.filter((id) => !this.idToInfo.has(id));
    if (uncached.length > 0) {
      await this.fetchAndCacheMetadata(uncached);
    }
    return instrumentIds
      .map((id) => this.idToInfo.get(id))
      .filter((info): info is InstrumentInfo => info !== undefined);
  }

  /**
   * Get the display name for an instrument (e.g. "Bitcoin", "Apple", "Tesla").
   * Fetches from the metadata API if not already cached.
   *
   * @example
   * const name = await resolver.getDisplayName(100000); // "Bitcoin"
   * const name2 = await resolver.getDisplayName('AAPL'); // "Apple"
   */
  async getDisplayName(symbolOrId: string | number): Promise<string> {
    const info = await this.getInstrumentInfo(symbolOrId);
    return info.displayName;
  }

  /**
   * Get the symbolFull for an instrument from metadata API.
   * Unlike getSymbol() which uses the cache, this fetches authoritative data.
   *
   * @example
   * const symbol = await resolver.getSymbolFull(1001); // "AAPL"
   */
  async getSymbolFull(symbolOrId: string | number): Promise<string> {
    const info = await this.getInstrumentInfo(symbolOrId);
    return info.symbolFull;
  }

  /**
   * Get cached display name without making API calls. Returns undefined if not cached.
   */
  getCachedDisplayName(instrumentId: number): string | undefined {
    return this.idToInfo.get(instrumentId)?.displayName;
  }

  /**
   * Get cached instrument info without making API calls. Returns undefined if not cached.
   */
  getCachedInfo(instrumentId: number): InstrumentInfo | undefined {
    return this.idToInfo.get(instrumentId);
  }

  // --- Existing Symbol Lookups ---

  getSymbol(instrumentId: number): string | undefined {
    return this.idToSymbol.get(instrumentId);
  }

  getCachedId(symbol: string): number | undefined {
    return this.symbolToId.get(symbol.toUpperCase());
  }

  async preload(symbols: string[]): Promise<void> {
    await Promise.all(symbols.map((s) => this.resolve(s)));
    // Brief wait for background metadata enrichment
    await new Promise((r) => setTimeout(r, 300));
  }

  /**
   * Preload full instrument metadata for a list of IDs.
   * Useful for resolving display names for portfolio positions.
   *
   * @example
   * const ids = portfolio.positions.map(p => p.instrumentID);
   * await resolver.preloadMetadata(ids);
   * // Now getCachedDisplayName() works for all position IDs
   */
  async preloadMetadata(instrumentIds: number[]): Promise<void> {
    const uncached = instrumentIds.filter((id) => !this.idToInfo.has(id));
    if (uncached.length > 0) {
      await this.fetchAndCacheMetadata(uncached);
    }
  }

  clearCache(): void {
    this.symbolToId.clear();
    this.idToSymbol.clear();
    this.idToInfo.clear();
  }

  get size(): number {
    return this.symbolToId.size;
  }

  get metadataSize(): number {
    return this.idToInfo.size;
  }

  // --- Private helpers ---

  private async enrichFromMetadata(instrumentId: number): Promise<void> {
    try {
      await this.fetchAndCacheMetadata([instrumentId]);
    } catch {
      // Non-critical — symbol mapping already exists from search
    }
  }

  private async fetchAndCacheMetadata(instrumentIds: number[]): Promise<void> {
    const metadata = await this.marketData.getInstruments({ instrumentIds });
    for (const data of metadata.instrumentDisplayDatas ?? []) {
      this.cacheDisplayData(data);
    }
  }

  private cacheDisplayData(data: InstrumentDisplayData): void {
    const info: InstrumentInfo = {
      instrumentId: data.instrumentID,
      displayName: data.instrumentDisplayName,
      symbolFull: data.symbolFull,
      instrumentTypeID: data.instrumentTypeID,
      exchangeID: data.exchangeID,
      instrumentTypeSubCategoryID: data.instrumentTypeSubCategoryID,
      priceSource: data.priceSource,
      hasExpirationDate: data.hasExpirationDate,
      isInternalInstrument: data.isInternalInstrument,
      imageUrl: data.images?.find((img) => img.width === 150)?.uri
        ?? data.images?.find((img) => img.width === 50)?.uri,
    };

    this.idToInfo.set(data.instrumentID, info);

    // Also update symbol mappings from authoritative metadata
    if (data.symbolFull) {
      const symbol = data.symbolFull.toUpperCase();
      this.symbolToId.set(symbol, data.instrumentID);
      this.idToSymbol.set(data.instrumentID, symbol);
    }
  }
}
