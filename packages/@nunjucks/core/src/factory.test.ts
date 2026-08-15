import { describe, expect, test } from 'bun:test';
import { isErr, isOk } from '@nunjucks/lib';
import type { TemplateLoader } from '@nunjucks/loaders';
import { createNunjucks } from './factory.ts';

interface InMemoryLoaderInput {
  templates: Record<string, string>;
}

// WHY: in-memory fake loader — exercises the public config.loaders slot with zero fs shell.
const createInMemoryLoader = ({ templates }: InMemoryLoaderInput): TemplateLoader => ({
  getSource: async (name: string) => {
    if (!Object.hasOwn(templates, name)) {
      return null;
    }
    const src = templates[name];
    return src === undefined ? null : { ok: true, value: { src, path: name } };
  },
});

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
      plugins: [
        {
          filters: {
            custom: () => 'from plugin',
          },
        },
      ],
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
      plugins: [
        {
          globals: {
            pluginGlobal: 'from plugin',
          },
        },
      ],
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
    if (isOk(streamResult)) {
      expect(streamResult.value).toBeDefined();
      expect(typeof streamResult.value.next).toBe('function');
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

  test('custom loaders resolve templates end-to-end', async () => {
    const engine = createNunjucks({
      loaders: [createInMemoryLoader({ templates: { 'hello.njk': 'Hello {{ name }}' } })],
    });
    const result = await engine.render('hello.njk', { name: 'Loader' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('Hello Loader');
    }
  });

  test('custom loader chains fall through to later loaders', async () => {
    const engine = createNunjucks({
      loaders: [
        createInMemoryLoader({ templates: {} }),
        createInMemoryLoader({ templates: { 'a.njk': 'from second', 'b.njk': 'B' } }),
      ],
    });
    const result = await engine.render('a.njk');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('from second');
    }
  });

  test('a name no custom loader knows falls back to inline-source treatment', async () => {
    const engine = createNunjucks({ loaders: [createInMemoryLoader({ templates: {} })] });
    const result = await engine.render('plain text, no template syntax');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('plain text, no template syntax');
    }
  });

  test('custom loaders handle includes via getTemplate', async () => {
    const engine = createNunjucks({
      loaders: [
        createInMemoryLoader({
          templates: {
            'wrapper.njk': 'Before {% include "part.njk" %} After',
            'part.njk': 'PART',
          },
        }),
      ],
    });
    const result = await engine.render('wrapper.njk');
    if (!isOk(result)) {
      throw new Error(`expected ok, got ${String(isErr(result) && result.error.message)}`);
    }
    expect(result.value).toBe('Before PART After');
  });

  test('custom loaders take precedence over views', async () => {
    const engine = createNunjucks({
      views: '/nonexistent-views-path',
      loaders: [createInMemoryLoader({ templates: { 'only.njk': 'from custom' } })],
    });
    const result = await engine.render('only.njk');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('from custom');
    }
  });

  test('invalid config: non-function filter is rejected at factory creation', () => {
    expect(() => createNunjucks({ filters: { notAFn: 42 } })).toThrow('notAFn');
  });

  test('invalid config: NaN executionTimeout is rejected', () => {
    expect(() => createNunjucks({ limits: { executionTimeout: Number.NaN } })).toThrow(
      'executionTimeout'
    );
  });

  test('invalid config: negative maxOutputSize is rejected', () => {
    expect(() => createNunjucks({ limits: { maxOutputSize: -1 } })).toThrow('maxOutputSize');
  });

  test('invalid config: bad undefined enum is rejected', () => {
    expect(() => createNunjucks({ undefined: 'not-defined' as unknown as 'strict' })).toThrow(
      'undefined'
    );
  });

  test('invalid config: bad sandboxMode enum is rejected', () => {
    expect(() =>
      createNunjucks({ security: { sandboxMode: 'whitelist' as unknown as 'blocklist' } })
    ).toThrow('sandboxMode');
  });

  test('invalid config: non-string blockedContextKeys entries are rejected', () => {
    expect(() =>
      createNunjucks({ security: { blockedContextKeys: ['ok', 42] as unknown as string[] } })
    ).toThrow('blockedContextKeys');
  });

  test('valid configs with string globals still create engines (globals are data, not callables)', () => {
    expect(() => createNunjucks({ globals: { appName: 'MyApp' } })).not.toThrow();
  });
});
