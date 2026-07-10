import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { createWebLoader } from './web.js';
import Loader from './base.js';

const mockXhr = (responseText, status) => {
  let onreadystatechange = null;
  const xhr = {
    open: mock((method, url, async) => {
      xhr._url = url;
    }),
    send: mock(() => {
      xhr.readyState = 4;
      xhr.status = status;
      xhr.responseText = responseText;
      if (onreadystatechange) onreadystatechange();
    }),
    get onreadystatechange() { return onreadystatechange; },
    set onreadystatechange(fn) { onreadystatechange = fn; },
    _url: '',
  };
  return xhr;
};

let origXhr;

describe('WebLoader', () => {
  beforeEach(() => {
    origXhr = globalThis.XMLHttpRequest;
    globalThis.window = {};
  });

  afterEach(() => {
    globalThis.XMLHttpRequest = origXhr;
    delete globalThis.window;
  });

  describe('createWebLoader', () => {
    test('returns a Loader instance', () => {
      const loader = createWebLoader('/templates');
      expect(loader).toBeInstanceOf(Loader);
      expect(loader.baseURL).toBe('/templates');
      expect(loader.async).toBe(true);
    });

    test('defaults baseURL to "."', () => {
      const loader = createWebLoader();
      expect(loader.baseURL).toBe('.');
    });

    test('sets useCache from opts', () => {
      const loader = createWebLoader('/templates', { useCache: true });
      expect(loader.useCache).toBe(true);
    });

    test('resolve throws error', () => {
      const loader = createWebLoader('/templates');
      expect(() => loader.resolve()).toThrow('relative templates not supported');
    });

    test('getSource returns source on successful XHR', async () => {
      const xhr = mockXhr('<h1>Hello</h1>', 200);
      globalThis.XMLHttpRequest = mock(() => xhr);

      const loader = createWebLoader('/templates');
      const result = await loader.getSource('hello.njk');

      expect(result).toEqual({
        src: '<h1>Hello</h1>',
        path: 'hello.njk',
        noCache: true,
      });
      expect(xhr.open).toHaveBeenCalledWith('GET', expect.stringContaining('/templates/hello.njk'), true);
      expect(xhr.send).toHaveBeenCalled();
    });

    test('getSource handles status 0 as success', async () => {
      const xhr = mockXhr('content', 0);
      globalThis.XMLHttpRequest = mock(() => xhr);

      const loader = createWebLoader('/templates');
      const result = await loader.getSource('test.njk');

      expect(result.src).toBe('content');
    });

    test('getSource returns null for 404', async () => {
      const xhr = mockXhr('Not found', 404);
      globalThis.XMLHttpRequest = mock(() => xhr);

      const loader = createWebLoader('/templates');
      const result = await loader.getSource('missing.njk');

      expect(result).toBeNull();
    });

    test('getSource throws on non-404 error', async () => {
      const xhr = mockXhr('Server error', 500);
      globalThis.XMLHttpRequest = mock(() => xhr);

      const loader = createWebLoader('/templates');
      expect(loader.getSource('broken.njk')).rejects.toBe('Server error');
    });

    test('getSource uses cache when useCache is true', async () => {
      const xhr = mockXhr('cached', 200);
      globalThis.XMLHttpRequest = mock(() => xhr);

      const loader = createWebLoader('/templates', { useCache: true });
      const result = await loader.getSource('cached.njk');

      expect(result.noCache).toBe(false);
    });

    test('getSource emits load event', async () => {
      const xhr = mockXhr('content', 200);
      globalThis.XMLHttpRequest = mock(() => xhr);

      const loader = createWebLoader('/templates');
      let emitted = null;
      loader.on('load', (name, result) => { emitted = { name, result }; });

      await loader.getSource('emit-test.njk');

      expect(emitted).not.toBeNull();
      expect(emitted.name).toBe('emit-test.njk');
    });
  });

  describe('WebLoader class', () => {
    test('constructor sets baseURL, useCache, async', () => {
      const loader = createWebLoader('/templates', { useCache: true });
      expect(loader.baseURL).toBe('/templates');
      expect(loader.useCache).toBe(true);
      expect(loader.async).toBe(true);
    });

    test('constructor defaults baseURL to "."', () => {
      const loader = createWebLoader();
      expect(loader.baseURL).toBe('.');
    });

    test('resolve throws error', () => {
      const loader = createWebLoader('/templates');
      expect(() => loader.resolve()).toThrow('relative templates not supported');
    });

    test('getSource works same as createWebLoader', async () => {
      const xhr = mockXhr('class content', 200);
      globalThis.XMLHttpRequest = mock(() => xhr);

      const loader = createWebLoader('/base');
      const result = await loader.getSource('test.njk');

      expect(result.src).toBe('class content');
      expect(result.path).toBe('test.njk');
    });

    test('rejects when window is not defined', async () => {
      delete globalThis.window;
      const xhr = mockXhr('content', 200);
      globalThis.XMLHttpRequest = mock(() => xhr);

      const loader = createWebLoader('/templates');

      expect(loader.getSource('test.njk')).rejects.toThrow('WebLoader can only be used in a browser');
    });
  });
});
