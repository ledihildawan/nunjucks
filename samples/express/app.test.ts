import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createServer, type Server } from 'node:http';
import { createApp } from './app.ts';

let server: Server;
let baseUrl: string;

const get = async (path: string): Promise<Response> => fetch(`${baseUrl}${path}`);

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
    const payload = (await response.json()) as { ok: boolean };
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

describe('not-found handler', () => {
  test('unknown path falls through to the Express 404 default', async () => {
    const response = await get('/definitely-not-a-route');

    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).toContain('Cannot GET /definitely-not-a-route');
  });
});
