import { MarketDataClient } from '../rest/market-data.client';
import { EToroValidationError } from '../errors/validation-error';

export class InstrumentResolver {
  private symbolToId = new Map<string, number>();
  private idToSymbol = new Map<number, string>();

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

  private async enrichFromMetadata(instrumentId: number): Promise<void> {
    try {
      const metadata = await this.marketData.getInstruments({ instrumentIds: [instrumentId] });
      const data = metadata.instrumentDisplayDatas?.[0];
      if (data?.symbolFull) {
        const symbol = data.symbolFull.toUpperCase();
        this.symbolToId.set(symbol, instrumentId);
        this.idToSymbol.set(instrumentId, symbol);
      }
    } catch {
      // Non-critical
    }
  }

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

  clearCache(): void {
    this.symbolToId.clear();
    this.idToSymbol.clear();
  }

  get size(): number {
    return this.symbolToId.size;
  }
}
