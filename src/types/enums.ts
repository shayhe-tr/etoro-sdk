export enum CandleInterval {
  OneMinute = 'OneMinute',
  FiveMinutes = 'FiveMinutes',
  TenMinutes = 'TenMinutes',
  FifteenMinutes = 'FifteenMinutes',
  ThirtyMinutes = 'ThirtyMinutes',
  OneHour = 'OneHour',
  FourHours = 'FourHours',
  OneDay = 'OneDay',
  OneWeek = 'OneWeek',
}

export enum CandleDirection {
  Asc = 'asc',
  Desc = 'desc',
}

export enum OrderStatusId {
  Pending = 1,
  Filling = 2,
  Executed = 3,
  Failed = 4,
  Cancelled = 5,
}

export enum OrderType {
  Market = 1,
  Limit = 2,
  Stop = 3,
}

export enum SettlementType {
  CFD = 0,
  RealAsset = 1,
  SWAP = 2,
  Crypto = 3,
  Future = 4,
}

export enum MirrorStatus {
  Active = 0,
  Paused = 1,
  PendingClosure = 2,
  InAlignment = 3,
}

export type TradingMode = 'demo' | 'real';
