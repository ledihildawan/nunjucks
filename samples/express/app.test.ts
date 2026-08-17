import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createServer, type Server } from 'node:http';
import { createApp } from './app.ts';

let server: Server;
let baseUrl: string;

const get = async (path: string): Promise<Response> => fetch(`${baseUrl}${path}`);

// WHY: loopback JSON bodies are still external data — narrow from unknown instead of casting.
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isRejectionPayload = (value: unknown): value is { ok: boolean } =>
  isRecord(value) && 'ok' in value && typeof value.ok === 'boolean';

beforeAll(async () => {
  server = createServer(createApp());
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve();
    });
  });
  const address = server.address();
  // WHY: listen(0, '127.0.0.1') on a TCP server always yields a bound port — narrow the
  // string|null union instead of casting, failing loudly if the invariant ever breaks.
  if (address === null || typeof address === 'string') {
    throw new Error(`Expected TCP address, received: ${String(address)}`);
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
});

describe('boundary validation route', () => {
  test('valid query renders the validated template', async () => {
    const response = await get('/boundary?name=Alice&count=5');

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('Boundary Validation');
    expect(body).toContain('Alice');
  });

  test('hostile name is HTML-escaped, never raw script', async () => {
    const hostileName = encodeURIComponent('<script>alert(1)</script>');
    const response = await get(`/boundary?name=${hostileName}&count=3`);

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).not.toContain('<script>alert');
    expect(body).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('schema-invalid query is rejected as 400 JSON before any render', async () => {
    const response = await get('/boundary?name=&count=0');

    expect(response.status).toBe(400);
    const payload: unknown = await response.json();
    if (!isRejectionPayload(payload)) {
      throw new Error(`Expected rejection payload with boolean ok, received: ${typeof payload}`);
    }
    expect(payload.ok).toBe(false);
  });
});

describe('sandbox-blocked route', () => {
  test('__proto__ probe yields 500 with the rendered error page', async () => {
    const response = await get('/errors/sandbox-proto');

    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).toContain('Template Error');
  });
});

describe('streaming route', () => {
  test('chunked dashboard arrives complete', async () => {
    const response = await get('/stream');

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('Store Dashboard');
    expect(body).toContain('Recent Orders');
    expect(body).toContain("mark('Widget done')");
    expect(body).toContain('</html>');
  }, 30000);
});

describe('streaming JSON API route', () => {
  test('streams the dashboard KPIs as a parsable JSON document', async () => {
    const response = await get('/stream-api');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')?.includes('application/json')).toBe(true);
    const payload: unknown = await response.json();
    if (!isRecord(payload)) {
      throw new Error(`Expected JSON object, received: ${typeof payload}`);
    }
    expect(payload.revenue).toBe('$125,430');
    expect(Array.isArray(payload.orders)).toBe(true);
  }, 30000);
});

describe('remote fragment route', () => {
  test('time fragment returns the localized clock label', async () => {
    const response = await get('/remote/api/time');

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('Current time:');
  });
});

describe('homepage', () => {
  // WHY: regression — index.njk displays literal template tags ({% switch %}, etc.)
  // inside <code> samples; without {% raw %} wrapping the page 500s with PARSER_ERROR.
  test('renders the catalog with literal tag samples intact', async () => {
    const response = await get('/');

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('{% switch %}');
    expect(body).toContain('{% component %}');
    expect(body).toContain('Scoped variables via walrus');
  });
});

describe('uncovered-router smokes (one route per router)', () => {
  test('/demo/pipe renders the pipe-forward filter chains', async () => {
    const response = await get('/demo/pipe');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('HELLO WORLD');
  });

  test('/undefined/strict returns the 400 strict-mode error page', async () => {
    const response = await get('/undefined/strict');
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toContain('Strict Mode');
  });

  test('/sandbox renders the sandbox overview page', async () => {
    const response = await get('/sandbox');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Sandbox Mode Demo');
  });

  test('/warnings renders the debug-mode undefined demo', async () => {
    const response = await get('/warnings');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('This value is defined');
  });
});

describe('not-found handler', () => {
  test('unknown path falls through to the Express 404 default', async () => {
    const response = await get('/definitely-not-a-route');

    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).toContain('Cannot GET /definitely-not-a-route');
  });
});
