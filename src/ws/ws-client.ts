import WebSocket from 'ws';
import { TypedEventEmitter } from '../utils/event-emitter';
import { generateUUID } from '../utils/uuid';
import { noopLogger, type Logger } from '../utils/logger';
import { EToroWebSocketError } from '../errors/websocket-error';
import { EToroAuthError } from '../errors/auth-error';
import { WsSubscriptionTracker } from './ws-subscription';
import { parseEnvelope, parseMessages } from './ws-message-parser';
import {
  DEFAULT_WS_URL,
  DEFAULT_WS_RECONNECT_ATTEMPTS,
  DEFAULT_WS_RECONNECT_DELAY,
  DEFAULT_WS_AUTH_TIMEOUT,
  DEFAULT_WS_HEARTBEAT_INTERVAL,
  DEFAULT_WS_HEARTBEAT_TIMEOUT,
} from '../config/constants';
import type { WsInstrumentRate, WsPrivateEvent, WsEnvelope } from '../types/websocket';

export interface WsClientOptions {
  apiKey: string;
  userKey: string;
  wsUrl?: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  authTimeout?: number;
  /** Interval between heartbeat pings in ms (default: 30s). Set to 0 to disable. */
  heartbeatInterval?: number;
  /** Time to wait for a pong response before considering the connection dead (default: 10s) */
  heartbeatTimeout?: number;
  logger?: Logger;
}

export type WsClientEvents = {
  open: () => void;
  close: (code: number, reason: string) => void;
  error: (error: Error) => void;
  authenticated: () => void;
  'instrument:rate': (instrumentId: number, rate: WsInstrumentRate) => void;
  'private:event': (event: WsPrivateEvent) => void;
  message: (envelope: WsEnvelope) => void;
};

export class WsClient extends TypedEventEmitter<WsClientEvents> {
  private ws: WebSocket | null = null;
  private authenticated = false;
  private subscriptions = new WsSubscriptionTracker();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private intentionalClose = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private _lastPongAt = 0;

  private readonly apiKey: string;
  private readonly userKey: string;
  private readonly wsUrl: string;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectDelay: number;
  private readonly authTimeout: number;
  private readonly heartbeatInterval: number;
  private readonly heartbeatTimeout: number;
  private readonly logger: Logger;

  constructor(options: WsClientOptions) {
    super();
    this.apiKey = options.apiKey;
    this.userKey = options.userKey;
    this.wsUrl = options.wsUrl ?? DEFAULT_WS_URL;
    this.maxReconnectAttempts = options.reconnectAttempts ?? DEFAULT_WS_RECONNECT_ATTEMPTS;
    this.reconnectDelay = options.reconnectDelay ?? DEFAULT_WS_RECONNECT_DELAY;
    this.authTimeout = options.authTimeout ?? DEFAULT_WS_AUTH_TIMEOUT;
    this.heartbeatInterval = options.heartbeatInterval ?? DEFAULT_WS_HEARTBEAT_INTERVAL;
    this.heartbeatTimeout = options.heartbeatTimeout ?? DEFAULT_WS_HEARTBEAT_TIMEOUT;
    this.logger = options.logger ?? noopLogger;
  }

  /** Timestamp (ms) of the last pong received, or 0 if none yet. */
  get lastPongAt(): number {
    return this._lastPongAt;
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  get isAuthenticated(): boolean {
    return this.authenticated;
  }

  async connect(): Promise<void> {
    this.intentionalClose = false;

    return new Promise<void>((resolve, reject) => {
      this.logger.info(`Connecting to ${this.wsUrl}`);
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        this.reconnectAttempts = 0;
        this.logger.info('WebSocket connected');
        this.emit('open');
        this.authenticate()
          .then(() => {
            this.startHeartbeat();
            resolve();
          })
          .catch(reject);
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('pong', () => {
        this._lastPongAt = Date.now();
        if (this.pongTimer) {
          clearTimeout(this.pongTimer);
          this.pongTimer = null;
        }
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        const reasonStr = reason.toString();
        this.logger.info(`WebSocket closed: ${code} ${reasonStr}`);
        this.authenticated = false;
        this.stopHeartbeat();
        this.emit('close', code, reasonStr);
        if (!this.intentionalClose) {
          this.attemptReconnect();
        }
      });

      this.ws.on('error', (error: Error) => {
        this.logger.error('WebSocket error:', error.message);
        this.emit('error', error);
        reject(error);
      });
    });
  }

  private async authenticate(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new EToroAuthError('WebSocket authentication timed out'));
      }, this.authTimeout);

      // Listen for auth success — the first message after sending auth is typically the response
      const authHandler = () => {
        clearTimeout(timeout);
        this.logger.info('WebSocket authenticated');
        resolve();
      };

      this.once('authenticated', authHandler);

      const authMsg = {
        id: generateUUID(),
        operation: 'Authenticate',
        data: {
          userKey: this.userKey,
          apiKey: this.apiKey,
        },
      };

      this.send(authMsg);
    });
  }

  subscribe(topics: string[], snapshot = false): void {
    this.subscriptions.add(topics);
    const msg = {
      id: generateUUID(),
      operation: 'Subscribe',
      data: { topics, snapshot },
    };
    this.logger.debug(`Subscribing to: ${topics.join(', ')}`);
    this.send(msg);
  }

  unsubscribe(topics: string[]): void {
    this.subscriptions.remove(topics);
    const msg = {
      id: generateUUID(),
      operation: 'Unsubscribe',
      data: { topics },
    };
    this.logger.debug(`Unsubscribing from: ${topics.join(', ')}`);
    this.send(msg);
  }

  async disconnect(): Promise<void> {
    this.intentionalClose = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.authenticated = false;
    this.subscriptions.clear();
  }

  private handleMessage(data: string): void {
    try {
      const raw = JSON.parse(data);

      // Check for auth response
      if (raw.operation === 'Authenticate' || raw.type === 'Authenticate') {
        if (raw.errorCode) {
          this.emit('error', new EToroAuthError(`WS auth failed: ${raw.errorCode}`));
          return;
        }
        this.authenticated = true;
        this.emit('authenticated');
        return;
      }

      // Check for success/error on subscribe/unsubscribe (these don't need special handling)

      // Parse data messages
      if (raw.messages && Array.isArray(raw.messages)) {
        const envelope = raw as WsEnvelope;
        this.emit('message', envelope);

        const parsed = parseMessages(envelope);
        for (const msg of parsed) {
          switch (msg.type) {
            case 'instrument:rate':
              this.emit('instrument:rate', msg.data.instrumentId, msg.data.rate);
              break;
            case 'private:event':
              this.emit('private:event', msg.data.event);
              break;
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to parse WebSocket message:', data);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(`Max reconnect attempts (${this.maxReconnectAttempts}) reached`);
      this.emit('error', new EToroWebSocketError('Max reconnect attempts reached'));
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
        // Re-subscribe to all previous topics
        const topics = this.subscriptions.getAll();
        if (topics.length > 0) {
          this.logger.info(`Re-subscribing to ${topics.length} topics`);
          this.subscribe(topics);
        }
      } catch (error) {
        this.logger.error('Reconnection failed:', (error as Error).message);
      }
    }, delay);
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval <= 0) return;
    this.stopHeartbeat();

    this.logger.debug(`Starting heartbeat (interval: ${this.heartbeatInterval}ms, timeout: ${this.heartbeatTimeout}ms)`);

    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      this.ws.ping();

      // Set a pong timeout — if no pong comes back, the connection is dead
      this.pongTimer = setTimeout(() => {
        this.logger.warn('Heartbeat pong timeout — connection appears dead');
        this.ws?.terminate();
      }, this.heartbeatTimeout);
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private send(msg: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new EToroWebSocketError('WebSocket not connected');
    }
    this.ws.send(JSON.stringify(msg));
  }
}
