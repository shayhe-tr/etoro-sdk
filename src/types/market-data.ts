import type { PaginatedResponse } from './common';

// --- Instrument Search ---

export interface InstrumentSearchParams {
  fields: string;
  searchText?: string;
  internalSymbolFull?: string;
  pageSize?: number;
  pageNumber?: number;
  sort?: string;
}

export interface InstrumentSearchItem {
  instrumentId: number;
  symbol: string;
  displayname: string;
  instrumentTypeID: number;
  exchangeID: number;
  isOpen: boolean;
  isCurrentlyTradable: boolean;
  isBuyEnabled: boolean;
  isDelisted: boolean;
  isExchangeOpen: boolean;
  currentRate: number;
  dailyPriceChange: number;
  absDailyPriceChange: number;
  weeklyPriceChange: number;
  monthlyPriceChange: number;
  threeMonthPriceChange: number;
  sixMonthPriceChange: number;
  oneYearPriceChange: number;
  internalAssetClassId: number;
  internalAssetClassName: string;
  logo35x35: string;
  logo50x50: string;
  logo150x150: string;
  [key: string]: unknown;
}

export interface InstrumentSearchResponse extends PaginatedResponse {
  items: InstrumentSearchItem[];
}

// --- Instrument Metadata ---

export interface InstrumentImage {
  instrumentId: number;
  width: number;
  height: number;
  uri: string;
  backgroundColor: string;
  textColor: string;
}

export interface InstrumentDisplayData {
  instrumentID: number;
  instrumentDisplayName: string;
  instrumentTypeID: number;
  exchangeID: number;
  symbolFull: string;
  stocksIndustryID: number;
  priceSource: string;
  hasExpirationDate: boolean;
  isInternalInstrument: boolean;
  images: InstrumentImage[];
}

export interface InstrumentsResponse {
  instrumentDisplayDatas: InstrumentDisplayData[];
}

export interface GetInstrumentsParams {
  instrumentIds?: number[];
  exchangeIds?: number[];
  stocksIndustryIds?: number[];
  instrumentTypeIds?: number[];
}

// --- Live Rates ---

export interface InstrumentRate {
  instrumentID: number;
  ask: number;
  bid: number;
  lastExecution: number;
  conversionRateAsk: number;
  conversionRateBid: number;
  date: string;
  unitMargin: number;
  unitMarginAsk: number;
  unitMarginBid: number;
  priceRateID: number;
  bidDiscounted: number;
  askDiscounted: number;
  unitMarginBidDiscounted: number;
  unitMarginAskDiscounted: number;
  [key: string]: unknown;
}

export interface LiveRatesResponse {
  rates: InstrumentRate[];
}

// --- Candles ---

export interface Candle {
  instrumentID: number;
  fromDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandleGroup {
  instrumentId: number;
  candles: Candle[];
  rangeOpen: number;
  rangeClose: number;
  rangeHigh: number;
  rangeLow: number;
  volume: number;
}

export interface CandlesResponse {
  interval: string;
  candles: CandleGroup[];
}

// --- Exchanges ---

export interface Exchange {
  exchangeID: number;
  exchangeDescription: string;
  [key: string]: unknown;
}

export interface ExchangesResponse {
  exchangeInfo: Exchange[];
}

// --- Instrument Types ---

export interface InstrumentType {
  instrumentTypeID: number;
  instrumentTypeDescription: string;
  [key: string]: unknown;
}

export interface InstrumentTypesResponse {
  instrumentTypes: InstrumentType[];
}

// --- Stock Industries ---

export interface StocksIndustry {
  stocksIndustryId: number;
  name: string;
  [key: string]: unknown;
}

export interface StocksIndustriesResponse {
  stocksIndustries: StocksIndustry[];
}

// --- Closing Prices ---

export interface ClosingPrice {
  instrumentId: number;
  closingPrice: number;
  [key: string]: unknown;
}

export interface ClosingPricesResponse {
  closingPrices: ClosingPrice[];
}
