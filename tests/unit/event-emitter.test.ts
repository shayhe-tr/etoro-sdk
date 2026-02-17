import { describe, it, expect, vi } from 'vitest';
import { TypedEventEmitter } from '../../src/utils/event-emitter';

type TestEvents = {
  data: (value: number) => void;
  error: (err: Error) => void;
  done: () => void;
};

class TestEmitter extends TypedEventEmitter<TestEvents> {
  testEmit<K extends keyof TestEvents>(event: K, ...args: Parameters<TestEvents[K]>) {
    return this.emit(event, ...args);
  }
}

describe('TypedEventEmitter', () => {
  it('should register and call listeners', () => {
    const emitter = new TestEmitter();
    const handler = vi.fn();

    emitter.on('data', handler);
    emitter.testEmit('data', 42);

    expect(handler).toHaveBeenCalledWith(42);
  });

  it('should support multiple listeners', () => {
    const emitter = new TestEmitter();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    emitter.on('data', handler1);
    emitter.on('data', handler2);
    emitter.testEmit('data', 10);

    expect(handler1).toHaveBeenCalledWith(10);
    expect(handler2).toHaveBeenCalledWith(10);
  });

  it('should remove listener with off', () => {
    const emitter = new TestEmitter();
    const handler = vi.fn();

    emitter.on('data', handler);
    emitter.off('data', handler);
    emitter.testEmit('data', 5);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should fire once listener only once', () => {
    const emitter = new TestEmitter();
    const handler = vi.fn();

    emitter.once('data', handler);
    emitter.testEmit('data', 1);
    emitter.testEmit('data', 2);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(1);
  });

  it('should return false when no listeners', () => {
    const emitter = new TestEmitter();
    expect(emitter.testEmit('data', 0)).toBe(false);
  });

  it('should return true when listeners exist', () => {
    const emitter = new TestEmitter();
    emitter.on('data', () => {});
    expect(emitter.testEmit('data', 0)).toBe(true);
  });

  it('should remove all listeners for specific event', () => {
    const emitter = new TestEmitter();
    const handler = vi.fn();

    emitter.on('data', handler);
    emitter.on('done', handler);
    emitter.removeAllListeners('data');
    emitter.testEmit('data', 0);
    emitter.testEmit('done');

    expect(handler).toHaveBeenCalledTimes(1); // only 'done' fired
  });

  it('should remove all listeners for all events', () => {
    const emitter = new TestEmitter();
    const handler = vi.fn();

    emitter.on('data', handler);
    emitter.on('done', handler);
    emitter.removeAllListeners();
    emitter.testEmit('data', 0);
    emitter.testEmit('done');

    expect(handler).not.toHaveBeenCalled();
  });

  it('should support chaining', () => {
    const emitter = new TestEmitter();
    const result = emitter.on('data', () => {}).on('done', () => {});
    expect(result).toBe(emitter);
  });
});
