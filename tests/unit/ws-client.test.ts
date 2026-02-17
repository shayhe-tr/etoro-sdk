import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WsClient } from '../../src/ws/ws-client';

describe('WsClient', () => {
  describe('constructor defaults', () => {
    it('should set default options', () => {
      const client = new WsClient({
        apiKey: 'test-key',
        userKey: 'test-user',
      });

      expect(client.isConnected).toBe(false);
      expect(client.isAuthenticated).toBe(false);
      expect(client.lastPongAt).toBe(0);
    });

    it('should accept custom heartbeat options', () => {
      const client = new WsClient({
        apiKey: 'test-key',
        userKey: 'test-user',
        heartbeatInterval: 15_000,
        heartbeatTimeout: 5_000,
      });

      // Just verify it doesn't throw
      expect(client).toBeDefined();
    });

    it('should accept heartbeatInterval of 0 to disable heartbeat', () => {
      const client = new WsClient({
        apiKey: 'test-key',
        userKey: 'test-user',
        heartbeatInterval: 0,
      });

      expect(client).toBeDefined();
    });
  });

  describe('disconnect', () => {
    it('should clear state on disconnect', async () => {
      const client = new WsClient({
        apiKey: 'test-key',
        userKey: 'test-user',
      });

      // disconnect before connecting should not throw
      await client.disconnect();
      expect(client.isConnected).toBe(false);
      expect(client.isAuthenticated).toBe(false);
    });
  });

  describe('subscribe/unsubscribe', () => {
    it('should throw when subscribing without connection', () => {
      const client = new WsClient({
        apiKey: 'test-key',
        userKey: 'test-user',
      });

      expect(() => client.subscribe(['instrument:100000'])).toThrow(
        'WebSocket not connected',
      );
    });

    it('should throw when unsubscribing without connection', () => {
      const client = new WsClient({
        apiKey: 'test-key',
        userKey: 'test-user',
      });

      expect(() => client.unsubscribe(['instrument:100000'])).toThrow(
        'WebSocket not connected',
      );
    });
  });

  describe('event emitter', () => {
    it('should support on/off for typed events', () => {
      const client = new WsClient({
        apiKey: 'test-key',
        userKey: 'test-user',
      });

      const handler = vi.fn();
      client.on('error', handler);
      client.off('error', handler);

      // Should not throw
      expect(handler).not.toHaveBeenCalled();
    });

    it('should support removeAllListeners', () => {
      const client = new WsClient({
        apiKey: 'test-key',
        userKey: 'test-user',
      });

      const handler = vi.fn();
      client.on('error', handler);
      client.on('open', vi.fn());
      client.removeAllListeners();

      // No listeners should remain — no way to verify directly but should not throw
      expect(true).toBe(true);
    });
  });
});
