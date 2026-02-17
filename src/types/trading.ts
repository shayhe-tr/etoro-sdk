// --- Order Requests ---

export interface MarketOrderByAmountRequest {
  InstrumentID: number;
  IsBuy: boolean;
  Leverage: number;
  Amount: number;
  StopLossRate?: number | null;
  TakeProfitRate?: number | null;
  IsTslEnabled?: boolean | null;
  IsNoStopLoss?: boolean | null;
  IsNoTakeProfit?: boolean | null;
}

export interface MarketOrderByUnitsRequest {
  InstrumentID: number;
  IsBuy: boolean;
  Leverage: number;
  AmountInUnits: number;
  StopLossRate?: number | null;
  TakeProfitRate?: number | null;
  IsTslEnabled?: boolean | null;
  IsNoStopLoss?: boolean | null;
  IsNoTakeProfit?: boolean | null;
}

export interface LimitOrderRequest {
  InstrumentID: number;
  IsBuy: boolean;
  Leverage: number;
  Amount?: number | null;
  AmountInUnits?: number | null;
  Rate: number;
  StopLossRate: number;
  TakeProfitRate: number;
  IsTslEnabled?: boolean | null;
  IsNoStopLoss?: boolean | null;
  IsNoTakeProfit?: boolean | null;
}

export interface ClosePositionRequest {
  InstrumentId: number;
  UnitsToDeduct?: number | null;
}

// --- Order Responses ---

export interface OrderForOpen {
  instrumentID: number;
  amount: number;
  isBuy: boolean;
  leverage: number;
  stopLossRate: number;
  takeProfitRate: number;
  isTslEnabled: boolean;
  mirrorID: number;
  totalExternalCosts: number;
  orderID: number;
  orderType: number;
  statusID: number;
  CID: number;
  openDateTime: string;
  lastUpdate: string;
}

export interface OrderForOpenResponse {
  orderForOpen: OrderForOpen;
  token: string;
}

export interface OrderForCloseResponse {
  token: string;
}

// --- Order Info ---

export interface OrderPositionInfo {
  positionID: number;
  orderType: number;
  occurred: string;
  rate: number;
  units: number;
  conversionRate: number;
  amount: number;
  isOpen: boolean;
  [key: string]: unknown;
}

export interface OrderForOpenInfoResponse {
  token: string;
  orderID: number;
  CID: number;
  referenceID: string;
  statusID: number;
  orderType: number;
  openActionType: number;
  errorCode: number | null;
  errorMessage: string | null;
  instrumentID: number;
  amount: number;
  units: number;
  requestOccurred: string;
  positions: OrderPositionInfo[];
  [key: string]: unknown;
}

// --- Position ---

export interface Position {
  positionID: number;
  CID: number;
  openDateTime: string;
  openRate: number;
  instrumentID: number;
  isBuy: boolean;
  leverage: number;
  takeProfitRate: number;
  stopLossRate: number;
  mirrorID: number;
  parentPositionID: number;
  amount: number;
  orderID: number;
  orderType: number;
  units: number;
  totalFees: number;
  initialAmountInDollars: number;
  isTslEnabled: boolean;
  stopLossVersion: number;
  isSettled: boolean;
  redeemStatusID: number;
  initialUnits: number;
  isPartiallyAltered: boolean;
  unitsBaseValueDollars: number;
  isDiscounted: boolean;
  openPositionActionType: number;
  settlementTypeID: number;
  isDetached: boolean;
  openConversionRate: number;
  pnlVersion: number;
  totalExternalFees: number;
  totalExternalTaxes: number;
  isNoTakeProfit: boolean;
  isNoStopLoss: boolean;
  lotCount: number;
  [key: string]: unknown;
}

// --- Order (Pending) ---

export interface PendingOrder {
  orderID: number;
  CID: number;
  openDateTime: string;
  instrumentID: number;
  isBuy: boolean;
  takeProfitRate: number;
  stopLossRate: number;
  rate: number;
  amount: number;
  leverage: number;
  units: number;
  isTslEnabled: boolean;
  executionType: number;
  [key: string]: unknown;
}

// --- Mirror (Copy Trading) ---

export interface Mirror {
  mirrorID: number;
  CID: number;
  parentCID: number;
  stopLossPercentage: number;
  isPaused: boolean;
  copyExistingPositions: boolean;
  availableAmount: number;
  stopLossAmount: number;
  initialInvestment: number;
  depositSummary: number;
  withdrawalSummary: number;
  positions: Position[];
  parentUsername: string;
  closedPositionsNetProfit: number;
  startedCopyDate: string;
  pendingForClosure: boolean;
  mirrorStatusID: number;
  ordersForOpen: PendingOrder[];
  ordersForClose: unknown[];
  ordersForCloseMultiple: unknown[];
  [key: string]: unknown;
}

// --- Portfolio ---

export interface ClientPortfolio {
  positions: Position[];
  credit: number;
  mirrors: Mirror[];
  orders: PendingOrder[];
  ordersForOpen: PendingOrder[];
  ordersForClose: unknown[];
  ordersForCloseMultiple: unknown[];
  bonusCredit: number;
}

export interface PortfolioResponse {
  clientPortfolio: ClientPortfolio;
}

// --- PnL ---

export interface PnlResponse {
  clientPortfolio: ClientPortfolio;
}

// --- Trade History ---

export interface TradeHistoryParams {
  minDate: string;
  page?: number;
  pageSize?: number;
}

export interface TradeHistoryEntry {
  netProfit: number;
  closeRate: number;
  closeTimestamp: string;
  positionId: number;
  instrumentId: number;
  isBuy: boolean;
  leverage: number;
  openRate: number;
  openTimestamp: string;
  stopLossRate: number;
  takeProfitRate: number;
  trailingStopLoss: boolean;
  orderId: number;
  socialTradeId: number;
  parentPositionId: number;
  investment: number;
  initialInvestment: number;
  fees: number;
  units: number;
}
