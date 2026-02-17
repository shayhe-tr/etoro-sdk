import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createConfig } from '../../src/config/config';
import { EToroValidationError } from '../../src/errors/validation-error';

describe('createConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ETORO_API_KEY;
    delete process.env.ETORO_USER_KEY;
    delete process.env.ETORO_MODE;
    delete process.env.ETORO_BASE_URL;
    delete process.env.ETORO_WS_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create config from constructor overrides', () => {
    const config = createConfig({
      apiKey: 'test-api-key',
      userKey: 'test-user-key',
    });
    expect(config.apiKey).toBe('test-api-key');
    expect(config.userKey).toBe('test-user-key');
    expect(config.mode).toBe('demo');
    expect(config.baseUrl).toBe('https://public-api.etoro.com');
    expect(config.wsUrl).toBe('wss://ws.etoro.com/ws');
    expect(config.timeout).toBe(30_000);
    expect(config.retryAttempts).toBe(3);
    expect(config.retryDelay).toBe(1_000);
  });

  it('should read from environment variables', () => {
    process.env.ETORO_API_KEY = 'env-api-key';
    process.env.ETORO_USER_KEY = 'env-user-key';
    process.env.ETORO_MODE = 'real';

    const config = createConfig();
    expect(config.apiKey).toBe('env-api-key');
    expect(config.userKey).toBe('env-user-key');
    expect(config.mode).toBe('real');
  });

  it('should prioritize constructor args over env vars', () => {
    process.env.ETORO_API_KEY = 'env-api-key';
    process.env.ETORO_USER_KEY = 'env-user-key';

    const config = createConfig({
      apiKey: 'override-key',
      userKey: 'override-user',
    });
    expect(config.apiKey).toBe('override-key');
    expect(config.userKey).toBe('override-user');
  });

  it('should throw validation error for missing apiKey', () => {
    expect(() =>
      createConfig({ userKey: 'test-user-key' }),
    ).toThrow(EToroValidationError);
  });

  it('should throw validation error for missing userKey', () => {
    expect(() =>
      createConfig({ apiKey: 'test-api-key' }),
    ).toThrow(EToroValidationError);
  });

  it('should accept custom timeout and retry settings', () => {
    const config = createConfig({
      apiKey: 'key',
      userKey: 'user',
      timeout: 60_000,
      retryAttempts: 5,
      retryDelay: 2_000,
    });
    expect(config.timeout).toBe(60_000);
    expect(config.retryAttempts).toBe(5);
    expect(config.retryDelay).toBe(2_000);
  });

  it('should accept custom logger', () => {
    const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
    const config = createConfig({
      apiKey: 'key',
      userKey: 'user',
      logger,
    });
    expect(config.logger).toBe(logger);
  });
});
