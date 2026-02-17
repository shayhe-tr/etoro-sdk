import { describe, it, expect } from 'vitest';
import { parseEnvelope, parseMessages } from '../../src/ws/ws-message-parser';
import type { WsEnvelope } from '../../src/types/websocket';

describe('ws-message-parser', () => {
  describe('parseEnvelope', () => {
    it('should parse valid JSON envelope', () => {
      const raw = JSON.stringify({
        messages: [{ topic: 'test', content: '{}', id: '1', type: 'TestType' }],
      });
      const result = parseEnvelope(raw);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].topic).toBe('test');
    });
  });

  describe('parseMessages', () => {
    it('should parse instrument rate messages', () => {
      const envelope: WsEnvelope = {
        messages: [
          {
            topic: 'instrument:1001',
            content: JSON.stringify({
              Ask: 150.5,
              Bid: 150.4,
              LastExecution: 150.45,
              Date: '2024-01-01T00:00:00Z',
              PriceRateID: 123,
            }),
            id: 'msg-1',
            type: 'Trading.Instrument.Rate',
          },
        ],
      };

      const parsed = parseMessages(envelope);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe('instrument:rate');
      if (parsed[0].type === 'instrument:rate') {
        expect(parsed[0].data.instrumentId).toBe(1001);
        expect(parsed[0].data.rate.Ask).toBe(150.5);
        expect(parsed[0].data.rate.Bid).toBe(150.4);
      }
    });

    it('should parse private event messages', () => {
      const envelope: WsEnvelope = {
        messages: [
          {
            topic: 'private',
            content: JSON.stringify({
              OrderID: 999,
              OrderType: 1,
              StatusID: 1,
              InstrumentID: 1001,
              CID: 555,
              RequestedUnits: 10,
              ExecutedUnits: 10,
              NetProfit: 25.5,
              CloseReason: 'manual',
              OpenDateTime: '2024-01-01T00:00:00Z',
              RequestOccurred: '2024-01-01T00:01:00Z',
            }),
            id: 'msg-2',
            type: 'Trading.OrderForCloseMultiple.Update',
          },
        ],
      };

      const parsed = parseMessages(envelope);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe('private:event');
      if (parsed[0].type === 'private:event') {
        expect(parsed[0].data.event.OrderID).toBe(999);
        expect(parsed[0].data.event.NetProfit).toBe(25.5);
      }
    });

    it('should handle unknown topics', () => {
      const envelope: WsEnvelope = {
        messages: [
          {
            topic: 'system:alert',
            content: '{"alert":"maintenance"}',
            id: 'msg-3',
            type: 'System.Alert',
          },
        ],
      };

      const parsed = parseMessages(envelope);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe('unknown');
    });

    it('should handle multiple messages in one envelope', () => {
      const envelope: WsEnvelope = {
        messages: [
          {
            topic: 'instrument:1001',
            content: JSON.stringify({ Ask: 150, Bid: 149.9, LastExecution: 150, Date: '', PriceRateID: 1 }),
            id: '1',
            type: 'Trading.Instrument.Rate',
          },
          {
            topic: 'instrument:2001',
            content: JSON.stringify({ Ask: 50000, Bid: 49999, LastExecution: 50000, Date: '', PriceRateID: 2 }),
            id: '2',
            type: 'Trading.Instrument.Rate',
          },
        ],
      };

      const parsed = parseMessages(envelope);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].type).toBe('instrument:rate');
      expect(parsed[1].type).toBe('instrument:rate');
    });
  });
});
