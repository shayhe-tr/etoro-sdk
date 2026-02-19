import { HttpClient } from '../http/http-client';
import { API_PREFIX, MAX_CANDLES, MAX_RATE_INSTRUMENT_IDS } from '../config/constants';
import { EToroValidationError } from '../errors/validation-error';
import type {
  InstrumentSearchParams,
  InstrumentSearchResponse,
  GetInstrumentsParams,
  InstrumentsResponse,
  LiveRatesResponse,
  CandlesResponse,
  ExchangesResponse,
  InstrumentTypesResponse,
  StocksIndustriesResponse,
  ClosingPricesResponse,
} from '../types/market-data';
import type { CandleInterval, CandleDirection } from '../types/enums';

export class MarketDataClient {
  constructor(private readonly http: HttpClient) {}

  async searchInstruments(params: InstrumentSearchParams): Promise<InstrumentSearchResponse> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/market-data/search`,
      query: {
        fields: params.fields,
        searchText: params.searchText,
        internalSymbolFull: params.internalSymbolFull,
        pageSize: params.pageSize,
        pageNumber: params.pageNumber,
        sort: params.sort,
      },
    });
  }

  async getInstruments(params?: GetInstrumentsParams): Promise<InstrumentsResponse> {
    // API quirk: comma-separated instrumentIds returns 500.
    // Batch in parallel (same as rates endpoint).
    const ids = params?.instrumentIds;
    if (ids && ids.length > 1) {
      const results = await Promise.all(
        ids.map((id) =>
          this.http.request<InstrumentsResponse>({
            method: 'GET',
            path: `${API_PREFIX}/market-data/instruments`,
            query: {
              instrumentIds: String(id),
              exchangeIds: params?.exchangeIds?.join(','),
              stocksIndustryIds: params?.stocksIndustryIds?.join(','),
              instrumentTypeIds: params?.instrumentTypeIds?.join(','),
            },
          }),
        ),
      );
      return {
        instrumentDisplayDatas: results.flatMap((r) => r.instrumentDisplayDatas ?? []),
      };
    }

    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/market-data/instruments`,
      query: {
        instrumentIds: ids?.[0] != null ? String(ids[0]) : undefined,
        exchangeIds: params?.exchangeIds?.join(','),
        stocksIndustryIds: params?.stocksIndustryIds?.join(','),
        instrumentTypeIds: params?.instrumentTypeIds?.join(','),
      },
    });
  }

  async getRates(instrumentIds?: number[]): Promise<LiveRatesResponse> {
    if (!instrumentIds || instrumentIds.length === 0) {
      return this.http.request({
        method: 'GET',
        path: `${API_PREFIX}/market-data/instruments/rates`,
      });
    }
    if (instrumentIds.length > MAX_RATE_INSTRUMENT_IDS) {
      throw new EToroValidationError(
        `Cannot request more than ${MAX_RATE_INSTRUMENT_IDS} instruments at once`,
        'instrumentIds',
      );
    }
    // API only accepts a single instrumentIds value per request;
    // comma-separated values return 500. Fetch in parallel and merge.
    if (instrumentIds.length === 1) {
      return this.http.request({
        method: 'GET',
        path: `${API_PREFIX}/market-data/instruments/rates`,
        query: { instrumentIds: String(instrumentIds[0]) },
      });
    }
    const results = await Promise.all(
      instrumentIds.map((id) =>
        this.http.request<LiveRatesResponse>({
          method: 'GET',
          path: `${API_PREFIX}/market-data/instruments/rates`,
          query: { instrumentIds: String(id) },
        }),
      ),
    );
    return { rates: results.flatMap((r) => r.rates) };
  }

  async getCandles(
    instrumentId: number,
    direction: CandleDirection,
    interval: CandleInterval,
    candlesCount: number,
  ): Promise<CandlesResponse> {
    if (candlesCount > MAX_CANDLES) {
      throw new EToroValidationError(
        `Cannot request more than ${MAX_CANDLES} candles at once`,
        'candlesCount',
      );
    }
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/market-data/instruments/${instrumentId}/history/candles/${direction}/${interval}/${candlesCount}`,
    });
  }

  async getInstrumentTypes(): Promise<InstrumentTypesResponse> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/market-data/instrument-types`,
    });
  }

  async getClosingPrices(): Promise<ClosingPricesResponse> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/market-data/instruments/closing-prices`,
    });
  }

  async getStocksIndustries(): Promise<StocksIndustriesResponse> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/market-data/instruments/industries`,
    });
  }

  async getExchanges(): Promise<ExchangesResponse> {
    return this.http.request({
      method: 'GET',
      path: `${API_PREFIX}/market-data/exchanges`,
    });
  }
}
