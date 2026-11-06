import { describe, it, expect, vi } from 'vitest';

// Mock Vercel response/res types
interface MockResponse {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  setHeader: (key: string, value: string) => void;
  status: (code: number) => { json: (data: unknown) => void };
}

function createMockResponse(): MockResponse {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(key: string, value: string) {
      this.headers[key] = value;
    },
    status(code: number) {
      res.statusCode = code;
      return {
        json: (data: unknown) => {
          res.body = data;
        },
      };
    },
  };
  return res;
}

describe('API Health Check', () => {
  it('returns ok status', async () => {
    const { default: handler } = await import('../../api/index');
    const res = createMockResponse();
    await handler(
      { method: 'GET', query: { path: ['health'] } } as any,
      res as any,
    );
    expect(res.statusCode).toBe(200);
    expect((res.body as any).status).toBe('ok');
  });
});

describe('API Registration', () => {
  it('rejects empty username', async () => {
    const { default: handler } = await import('../../api/index');
    const res = createMockResponse();
    await handler(
      {
        method: 'POST',
        query: { path: ['register'] },
        body: { username: '', password: 'test' },
      } as any,
      res as any,
    );
    expect(res.statusCode).toBe(400);
    expect((res.body as any).success).toBe(false);
  });

  it('accepts valid registration', async () => {
    const { default: handler } = await import('../../api/index');
    const res = createMockResponse();
    await handler(
      {
        method: 'POST',
        query: { path: ['register'] },
        body: { username: 'testuser', password: 'test123' },
      } as any,
      res as any,
    );
    expect(res.statusCode).toBe(201);
    expect((res.body as any).success).toBe(true);
    expect((res.body as any).data.username).toBe('testuser');
    expect((res.body as any).data.token).toBeDefined();
  });
});

describe('API Guest Registration', () => {
  it('creates guest user with credits', async () => {
    const { default: handler } = await import('../../api/index');
    const res = createMockResponse();
    await handler(
      { method: 'POST', query: { path: ['auth', 'guest'] } } as any,
      res as any,
    );
    expect(res.statusCode).toBe(200);
    expect((res.body as any).data.type).toBe('guest');
    expect((res.body as any).data.credits).toBe(100);
  });
});

describe('API 404 Handler', () => {
  it('returns error for unknown endpoint', async () => {
    const { default: handler } = await import('../../api/index');
    const res = createMockResponse();
    await handler(
      { method: 'GET', query: { path: ['unknown'] } } as any,
      res as any,
    );
    expect(res.statusCode).toBe(404);
    expect((res.body as any).success).toBe(false);
  });
});

describe('CORS Headers', () => {
  it('sets CORS headers on every response', async () => {
    const { default: handler } = await import('../../api/index');
    const res = createMockResponse();
    await handler(
      { method: 'GET', query: { path: ['health'] } } as any,
      res as any,
    );
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res.headers['Access-Control-Allow-Methods']).toBe(
      'GET, POST, PUT, DELETE, OPTIONS',
    );
  });
});
