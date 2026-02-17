// --- Operations ---

export interface WsAuthenticateOperation {
  id: string;
  operation: 'Authenticate';
  data: {
    userKey: string;
    apiKey: string;
  };
}

export interface WsSubscribeOperation {
  id: string;
  operation: 'Subscribe';
  data: {
    topics: string[];
    snapshot?: boolean;
  };
}

export interface WsUnsubscribeOperation {
  id: string;
  operation: 'Unsubscribe';
  data: {
    topics: string[];
  };
}

export type WsOperation =
  | WsAuthenticateOperation
  | WsSubscribeOperation
  | WsUnsubscribeOperation;

// --- Message Envelope ---

export interface WsMessage {
  topic: string;
  content: string;
  id: string;
  type: string;
}

export interface WsEnvelope {
  messages: WsMessage[];
}

// --- Parsed Event Data ---

export interface WsInstrumentRate {
  Ask: number;
  Bid: number;
  LastExecution: number;
  Date: string;
  PriceRateID: number;
}

export interface WsPrivateEvent {
  OrderID: number;
  OrderType: number;
  StatusID: number;
  InstrumentID: number;
  CID: number;
  RequestedUnits: number;
  ExecutedUnits: number;
  NetProfit: number;
  CloseReason: string;
  OpenDateTime: string;
  RequestOccurred: string;
  ErrorCode?: number;
  ErrorMessage?: string;
  PositionID?: number;
  Rate?: number;
  Amount?: number;
  IsBuy?: boolean;
  Leverage?: number;
  [key: string]: unknown;
}

// --- Error Codes ---

export type WsErrorCode =
  | 'InvalidKey'
  | 'UserKeyRequired'
  | 'ApiKeyRequired'
  | 'SessionAlreadyAuthenticated'
  | 'Unauthorized'
  | 'Forbidden';
