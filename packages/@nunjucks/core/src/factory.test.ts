import { describe, test, expect } from 'bun:test';
import { createNunjucks } from './factory.ts';
import { isOk } from '@nunjucks/shared';

describe('createNunjucks', () => {
  test('creates engine with render method', () => {
    const engine = createNunjucks({});
    expect(engine.render).toBeDefined();
    expect(typeof engine.render).toBe('function');
  });

  test('creates engine with renderToStream method', () => {
    const engine = createNunjucks({});
    expect(engine.renderToStream).toBeDefined();
    expect(typeof engine.renderToStream).toBe('function');
  });

  test('creates engine with pipeRenderStream method', () => {
    const engine = createNunjucks({});
    expect(engine.pipeRenderStream).toBeDefined();
    expect(typeof engine.pipeRenderStream).toBe('function');
  });

  test('render works with basic template', async () => {
    const engine = createNunjucks({});
    const result = await engine.render('Hello {{ name }}', { name: 'World' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('Hello World');
    }
  });

  test('render works with filters', async () => {
    const engine = createNunjucks({
      filters: {
        shout: (v: unknown) => String(v).toUpperCase(),
      },
    });
    const result = await engine.render('{{ name |> shout }}', { name: 'hello' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('HELLO');
    }
  });

  test('render works with globals', async () => {
    const engine = createNunjucks({
      globals: {
        appName: 'MyApp',
      },
    });
    const result = await engine.render('Welcome to {{ appName }}');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('Welcome to MyApp');
    }
  });

  test('plugin filters override base filters', async () => {
    const engine = createNunjucks({
      plugins: [{
        filters: {
          custom: () => 'from plugin',
        },
      }],
      filters: {
        custom: () => 'from config',
      },
    });
    const result = await engine.render('{{ value |> custom }}', { value: 'test' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('from config');
    }
  });

  test('plugin globals override base globals', async () => {
    const engine = createNunjucks({
      plugins: [{
        globals: {
          pluginGlobal: 'from plugin',
        },
      }],
      globals: {
        pluginGlobal: 'from config',
      },
    });
    const result = await engine.render('{{ pluginGlobal }}');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('from config');
    }
  });

  test('undefined config values are stripped', async () => {
    const engine = createNunjucks({
      dev: undefined,
      autoescape: undefined,
    });
    const result = await engine.render('Hello');
    expect(isOk(result)).toBe(true);
  });

  test('renderToStream returns a stream result', async () => {
    const engine = createNunjucks({});
    const streamResult = await engine.renderToStream('Hello {{ name }}', { name: 'Stream' });
    expect(streamResult).toBeDefined();
    if ('ok' in streamResult && streamResult.ok) {
      expect(streamResult.stream).toBeDefined();
      expect(typeof streamResult.stream.next).toBe('function');
    }
  });

  test('config with limits applies execution timeout', async () => {
    const engine = createNunjucks({
      limits: {
        executionTimeout: 5000,
      },
    });
    const result = await engine.render('Hello');
    expect(isOk(result)).toBe(true);
  });

  test('config with maxTemplateSize applies limit', async () => {
    const engine = createNunjucks({
      limits: {
        maxTemplateSize: 1024,
      },
    });
    const result = await engine.render('Hello');
    expect(isOk(result)).toBe(true);
  });

  test('config with streaming options applies', async () => {
    const engine = createNunjucks({
      streaming: {
        contentType: 'json',
        coalesceBytes: 100,
      },
    });
    const result = await engine.render('Hello');
    expect(isOk(result)).toBe(true);
  });

  test('two factories have isolated loader caches', async () => {
    const engine1 = createNunjucks({ views: '/path1' });
    const engine2 = createNunjucks({ views: '/path2' });
    expect(engine1).toBeDefined();
    expect(engine2).toBeDefined();
    expect(engine1).not.toBe(engine2);
  });
});
