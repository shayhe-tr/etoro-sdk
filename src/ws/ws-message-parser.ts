import type { WsEnvelope, WsInstrumentRate, WsPrivateEvent } from '../types/websocket';

export interface ParsedInstrumentRate {
  instrumentId: number;
  rate: WsInstrumentRate;
}

export interface ParsedPrivateEvent {
  event: WsPrivateEvent;
}

export type ParsedMessage =
  | { type: 'instrument:rate'; data: ParsedInstrumentRate }
  | { type: 'private:event'; data: ParsedPrivateEvent }
  | { type: 'auth:success' }
  | { type: 'auth:error'; errorCode: string }
  | { type: 'unknown'; raw: unknown };

export function parseEnvelope(data: string): WsEnvelope {
  return JSON.parse(data) as WsEnvelope;
}

export function parseMessages(envelope: WsEnvelope): ParsedMessage[] {
  const results: ParsedMessage[] = [];

  for (const msg of envelope.messages) {
    if (msg.topic.startsWith('instrument:')) {
      const instrumentId = parseInt(msg.topic.split(':')[1], 10);
      const rate = JSON.parse(msg.content) as WsInstrumentRate;
      results.push({
        type: 'instrument:rate',
        data: { instrumentId, rate },
      });
    } else if (msg.topic === 'private') {
      const event = JSON.parse(msg.content) as WsPrivateEvent;
      results.push({
        type: 'private:event',
        data: { event },
      });
    } else {
      results.push({ type: 'unknown', raw: msg });
    }
  }

  return results;
}

export function isAuthResponse(data: string): { success: boolean; errorCode?: string } {
  try {
    const parsed = JSON.parse(data);
    // Auth success: look for success indicator in the response
    if (parsed.operation === 'Authenticate' || parsed.type === 'Authenticate') {
      if (parsed.success === true || parsed.status === 'success') {
        return { success: true };
      }
      if (parsed.errorCode) {
        return { success: false, errorCode: parsed.errorCode };
      }
      // If we get an Authenticate response without explicit error, treat as success
      return { success: true };
    }
    // Also check for error fields directly
    if (parsed.errorCode && typeof parsed.errorCode === 'string') {
      return { success: false, errorCode: parsed.errorCode };
    }
  } catch {
    // Not JSON or not an auth response
  }
  return { success: true }; // Not an auth message, continue normally
}
