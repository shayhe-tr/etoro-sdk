import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../../src/http/http-client';
import { EToroApiError } from '../../src/errors/api-error';
import { EToroAuthError } from '../../src/errors/auth-error';
import { EToroRateLimitError } from '../../src/errors/rate-limit-error';

const mockConfig = {
  apiKey: 'test-api-key',
  userKey: 'test-user-key',
  mode: 'demo' as const,
  baseUrl: 'https://public-api.etoro.com',
  wsUrl: 'wss://ws.etoro.com/ws',
  timeout: 30_000,
  retryAttempts: 1, // disable retry for unit tests
  retryDelay: 10,
};

describe('HttpClient', () => {
  let client: HttpClient;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Disable rate limiter for unit tests to avoid timing issues
    client = new HttpClient(mockConfig, { rateLimiter: false });
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should make GET request with correct headers', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ data: 'test' })),
    });

    await client.request({ method: 'GET', path: '/api/v1/test' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://public-api.etoro.com/api/v1/test');
    expect(init.method).toBe('GET');

    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('test-api-key');
    expect(headers['x-user-key']).toBe('test-user-key');
    expect(headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('should include Content-Type for POST requests', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ token: 'abc' })),
    });

    await client.request({
      method: 'POST',
      path: '/api/v1/test',
      body: { key: 'value' },
    });

    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ key: 'value' }));
  });

  it('should append query parameters', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({})),
    });

    await client.request({
      method: 'GET',
      path: '/api/v1/search',
      query: { searchText: 'AAPL', pageSize: 10, missing: undefined },
    });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toContain('searchText=AAPL');
    expect(url).toContain('pageSize=10');
    expect(url).not.toContain('missing');
  });

  it('should throw EToroAuthError on 401', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    await expect(
      client.request({ method: 'GET', path: '/api/v1/test' }),
    ).rejects.toThrow(EToroAuthError);
  });

  it('should throw EToroAuthError on 403', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });

    await expect(
      client.request({ method: 'GET', path: '/api/v1/test' }),
    ).rejects.toThrow(EToroAuthError);
  });

  it('should throw EToroRateLimitError on 429', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: new Map([['Retry-After', '5']]),
    });

    await expect(
      client.request({ method: 'GET', path: '/api/v1/test' }),
    ).rejects.toThrow(EToroRateLimitError);
  });

  it('should include requestId in EToroAuthError', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    try {
      await client.request({ method: 'GET', path: '/api/v1/test', requestId: 'my-req-id' });
    } catch (err) {
      expect(err).toBeInstanceOf(EToroAuthError);
      expect((err as EToroAuthError).requestId).toBe('my-req-id');
    }
  });

  it('should include requestContext in EToroApiError on 500', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve('Server error'),
    });

    try {
      await client.request({ method: 'POST', path: '/api/v1/orders' });
    } catch (err) {
      expect(err).toBeInstanceOf(EToroApiError);
      const apiErr = err as EToroApiError;
      expect(apiErr.requestContext).toBeDefined();
      expect(apiErr.requestContext!.method).toBe('POST');
      expect(apiErr.requestContext!.path).toBe('/api/v1/orders');
      expect(apiErr.requestContext!.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('should throw EToroApiError on other errors', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve('Server error'),
    });

    await expect(
      client.request({ method: 'GET', path: '/api/v1/test' }),
    ).rejects.toThrow(EToroApiError);
  });

  it('should return undefined for 204 responses', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 204,
    });

    const result = await client.request({ method: 'DELETE', path: '/api/v1/test' });
    expect(result).toBeUndefined();
  });

  it('should use custom requestId when provided', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({})),
    });

    await client.request({
      method: 'GET',
      path: '/api/v1/test',
      requestId: 'custom-uuid',
    });

    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers['x-request-id']).toBe('custom-uuid');
  });

  it('should construct with rate limiter disabled', () => {
    const noLimiter = new HttpClient(mockConfig, { rateLimiter: false });
    expect(noLimiter).toBeDefined();
  });

  it('should construct with default rate limiter', () => {
    const withLimiter = new HttpClient(mockConfig);
    expect(withLimiter).toBeDefined();
    withLimiter.dispose();
  });

  it('should construct with custom rate limiter options', () => {
    const withLimiter = new HttpClient(mockConfig, {
      rateLimiter: { maxRequests: 5, windowMs: 5000 },
    });
    expect(withLimiter).toBeDefined();
    withLimiter.dispose();
  });
});
